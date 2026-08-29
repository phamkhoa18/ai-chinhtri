import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cơ Sở Tri Thức",
  description:
    "Quản lý kho tài liệu tham khảo cho hệ thống AI — Upload văn bản, PDF, DOCX để AI sử dụng làm nguồn dẫn chứng khi phân tích và phản biện thông tin xuyên tạc.",
  openGraph: {
    title: "Cơ Sở Tri Thức | SaoMai AI",
    description:
      "Upload tài liệu chính thống để AI sử dụng làm nguồn tham khảo khi phân tích thông tin xuyên tạc.",
  },
};

export default function KnowledgeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
