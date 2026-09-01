import { NextRequest, NextResponse } from "next/server";
import { getBot, updateBot } from "@/lib/bot-store";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let bot = await getBot(id);
    if (!bot) {
      // Default fixed fallback config
      return NextResponse.json({
        id: "default",
        name: "SaoMai AI",
        greeting: "👋 Xin chào! Tôi là Trợ lý AI SaoMai. Hãy bấm vào tôi để được hỗ trợ nhé!",
        theme_color: "#DC2626",
        position: "bottom-right",
        avatar_url: "/widget/mascot-ai.png",
      }, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // Return public config (no system_prompt for security)
    return NextResponse.json({
      id: bot.id,
      name: bot.name,
      greeting: bot.greeting,
      theme_color: bot.theme_color,
      position: bot.position,
      avatar_url: bot.avatar_url,
    }, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  } catch (error) {
    console.error("Get bot error:", error);
    return NextResponse.json(
      { error: "Không thể tải bot" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const bot = await updateBot(id, {
      name: body.name,
      greeting: body.greeting,
      system_prompt: body.system_prompt,
      theme_color: body.theme_color,
      position: body.position,
      avatar_url: body.avatar_url,
      allowed_domains: body.allowed_domains,
    });

    if (!bot) {
      return NextResponse.json({ error: "Bot không tồn tại" }, { status: 404 });
    }

    return NextResponse.json({ bot, message: "Đã cập nhật bot" });
  } catch (error) {
    console.error("Update bot error:", error);
    return NextResponse.json(
      { error: "Lỗi cập nhật: " + (error as Error).message },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}
