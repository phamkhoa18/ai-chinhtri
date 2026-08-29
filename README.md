# ⭐ SaoMai AI — Hệ Thống AI Bảo Vệ Nền Tảng Tư Tưởng

<p align="center">
  <img src="public/saomai-logo.jpg" alt="SaoMai AI Logo" width="120" height="120" style="border-radius: 24px;" />
</p>

<p align="center">
  <strong>Hệ thống trí tuệ nhân tạo chuyên nhận diện thông tin xuyên tạc, phản động</strong><br/>
  <em>Tự động phản biện bằng dẫn chứng từ nguồn chính thống</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16.3-black?style=flat-square&logo=next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript" />
  <img src="https://img.shields.io/badge/FPT_AI-Qwen3_|_DeepSeek-red?style=flat-square" />
  <img src="https://img.shields.io/badge/License-Private-gray?style=flat-square" />
</p>

---

## 📋 Tổng Quan

SaoMai AI là công cụ hỗ trợ công tác tư tưởng, sử dụng trí tuệ nhân tạo để:

1. **Nhận diện xuyên tạc** — Phân tích văn bản, bóc tách từng luận điểm thù địch với 10 dạng phân loại chuyên sâu
2. **Tìm nguồn chính thống** — Tự động tìm kiếm bài báo từ nguồn tin chính thống (nhandan.vn, baochinhphu.vn, qdnd.vn...)
3. **Viết bài phản biện** — Tạo bài phản biện có dẫn chứng, lập luận đanh thép, sử dụng lý luận chính trị
4. **Chat AI** — Hỏi đáp trực tiếp về nhận diện và phản biện thông tin sai lệch
5. **Knowledge Base (RAG)** — Upload tài liệu để AI tham khảo khi phân tích

---

## 🏗️ Kiến Trúc Hệ Thống

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Chat Page   │  │ Analyze Page │  │  Knowledge Page  │  │
│  │  (Streaming) │  │ (3-step AI)  │  │  (Upload/CRUD)   │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
└─────────┼─────────────────┼───────────────────┼─────────────┘
          │                 │                   │
          ▼                 ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Routes (Next.js)                   │
│  /api/chat          /api/analyze         /api/documents     │
└─────┬───────────────────┬───────────────────┬───────────────┘
      │                   │                   │
      ▼                   ▼                   ▼
┌───────────┐   ┌──────────────────┐   ┌──────────────┐
│  FPT AI   │   │  Misinformation  │   │  Vector Store│
│  Chat API │   │    Detector      │   │  (SQLite)    │
│ (Qwen3.6) │   │  (DeepSeek-V4)   │   │              │
└───────────┘   └──────────────────┘   └──────────────┘
                        │
              ┌─────────┼─────────┐
              ▼         ▼         ▼
        ┌─────────┐ ┌───────┐ ┌────────┐
        │Web Search│ │  RAG  │ │Rebuttal│
        │DuckDuckGo│ │Vector │ │  Gen   │
        └─────────┘ └───────┘ └────────┘
```

### Multi-Model Strategy

| Model | Vai trò | Mục đích |
|-------|---------|----------|
| **DeepSeek-V4-Flash** | Phân tích sâu | Nhận diện xuyên tạc (reasoning mode) |
| **Qwen3.6-27B** | Chat & Rebuttal | Trả lời nhanh, viết bài phản biện |
| **Vietnamese_Embedding** | Embedding | Vector hóa tài liệu cho RAG |

---

## 🚀 Cài Đặt & Chạy

### Yêu Cầu

- **Node.js** >= 18
- **npm** >= 9
- **FPT AI API Key** (đăng ký tại [FPT AI Marketplace](https://marketplace.fptcloud.com/))

### 1. Clone & Install

```bash
git clone https://github.com/phamkhoa18/ai-chinhtri.git
cd ai-chinhtri
npm install
```

### 2. Cấu Hình Environment

Tạo file `.env.local`:

```env
# FPT AI Configuration
FPT_API_KEY=your_fpt_api_key_here
FPT_API_BASE_URL=https://mkp-api.fptcloud.com/v1
FPT_CHAT_MODEL=Qwen3.6-27B
FPT_ANALYSIS_MODEL=DeepSeek-V4-Flash
FPT_EMBEDDING_MODEL=Vietnamese_Embedding

