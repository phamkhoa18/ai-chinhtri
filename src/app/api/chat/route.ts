import { NextRequest } from "next/server";
import { chatCompletionStream } from "@/lib/fpt-ai";
import { search as vectorSearch } from "@/lib/vector-store";
import { searchWeb } from "@/lib/web-search";
import {
  analyzeTextWithProgress,
  shouldAnalyze,
  type ProgressEvent,
} from "@/lib/misinformation-detector";
import type OpenAI from "openai";

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json();

    if (!messages || messages.length === 0) {
      return Response.json(
        { error: "Vui lòng gửi tin nhắn" },
        { status: 400 }
      );
    }

    const lastMessage = messages[messages.length - 1]?.content || "";
    const hasHistory = messages.length > 1;

    // ─── Auto-detect: Analyze (full pipeline) vs Chat (stream) ───
    const isAnalyzeMode = shouldAnalyze(lastMessage, hasHistory);
    console.log(
      `[Chat] Mode: ${isAnalyzeMode ? "ANALYZE" : "CHAT"} | len=${lastMessage.length} | history=${hasHistory}`
    );

    if (isAnalyzeMode) {
      return handleAnalyze(lastMessage);
    } else {
      return handleChat(messages);
    }
  } catch (error) {
    console.error("Chat error:", error);
    return Response.json(
      { error: "Lỗi: " + (error as Error).message },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════
// ANALYZE MODE — Full pipeline with progress
// ═══════════════════════════════════════════

function handleAnalyze(text: string): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: ProgressEvent) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
        } catch {
          // Stream closed by client
        }
      };

      try {
        // Signal to client: this is analyze mode
        send({ type: "step", step: "detecting", label: "Nhận diện luận điểm xuyên tạc...", progress: 5 });

        await analyzeTextWithProgress(text, send);
      } catch (error) {
        console.error("[Analyze] Pipeline error:", error);
        send({
          type: "error",
          data: {
            step: "pipeline",
            message: "Lỗi phân tích: " + (error as Error).message,
          },
        });
      } finally {
        try {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch {
          // Already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// ═══════════════════════════════════════════
// CHAT MODE — Smart chat with RAG + web
// ═══════════════════════════════════════════

async function handleChat(
  messages: { role: string; content: string }[]
): Promise<Response> {
  const lastMessage = messages[messages.length - 1]?.content || "";

  // ─── Parallel: RAG search + Web search ───
  let ragContext = "";
  let webContext = "";

  const [ragResults, webResults] = await Promise.all([
    // RAG search
    (async () => {
      try {
        const results = await vectorSearch(lastMessage, 3);
        return results.filter((r) => r.score > 0.3);
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
      ragResults.map((r) => `[${r.document_name}]: ${r.content}`).join("\n\n");
  }

  if (webResults.length > 0) {
    webContext =
      "\n\n🌐 THÔNG TIN TỪ INTERNET:\n" +
      webResults.map((r) => `- ${r.title}: ${r.snippet} (${r.url})`).join("\n");
  }

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
    ...(messages.slice(-20) as OpenAI.ChatCompletionMessageParam[]),
  ];

  const aiStream = await chatCompletionStream(fullMessages);

  // Convert to SSE stream
  const encoder = new TextEncoder();
  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of aiStream) {
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
        console.error("[Chat] Stream error:", error);
        try {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ content: "\n\n⚠️ Lỗi kết nối AI — vui lòng thử lại." })}\n\n`
            )
          );
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
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
    },
  });
}
