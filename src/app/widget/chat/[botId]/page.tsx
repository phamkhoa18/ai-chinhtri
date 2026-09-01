"use client";

import { useState, useRef, useEffect, useCallback, use } from "react";
import { Send, Loader2, X, RotateCcw, Copy, Check, Sparkles, ShieldCheck, ChevronRight, Zap } from "lucide-react";
import { Markdown } from "@/components/Markdown";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

interface BotPublicConfig {
  id: string;
  name: string;
  greeting: string;
  theme_color: string;
  avatar_url: string | null;
}

const DEFAULT_CONFIG: BotPublicConfig = {
  id: "default",
  name: "SaoMai AI",
  greeting: "Xin chào! Tôi là Trợ lý AI SaoMai — chuyên biệt về bảo vệ nền tảng tư tưởng và cung cấp thông tin chính sách chuẩn xác. Tôi có thể giúp gì cho bạn hôm nay?",
  theme_color: "#DC2626",
  avatar_url: "/widget/mascot-clean-bot.svg",
};

const QUICK_PROMPTS = [
  { icon: "🛡️", title: "Phản bác tin sai lệch", desc: "Cách nhận diện & phản biện thông tin xuyên tạc" },
  { icon: "📜", title: "Nghị quyết & Chính sách", desc: "Tóm tắt các văn kiện, chủ trương mới nhất" },
  { icon: "⚖️", title: "Pháp luật an ninh mạng", desc: "Quy định bảo vệ dữ liệu & thông tin chính trị" },
];