# Base URL (cho SEO, thay bằng domain thật khi deploy)
NEXT_PUBLIC_BASE_URL=https://your-domain.com
```

### 3. Chạy Development

```bash
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000) để sử dụng.

### 4. Build Production

```bash
npm run build
npm start
```

---

## 📁 Cấu Trúc Thư Mục

```
src/
├── app/
│   ├── api/
│   │   ├── analyze/route.ts      # API phân tích xuyên tạc (3-step pipeline)
│   │   ├── chat/route.ts         # API chat streaming (SSE + RAG)
│   │   └── documents/route.ts    # API CRUD tài liệu knowledge base
│   ├── chat/
│   │   ├── layout.tsx            # SEO metadata cho trang chat
│   │   └── page.tsx              # Trang chat & phân tích chính
│   ├── knowledge/
│   │   ├── layout.tsx            # SEO metadata cho trang tri thức
│   │   └── page.tsx              # Quản lý knowledge base
│   ├── layout.tsx                # Root layout + SEO toàn cục
│   ├── globals.css               # Design system & animations
│   ├── robots.ts                 # SEO robots.txt
│   └── sitemap.ts                # SEO sitemap.xml
├── components/
│   ├── Sidebar.tsx               # Navigation sidebar (responsive)
│   ├── Markdown.tsx              # Markdown renderer cho chat
│   └── ui/                       # shadcn/ui components
└── lib/
    ├── misinformation-detector.ts # Pipeline 3 bước: detect → search → rebuttal
    ├── fpt-ai.ts                  # FPT AI SDK wrapper (chat, analysis, embedding)
    ├── vector-store.ts            # SQLite vector store (cosine similarity)
    ├── text-chunker.ts            # Text chunking + file parser (PDF, DOCX)
    ├── web-search.ts              # DuckDuckGo web search + page scraper
    ├── chat-history.ts            # Lịch sử chat (localStorage, max 50)
    └── utils.ts                   # Utilities
```

---

## ⚙️ Pipeline Phân Tích (3 bước)

### Bước 1: Nhận Diện Xuyên Tạc

- Model: **DeepSeek-V4-Flash** (reasoning mode)
- Pre-processing: Phát hiện tên tác giả/tổ chức phản động + ngôn ngữ thù địch
- Output: Danh sách claims với severity (high/medium/low)
- 10 dạng phân loại: Phủ nhận CNXH, Bôi nhọ lãnh đạo, Giả danh khách quan, v.v.

### Bước 2: Tìm Bằng Chứng

- **Web Search**: DuckDuckGo → tìm bài báo chính thống phản bác
- **RAG**: Tìm context từ Knowledge Base (SQLite + cosine similarity)
- Fallback queries nếu AI không tạo được search query

### Bước 3: Viết Phản Biện

- Model: **Qwen3.6-27B**
- Input: Claims + Sources + RAG context
- Quy tắc: CHỈ trích dẫn nguồn thật (có URL), KHÔNG bịa

---

## 🔧 Tech Stack

| Công nghệ | Phiên bản | Vai trò |
|-----------|-----------|---------|
| Next.js | 16.3.2 | Framework fullstack |
| React | 19.2.8 | UI library |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 4.x | Styling |
| shadcn/ui | 4.19 | UI components |
| better-sqlite3 | 13.x | Vector database |
| OpenAI SDK | 7.x | FPT AI client |
| pdf-parse | 2.x | PDF extraction |
| mammoth | 1.x | DOCX extraction |
| react-markdown | 10.x | Markdown rendering |

---

## 📱 Tính Năng

- ✅ **Phân tích xuyên tạc** — AI nhận diện từng luận điểm
- ✅ **Chat AI streaming** — Hỏi đáp realtime (SSE)
- ✅ **Knowledge Base** — Upload PDF/DOCX/TXT, RAG search
- ✅ **Lịch sử chat** — Lưu localStorage, tối đa 50 cuộc trò chuyện
- ✅ **Responsive UI** — Mobile-first, safe-area iOS support
- ✅ **SEO chuẩn** — Open Graph, Twitter Card, sitemap, robots.txt, PWA manifest
- ✅ **Web search** — Tự động tìm nguồn chính thống
- ✅ **Copy phản biện** — Copy bài phản biện 1 click

---

## 📄 License

Private — Sử dụng nội bộ.
