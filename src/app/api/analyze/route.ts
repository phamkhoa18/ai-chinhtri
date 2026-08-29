import { NextRequest, NextResponse } from "next/server";
import { analyzeText } from "@/lib/misinformation-detector";

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text || text.trim().length < 10) {
      return NextResponse.json(
        { error: "Vui lòng nhập đoạn text cần phân tích (tối thiểu 10 ký tự)" },
        { status: 400 }
      );
    }

    const result = await analyzeText(text);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      { error: "Lỗi phân tích: " + (error as Error).message },
      { status: 500 }
    );
  }
}

