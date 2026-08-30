import { NextRequest } from "next/server";
import { getBot, isDomainAllowed } from "@/lib/bot-store";
import { chatCompletionStream } from "@/lib/fpt-ai";
import { search as vectorSearch, SearchResult } from "@/lib/vector-store";
import { searchWeb } from "@/lib/web-search";
import type OpenAI from "openai";

/**
 * Widget chat API — uses the SAME AI pipeline as /api/chat.
 * RAG + Web search + domain-restricted system prompt.
 */
export async function POST(request: NextRequest) {
  try {
    const { botId, messages } = await request.json();

    if (!botId) {
      return Response.json({ error: "Thiếu botId" }, { status: 400 });
    }
    if (!messages || messages.length === 0) {
      return Response.json({ error: "Thiếu tin nhắn" }, { status: 400 });
    }

    // Get bot config
    const bot = await getBot(botId);
    if (!bot) {
      return Response.json({ error: "Bot không tồn tại" }, { status: 404 });
    }

    // Domain validation
    const origin = request.headers.get("origin") || "";
    if (origin && !isDomainAllowed(bot, origin)) {
      return Response.json(
        { error: "Domain không được phép sử dụng bot này" },
        { status: 403 }
      );
    }

    const lastMessage = messages[messages.length - 1]?.content || "";

    // ─── Parallel: RAG search + Web search (SAME as /api/chat) ───
    let ragContext = "";
    let webContext = "";

    const [ragResults, webResults] = await Promise.all([
      // RAG search
      (async () => {
        try {
          const results = await vectorSearch(lastMessage, 3);
          return results.filter((r: SearchResult) => r.score > 0.3);
        } catch {
          return [];
        }
      })(),
      // Web search (only for substantive messages, not greetings)
      (async () => {
        if (lastMessage.length < 30) return [];
        try {
          const results = await searchWeb(lastMessage.substring(0, 100));
          return results.slice(0, 3);
        } catch {
          return [];
        }
      })(),
    ]);

    if (ragResults.length > 0) {
      ragContext =
        "\n\n📚 TÀI LIỆU THAM KHẢO (Knowledge Base):\n" +
        ragResults.map((r: SearchResult) => `[${r.document_name}]: ${r.content}`).join("\n\n");
    }

    if (webResults.length > 0) {
      webContext =
        "\n\n🌐 THÔNG TIN TỪ INTERNET:\n" +
        webResults.map((r: { title: string; snippet: string; url: string }) => `- ${r.title}: ${r.snippet} (${r.url})`).join("\n");
    }

    // ─── System prompt — SAME as /api/chat ───
    const systemMessage: OpenAI.ChatCompletionMessageParam = {
      role: "system",
      content: `Bạn là SaoMai AI — trợ lý AI CHUYÊN BIỆT về bảo vệ nền tảng tư tưởng tại Việt Nam.

Năng lực (CHỈ trả lời các chủ đề sau):
1. Nhận diện và phản biện thông tin xuyên tạc, bóp méo sự thật
2. Giải thích chính sách, đường lối của Đảng và Nhà nước
3. Cung cấp kiến thức chính trị, lịch sử, pháp luật Việt Nam
4. Hướng dẫn cách nhận biết tin giả, thông tin sai lệch
5. Phân tích tình hình an ninh tư tưởng, công tác tuyên giáo

QUY TẮC QUAN TRỌNG NHẤT:
- Bạn là AI CHUYÊN BIỆT. TUYỆT ĐỐI KHÔNG trả lời những câu hỏi KHÔNG liên quan đến lĩnh vực trên.
- Nếu người dùng hỏi về: nấu ăn, lập trình, toán học, khoa học tự nhiên, giải trí, tình cảm, sức khỏe, thể thao, game, hay BẤT KỲ chủ đề nào KHÔNG thuộc lĩnh vực chính trị - tư tưởng - pháp luật Việt Nam → Từ chối lịch sự.
- Mẫu từ chối: "Xin lỗi, tôi là SaoMai AI — trợ lý chuyên biệt về bảo vệ nền tảng tư tưởng. Câu hỏi này nằm ngoài lĩnh vực chuyên môn của tôi. Bạn có thể hỏi tôi về nhận diện thông tin xuyên tạc, chính sách của Đảng và Nhà nước, hoặc kiến thức chính trị - pháp luật Việt Nam."

Phong cách:
- Trả lời bằng tiếng Việt, rõ ràng, chuyên nghiệp
- Khách quan, có lý lẽ, dẫn chứng khi có
- Tự tin, đanh thép khi phản bác thông tin sai
- Thân thiện, dễ hiểu khi giải thích kiến thức

QUY TẮC TRÍCH DẪN:
- CHỈ trích dẫn nguồn từ danh sách tài liệu cung cấp bên dưới
- Format: [Tiêu đề](URL)
- KHÔNG tự bịa nguồn, tên báo, URL
- Nếu không có nguồn phù hợp, phản biện bằng lý luận thuần túy${ragContext}${webContext}`,
    };

    const fullMessages: OpenAI.ChatCompletionMessageParam[] = [
      systemMessage,
      ...messages.slice(-20), // Limit context window to last 20 messages
    ];

    const stream = await chatCompletionStream(fullMessages);

    // Convert to SSE stream
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
              );
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          console.error("[WidgetChat] Stream error:", error);
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ error: "Lỗi kết nối AI" })}\n\n`)
            );
            controller.close();
          } catch {
            // Already closed
          }
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": origin || "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  } catch (error) {
    console.error("[WidgetChat] Error:", error);
    return Response.json(
      { error: "Lỗi chat: " + (error as Error).message },
      { status: 500 }
    );
  }
}

// Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin") || "*";
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}