export default function WidgetChatPage({
  params,
}: {
  params: Promise<{ botId: string }>;
}) {
  const { botId } = use(params);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [botConfig, setBotConfig] = useState<BotPublicConfig | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load bot config
  useEffect(() => {
    async function loadConfig() {
      if (!botId || botId === "default") {
        setBotConfig(DEFAULT_CONFIG);
        return;
      }
      try {
        const res = await fetch(`/api/bots/${botId}`);
        if (!res.ok) {
          setBotConfig(DEFAULT_CONFIG);
          return;
        }
        const data = await res.json();
        setBotConfig({
          ...data,
          avatar_url: data.avatar_url || "/widget/mascot-clean-bot.svg",
        });
      } catch {
        setBotConfig(DEFAULT_CONFIG);
      }
    }
    loadConfig();
  }, [botId]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "0px";
      el.style.height = Math.min(el.scrollHeight, 80) + "px";
    }
  }, [input]);

  const handleSend = async (customText?: string) => {
    const textToSend = (customText || input).trim();
    if (!textToSend || isLoading) return;

    const userMessage: ChatMessage = { role: "user", content: textToSend };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    if (!customText) setInput("");
    setIsLoading(true);
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "", isStreaming: true },
    ]);

    try {
      const chatMessages = newMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/widget/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botId: botId || "default", messages: chatMessages }),
      });

      if (!res.ok || !res.headers.get("content-type")?.includes("text/event-stream")) {
        let errMsg = "Lỗi kết nối máy chủ";
        try {
          const errData = await res.json();
          errMsg = errData.error || errMsg;
        } catch { /* not json */ }
        throw new Error(errMsg);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value, { stream: true });
          for (const line of text.split("\n")) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") break;
              try {
                const parsed = JSON.parse(data);
                if (parsed.error) throw new Error(parsed.error);
                fullContent += parsed.content || "";
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last?.isStreaming) {
                    updated[updated.length - 1] = { ...last, content: fullContent };
                  }
                  return updated;
                });
              } catch {
                /* skip */
              }
            }
          }
        }
      }

      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last) updated[updated.length - 1] = { ...last, isStreaming: false };
        return updated;
      });
    } catch (err) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: `Xin lỗi, đã có lỗi xảy ra: ${(err as Error).message}`,
        };
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleClearChat = () => {
    if (messages.length > 0 && !isLoading) {
      setMessages([]);
    }
  };

  const handleClose = () => {
    if (window.parent) {
      window.parent.postMessage({ type: "SAOMAI_CLOSE_WIDGET" }, "*");
    }
  };

  const avatarUrl = botConfig?.avatar_url || "/widget/mascot-clean-bot.svg";

  if (!botConfig) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <div className="text-center p-4">
          <div className="w-10 h-10 rounded-2xl bg-white shadow-md border border-slate-150 flex items-center justify-center mx-auto mb-2">
            <Loader2 className="w-5 h-5 animate-spin text-red-600" />
          </div>
          <p className="text-[11px] text-slate-500 font-medium">Đang khởi động...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gradient-to-b from-[#F8FAFC] to-[#EEF2F6] text-slate-800 antialiased font-sans select-none relative">
      {/* 🌸 Ambient Luminous Accents (Tông Sáng Sang Trọng) 🌸 */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-red-500/[0.07] rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-0 w-40 h-40 bg-amber-400/[0.08] rounded-full blur-3xl pointer-events-none" />

      {/* ────── Luxury Light Header ────── */}
      <header className="shrink-0 px-3.5 py-2.5 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 flex items-center justify-between z-10 relative shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Avatar - To rõ, sắc nét, không bị đóng khung */}
          <div className="relative shrink-0 w-11 h-11 flex items-center justify-center">
            <img
              src={avatarUrl}
              alt="SaoMai AI"
              className="w-full h-full object-contain filter-none"
            />
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow-xs" />
          </div>

          {/* Info */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-[13px] font-bold text-slate-900 tracking-tight truncate">
                {botConfig.name}
              </h1>
              <span className="text-[9px] bg-red-50 text-red-700 font-semibold px-1.5 py-0.2 rounded-full border border-red-200/60 flex items-center gap-0.5">
                <ShieldCheck className="w-2.5 h-2.5 text-red-600" />
                Chính quy
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-medium flex items-center gap-1 mt-0.5 truncate">
              <Zap className="w-2.5 h-2.5 text-amber-500 shrink-0" />
              Trợ lý AI Bảo vệ nền tảng tư tưởng
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {messages.length > 0 && (
            <button
              onClick={handleClearChat}
              title="Làm mới cuộc trò chuyện"
              className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={handleClose}
            title="Thu nhỏ"
            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-all"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* ────── Messages Stream ────── */}
      <div className="flex-1 overflow-y-auto px-3.5 py-3.5 space-y-3.5 select-text z-10 relative">
        {/* Welcome Card & Interactive Chips */}
        {messages.length === 0 && (
          <div className="space-y-3.5 pt-1">
            {/* Assistant Welcome Card */}
            <div className="flex gap-2.5 items-start">
              <img
                src={avatarUrl}
                alt="SaoMai"
                className="w-8 h-8 object-contain shrink-0 mt-0.5"
              />
              <div className="bg-white rounded-2xl rounded-tl-xs p-3.5 text-[12.5px] text-slate-700 leading-relaxed border border-slate-200/70 shadow-[0_4px_16px_rgba(0,0,0,0.04)] max-w-[88%] space-y-1.5">
                <div className="flex items-center gap-1.5 text-red-600 font-semibold text-[11.5px]">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Kính chào Quý độc giả!</span>
                </div>
                <p className="text-slate-600">{botConfig.greeting}</p>
              </div>
            </div>

            {/* Quick Suggestion Chips */}
            <div className="pl-9 space-y-1.5 pt-1">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Gợi ý chủ đề tra cứu:
              </p>
              <div className="space-y-1.5">
                {QUICK_PROMPTS.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(`${item.title}: ${item.desc}`)}
                    className="w-full text-left p-2.5 rounded-xl bg-white hover:bg-red-50/60 active:bg-red-100/60 border border-slate-200/70 hover:border-red-200 text-slate-700 transition-all duration-150 flex items-center justify-between group shadow-2xs active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <span className="text-sm shrink-0 bg-slate-50 p-1.5 rounded-lg border border-slate-100">{item.icon}</span>
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold text-slate-800 group-hover:text-red-700 transition-colors truncate">
                          {item.title}
                        </p>
                        <p className="text-[10.5px] text-slate-500 truncate">
                          {item.desc}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-red-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Conversation History */}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start gap-2.5 items-start"}`}
          >
            {/* Assistant Avatar */}
            {msg.role === "assistant" && (
              <img
                src={avatarUrl}
                alt="SaoMai"
                className="w-7 h-7 object-contain shrink-0 mt-0.5"
              />
            )}

            {/* Bubble */}
            <div className="relative group max-w-[85%]">
              <div
                className={`px-3.5 py-2.5 text-[12.5px] break-words leading-relaxed ${
                  msg.role === "user"
                    ? "rounded-2xl rounded-tr-xs bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white shadow-[0_4px_14px_rgba(220,38,38,0.25)]"
                    : "rounded-2xl rounded-tl-xs bg-white text-slate-800 shadow-[0_4px_16px_rgba(0,0,0,0.04)] border border-slate-200/70"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-slate max-w-none text-[12.5px] leading-relaxed">
                    <Markdown content={msg.content} />
                  </div>
                ) : (
                  <span className="whitespace-pre-wrap">{msg.content}</span>
                )}

                {/* Streaming Wave */}
                {msg.isStreaming && !msg.content && (
                  <div className="flex items-center gap-1.5 py-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                )}

                {/* Blinking cursor */}
                {msg.isStreaming && msg.content && (
                  <span className="inline-block w-1.5 h-3.5 ml-1 bg-red-600 animate-pulse align-middle rounded-xs" />
                )}
              </div>

              {/* Copy button on hover */}
              {msg.role === "assistant" && !msg.isStreaming && msg.content && (
                <button
                  onClick={() => handleCopy(msg.content, i)}
                  title="Sao chép câu trả lời"
                  className="absolute -bottom-2 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white border border-slate-200 shadow-md rounded-md p-1 text-slate-400 hover:text-slate-700 active:scale-90"
                >
                  {copiedIndex === i ? (
                    <Check className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              )}
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* ────── Seamless Clean Input Bar (Đồng bộ, Không viền thô) ────── */}
      <div className="shrink-0 bg-white/80 backdrop-blur-xl border-t border-slate-100 p-2.5 z-10 relative">
        <div className="flex items-center gap-2 bg-slate-100/90 rounded-full px-3.5 py-1.5 transition-all">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Hỏi đáp về chủ trương, chính sách, tư tưởng..."
            className="flex-1 resize-none bg-transparent py-1 text-[12.5px] text-slate-800 placeholder:text-slate-400 outline-none border-none ring-0 shadow-none min-h-[28px] max-h-[85px] leading-relaxed"
            rows={1}
            disabled={isLoading}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all duration-200 ${
              !input.trim() || isLoading
                ? "bg-slate-200/80 text-slate-400 cursor-not-allowed"
                : "bg-red-600 hover:bg-red-700 text-white shadow-xs active:scale-95 cursor-pointer"
            }`}
          >
            {isLoading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Send className="w-3 h-3" />
            )}
          </button>
        </div>

        {/* Footer Brand */}
        <div className="flex items-center justify-center gap-1.5 mt-1.5 text-[9.5px] text-slate-400 font-medium tracking-wide">
          <span>SaoMai AI</span>
          <span>•</span>
          <span>Hệ thống Trí tuệ Nhân tạo Việt Nam</span>
        </div>
      </div>
    </div>
  );
}
