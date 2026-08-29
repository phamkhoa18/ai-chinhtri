import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Phân Tích & Chat AI",
  description:
    "Phân tích văn bản nghi xuyên tạc bằng AI — Nhận diện luận điểm thù địch, tìm nguồn chính thống, và tạo bài phản biện tự động có dẫn chứng.",
  openGraph: {
    title: "Phân Tích & Chat AI | SaoMai AI",
    description:
      "Dán đoạn text nghi ngờ, AI sẽ nhận diện xuyên tạc, tìm bằng chứng và viết bài phản biện.",
  },
};

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return children;
}
