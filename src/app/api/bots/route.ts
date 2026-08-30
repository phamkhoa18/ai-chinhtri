import { NextRequest, NextResponse } from "next/server";
import { createBot, listBots, deleteBot } from "@/lib/bot-store";

export async function GET() {
  try {
    const bots = await listBots();
    return NextResponse.json({ bots });
  } catch (error) {
    console.error("List bots error:", error);
    return NextResponse.json(
      { error: "Không thể tải danh sách bot" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.name || body.name.trim().length < 1) {
      return NextResponse.json(
        { error: "Vui lòng nhập tên bot" },
        { status: 400 }
      );
    }

    const bot = await createBot({
      name: body.name.trim(),
      greeting: body.greeting,
      system_prompt: body.system_prompt,
      theme_color: body.theme_color,
      position: body.position,
      avatar_url: body.avatar_url,
      allowed_domains: body.allowed_domains,
    });

    return NextResponse.json({ bot, message: `Đã tạo bot "${bot.name}"` });
  } catch (error) {
    console.error("Create bot error:", error);
    return NextResponse.json(
      { error: "Lỗi tạo bot: " + (error as Error).message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: "Thiếu ID bot" }, { status: 400 });
    }
    await deleteBot(id);
    return NextResponse.json({ message: "Đã xóa bot" });
  } catch (error) {
    console.error("Delete bot error:", error);
    return NextResponse.json(
      { error: "Không thể xóa bot" },
      { status: 500 }
    );
  }
}
