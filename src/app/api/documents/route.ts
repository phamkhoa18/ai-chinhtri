import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { chunkText, parseFile } from "@/lib/text-chunker";
import { addDocument, listDocuments, deleteDocument } from "@/lib/vector-store";

export async function GET() {
  try {
    const docs = await listDocuments();
    return NextResponse.json({ documents: docs });
  } catch (error) {
    console.error("List documents error:", error);
    return NextResponse.json(
      { error: "Không thể tải danh sách tài liệu" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";

    let text: string;
    let name: string;
    let fileType: string = "text/plain";
    let fileSize: number = 0;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json(
          { error: "Không tìm thấy file" },
          { status: 400 }
        );
      }

      name = file.name;
      fileType = file.type;
      fileSize = file.size;

      const buffer = Buffer.from(await file.arrayBuffer());
      text = await parseFile(buffer, file.type);
    } else {
      const body = await request.json();
      text = body.text;
      name = body.name || `Tài liệu ${new Date().toLocaleDateString("vi-VN")}`;
      fileType = "text/plain";
      fileSize = new TextEncoder().encode(text).length;
    }

    if (!text || text.trim().length < 10) {
      return NextResponse.json(
        { error: "Nội dung quá ngắn (tối thiểu 10 ký tự)" },
        { status: 400 }
      );
    }

    const docId = uuidv4();
    const chunks = chunkText(text);

    await addDocument(docId, name, chunks, fileType, fileSize);

    return NextResponse.json({
      id: docId,
      name,
      chunk_count: chunks.length,
      message: `Đã thêm "${name}" với ${chunks.length} đoạn văn bản`,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Lỗi xử lý tài liệu: " + (error as Error).message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json(
        { error: "Thiếu ID tài liệu" },
        { status: 400 }
      );
    }
    await deleteDocument(id);
    return NextResponse.json({ message: "Đã xóa tài liệu" });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json(
      { error: "Không thể xóa tài liệu" },
      { status: 500 }
    );
  }
}
