import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "@/components/Sidebar";
import "./globals.css";

const beVietnam = Be_Vietnam_Pro({
  variable: "--font-sans",
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600", "700"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "https://saomai.ai"),
  title: {
    default: "SaoMai AI — Hệ Thống AI Bảo Vệ Nền Tảng Tư Tưởng",
    template: "%s | SaoMai AI",
  },
  description:
    "Hệ thống trí tuệ nhân tạo chuyên nhận diện thông tin xuyên tạc, phản động và tự động phản biện bằng dẫn chứng từ nguồn chính thống. Công cụ hỗ trợ công tác tư tưởng, bảo vệ nền tảng tư tưởng của Đảng.",
  keywords: [
    "AI nhận diện xuyên tạc",
    "phản biện thông tin sai lệch",
    "bảo vệ nền tảng tư tưởng",
    "chống tin giả",
    "AI chính trị",
    "SaoMai AI",
    "nhận diện phản động",
    "fact check Việt Nam",
    "công tác tư tưởng",
    "trí tuệ nhân tạo Việt Nam",
  ],
  authors: [{ name: "SaoMai AI" }],
  creator: "SaoMai AI",
  publisher: "SaoMai AI",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
    },
  },
  openGraph: {
    type: "website",
    locale: "vi_VN",
    siteName: "SaoMai AI",
    title: "SaoMai AI — Hệ Thống AI Bảo Vệ Nền Tảng Tư Tưởng",
    description:
      "Nhận diện thông tin xuyên tạc, phản động bằng AI. Tự động tìm nguồn chính thống và viết bài phản biện có dẫn chứng.",
    images: [
      {
        url: "/saomai-logo.jpg",
        width: 512,
        height: 512,
        alt: "SaoMai AI — Hệ thống AI bảo vệ nền tảng tư tưởng",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "SaoMai AI — Hệ Thống AI Bảo Vệ Nền Tảng Tư Tưởng",
    description:
      "Nhận diện thông tin xuyên tạc, phản động bằng AI. Tự động tìm nguồn chính thống và viết bài phản biện có dẫn chứng.",
    images: ["/saomai-logo.jpg"],
  },
  icons: {
    icon: "/saomai-logo.jpg",
    apple: "/saomai-logo.jpg",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SaoMai AI",
  },
  category: "technology",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${beVietnam.variable} antialiased`}>
      <body className="flex flex-col md:flex-row h-dvh overflow-hidden bg-stone-100">
        <TooltipProvider>
          {/* Main content - Order 1 on mobile, 2 on desktop */}
          <div className="flex-1 min-w-0 p-2 md:p-2 md:pl-0 order-1 md:order-2 h-full overflow-hidden">
            <main className="h-full w-full bg-white rounded-2xl shadow-sm border border-stone-200/80 overflow-hidden relative z-10">
              {children}
            </main>
          </div>
          {/* Sidebar wrapper - Order 2 on mobile, 1 on desktop */}
          <div className="shrink-0 p-2 pt-0 md:p-2 md:pr-0 order-2 md:order-1 z-20 pb-safe">
            <Sidebar />
          </div>
        </TooltipProvider>
      </body>
    </html>
  );
}

