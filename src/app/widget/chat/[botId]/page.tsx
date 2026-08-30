"use client";

import { useState, useRef, useEffect, useCallback, use } from "react";
import { Send, Loader2, X, Sparkles } from "lucide-react";
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
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load bot config
  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch(`/api/bots/${botId}`);
        if (!res.ok) {
          setError("Bot không tồn tại hoặc đã bị xóa.");
          return;
        }
        const data = await res.json();
        setBotConfig(data);
      } catch {
        setError("Không thể kết nối server.");
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
      el.style.height = Math.min(el.scrollHeight, 120) + "px";
    }
  }, [input]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: "user", content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
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
        body: JSON.stringify({ botId, messages: chatMessages }),
      });

      if (!res.ok || !res.headers.get("content-type")?.includes("text/event-stream")) {
        let errMsg = "Lỗi kết nối";
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

  const themeColor = botConfig?.theme_color || "#DC2626";

  // Error state
  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-6 text-center bg-gradient-to-br from-stone-50 to-stone-100">
        <div>
          <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <X className="w-7 h-7 text-red-400" />
          </div>
          <p className="text-sm text-stone-600 font-medium mb-1">Không thể kết nối</p>
          <p className="text-xs text-stone-400">{error}</p>
        </div>
      </div>
    );
  }

  // Loading config
  if (!botConfig) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-stone-50 to-stone-100">
        <div className="text-center">
          <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center mx-auto mb-3">
            <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
          </div>
          <p className="text-xs text-stone-400">Đang kết nối...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ "--widget-color": themeColor, "--widget-color-light": themeColor + "15" } as React.CSSProperties}
    >
      {/* ────── Header — Gradient, modern ────── */}
      <header
        className="shrink-0 relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}dd)` }}
      >
        {/* Decorative circles */}
        <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full opacity-10 bg-white" />
        <div className="absolute -bottom-3 -left-3 w-12 h-12 rounded-full opacity-10 bg-white" />

        <div className="relative px-4 py-3.5 flex items-center gap-3">
          {/* Avatar */}
          <div className="relative">
            {botConfig.avatar_url ? (
              <img
                src={botConfig.avatar_url}
                alt={botConfig.name}
                className="w-9 h-9 rounded-xl object-cover ring-2 ring-white/20"
              />
            ) : (
              <div className="w-9 h-9 rounded-xl overflow-hidden shadow-sm">
                <img src="/saomai-logo.jpg" alt="SaoMai AI" className="w-full h-full object-cover" />
              </div>
            )}
            {/* Online dot */}
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-400 border-2 border-white/80 shadow-sm" />
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-semibold text-white truncate tracking-tight">
              {botConfig.name}
            </h1>
            <p className="text-[10px] text-white/70 flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              Trợ lý AI chuyên biệt
            </p>
          </div>
        </div>
      </header>

      {/* ────── Messages ────── */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3" style={{ background: "linear-gradient(180deg, #fafaf9 0%, #f5f5f4 100%)" }}>
        {/* Welcome / Greeting */}
        {messages.length === 0 && (
          <div className="pt-4 pb-2">
            {/* Greeting bubble */}
            <div className="flex gap-2.5 mb-4">
              <div className="w-7 h-7 rounded-lg shrink-0 overflow-hidden mt-0.5 shadow-sm">
                <img src="/saomai-logo.jpg" alt="SaoMai AI" className="w-full h-full object-cover" />
              </div>
              <div className="bg-white rounded-2xl rounded-tl-lg px-3.5 py-2.5 text-[13px] text-stone-600 shadow-sm border border-stone-100/80 max-w-[85%] leading-relaxed">
                {botConfig.greeting}
              </div>
            </div>

            {/* Quick suggestions */}
            <div className="pl-9 space-y-1.5">
              {[
                "Kiểm tra thông tin xuyên tạc",
                "Chính sách mới nhất",
                "Phản biện tin giả",
              ].map((text) => (
                <button
                  key={text}
                  onClick={() => {
                    setInput(text);
                    textareaRef.current?.focus();
                  }}
                  className="block w-fit text-[11px] px-3 py-1.5 rounded-full border border-stone-200 text-stone-500 hover:text-stone-700 hover:border-stone-300 hover:bg-white transition-all duration-200"
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chat messages */}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "gap-2.5"}`}
          >
            {/* Bot avatar */}
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-lg shrink-0 overflow-hidden mt-0.5 shadow-sm">
                <img src="/saomai-logo.jpg" alt="SaoMai AI" className="w-full h-full object-cover" />
              </div>
            )}

            {/* Message bubble */}
            <div
              className={`rounded-2xl px-3.5 py-2.5 text-[13px] max-w-[82%] break-words whitespace-pre-wrap leading-relaxed ${
                msg.role === "user"
                  ? "rounded-tr-lg text-white shadow-md"
                  : "rounded-tl-lg bg-white text-stone-600 shadow-sm border border-stone-100/80"
              }`}
              style={
                msg.role === "user"
                  ? { background: `linear-gradient(135deg, ${themeColor}, ${themeColor}dd)` }
                  : undefined
              }
            >
              {msg.role === "assistant" ? (
                <Markdown content={msg.content} />
              ) : (
                msg.content
              )}

              {/* Typing dots */}
              {msg.isStreaming && !msg.content && (
                <div className="flex gap-1.5 py-1 px-0.5">
                  <span
                    className="w-2 h-2 rounded-full animate-bounce"
                    style={{ backgroundColor: themeColor + "60", animationDelay: "0ms" }}
                  />
                  <span
                    className="w-2 h-2 rounded-full animate-bounce"
                    style={{ backgroundColor: themeColor + "60", animationDelay: "150ms" }}
                  />
                  <span
                    className="w-2 h-2 rounded-full animate-bounce"
                    style={{ backgroundColor: themeColor + "60", animationDelay: "300ms" }}
                  />
                </div>
              )}

              {/* Streaming cursor */}
              {msg.isStreaming && msg.content && (
                <span
                  className="inline-block w-0.5 h-3.5 animate-pulse ml-0.5 align-text-bottom rounded-full"
                  style={{ backgroundColor: themeColor, opacity: 0.5 }}
                />
              )}
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* ────── Input ────── */}
      <div className="shrink-0 bg-white border-t border-stone-100 p-2.5">
        <div className="flex items-end gap-2 bg-stone-50/80 rounded-xl border border-stone-200/60 p-1 focus-within:border-stone-300 focus-within:bg-white transition-all duration-200">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Nhập câu hỏi..."
            className="flex-1 resize-none bg-transparent px-2.5 py-2 text-[13px] text-stone-700 placeholder:text-stone-400 outline-none min-h-[34px] max-h-[120px]"
            rows={1}
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white disabled:opacity-30 transition-all duration-200 hover:shadow-md active:scale-95"
            style={{ background: !input.trim() || isLoading ? "#d1d5db" : `linear-gradient(135deg, ${themeColor}, ${themeColor}dd)` }}
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
        {/* Powered by */}
        <p className="text-center text-[9px] text-stone-300 mt-1.5 tracking-wide">
          Powered by SaoMai AI
        </p>
      </div>
    </div>
  );
}
