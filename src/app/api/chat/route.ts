import { NextRequest } from "next/server";
import { chatCompletionStream } from "@/lib/fpt-ai";
import { search as vectorSearch } from "@/lib/vector-store";
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

    // Search knowledge base for context
    let ragContext = "";
    try {
      const results = await vectorSearch(lastMessage, 3);
      const relevant = results.filter((r) => r.score > 0.3);
      if (relevant.length > 0) {
        ragContext =
          "\n\nTÀI LIỆU THAM KHẢO (từ Knowledge Base):\n" +
          relevant.map((r) => `[${r.document_name}]: ${r.content}`).join("\n\n");
      }
    } catch {
      // Knowledge base might be empty, continue without RAG
    }

    const systemMessage: OpenAI.ChatCompletionMessageParam = {
      role: "system",
      content: `Bạn là SaoMai AI - trợ lý AI chuyên phân tích và phản biện thông tin xuyên tạc tại Việt Nam.

Nhiệm vụ chính:
1. Nhận diện thông tin xuyên tạc, bóp méo sự thật
2. Phản biện bằng logic và dẫn chứng
3. Giáo dục người dùng về cách nhận biết tin giả

Phong cách:
- Trả lời bằng tiếng Việt
- Chuyên nghiệp, khách quan, có lý lẽ
- Trích dẫn nguồn khi có thể
- Ngắn gọn, đi thẳng vào vấn đề${ragContext}`,
    };

    const fullMessages: OpenAI.ChatCompletionMessageParam[] = [
      systemMessage,
      ...messages,
    ];

    const stream = await chatCompletionStream(fullMessages);

    // Convert to ReadableStream for streaming response
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
          controller.error(error);
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
  } catch (error) {
    console.error("Chat error:", error);
    return Response.json(
      { error: "Lỗi chat: " + (error as Error).message },
      { status: 500 }
    );
  }
}
