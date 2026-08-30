"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bot,
  Plus,
  Copy,
  Check,
  Trash2,
  Code2,
  Palette,
  MessageSquare,
  Globe,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Settings2,
  ExternalLink,
  FileCode2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface BotConfig {
  id: string;
  name: string;
  greeting: string;
  system_prompt: string | null;
  theme_color: string;
  position: string;
  avatar_url: string | null;
  allowed_domains: string;
  created_at: string;
  updated_at: string;
}

const DEFAULT_COLORS = [
  "#DC2626", "#E11D48", "#9333EA", "#6366F1",
  "#2563EB", "#0891B2", "#059669", "#CA8A04",
  "#EA580C", "#171717",
];

const DEFAULT_PROMPT = `Bạn là SaoMai AI - trợ lý AI chuyên phân tích và phản biện thông tin xuyên tạc tại Việt Nam.

Nhiệm vụ chính:
1. Nhận diện thông tin xuyên tạc, bóp méo sự thật
2. Phản biện bằng logic và dẫn chứng
3. Giáo dục người dùng về cách nhận biết tin giả

Phong cách:
- Trả lời bằng tiếng Việt
- Chuyên nghiệp, khách quan, có lý lẽ
- Trích dẫn nguồn khi có thể
- Ngắn gọn, đi thẳng vào vấn đề`;

export default function BotsPage() {
  const [bots, setBots] = useState<BotConfig[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formGreeting, setFormGreeting] = useState(
    "Xin chào! Tôi là SaoMai AI. Tôi có thể giúp gì cho bạn?"
  );
  const [formPrompt, setFormPrompt] = useState(DEFAULT_PROMPT);
  const [formColor, setFormColor] = useState("#DC2626");
  const [formDomains, setFormDomains] = useState("*");

  const fetchBots = useCallback(async () => {
    try {
      const res = await fetch("/api/bots");
      if (!res.ok) return;
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) return;
      const data = await res.json();
      setBots(data.bots || []);
    } catch {
      console.error("Failed to fetch bots");
    }
  }, []);

  useEffect(() => {
    fetchBots();
  }, [fetchBots]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleCreate = async () => {
    if (!formName.trim()) return;
    setIsCreating(true);

    try {
      const domains = formDomains
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean);

      const res = await fetch("/api/bots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          greeting: formGreeting,
          system_prompt: formPrompt,
          theme_color: formColor,
          allowed_domains: domains,
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error("Server không phản hồi");
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi tạo bot");

      setNotification({ type: "success", message: data.message });
      setShowCreate(false);
      resetForm();
      fetchBots();
    } catch (error) {
      setNotification({
        type: "error",
        message: (error as Error).message,
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      const res = await fetch("/api/bots", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("Lỗi xóa bot");
      setNotification({ type: "success", message: `Đã xóa "${name}"` });
      fetchBots();
    } catch (error) {
      setNotification({
        type: "error",
        message: (error as Error).message || "Không thể xóa bot",
      });
    }
  };

  const resetForm = () => {
    setFormName("");
    setFormGreeting(
      "Xin chào! Tôi là SaoMai AI. Tôi có thể giúp gì cho bạn?"
    );
    setFormPrompt(DEFAULT_PROMPT);
    setFormColor("#DC2626");
    setFormDomains("*");
  };

  const getEmbedCode = (botId: string) => {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "https://saomai.ai";
    return `<!-- SaoMai AI Widget -->\n<script src="${origin}/widget/embed.js" data-bot-id="${botId}"></script>`;
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Notification Toast */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 animate-slide-in-right flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
            notification.type === "success"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          {notification.message}
        </div>
      )}

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-3 py-6 md:px-5 md:py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-1.5">
              <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center">
                <Code2 className="w-5 h-5 text-purple-600" />
              </div>
              <h1 className="text-lg font-semibold text-stone-800">
                Chatbot Widget
              </h1>
            </div>
            <p className="text-sm text-stone-400 pl-12">
              Tạo chatbot và nhúng vào website bất kỳ bằng 1 dòng script
            </p>
          </div>

          {/* Create Button */}
          {!showCreate && (
            <button
              onClick={() => setShowCreate(true)}
              className="w-full rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50/50 hover:border-purple-300 hover:bg-purple-50/30 transition-all p-6 text-center group mb-8"
            >
              <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-stone-200 group-hover:border-purple-200 flex items-center justify-center mx-auto mb-3 transition-colors">
                <Plus className="w-5 h-5 text-purple-500" />
              </div>
              <p className="text-sm font-semibold text-stone-700 mb-1">
                Tạo Bot Mới
              </p>
              <p className="text-xs text-stone-400">
                Chỉ vài bước để có chatbot trên website của bạn
              </p>
            </button>
          )}

          {/* Create Form */}
          {showCreate && (
            <div className="rounded-2xl border border-purple-200 bg-white p-5 mb-8 animate-fade-in-up">
              <div className="flex items-center gap-2 mb-5">
                <Sparkles className="w-5 h-5 text-purple-500" />
                <h2 className="text-sm font-semibold text-stone-800">
                  Tạo Bot Mới
                </h2>
              </div>

              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-600 mb-1.5">
                    <Bot className="w-3.5 h-3.5" />
                    Tên Bot *
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="VD: Bot hỗ trợ trang tin"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-300 transition-all"
                  />
                </div>

                {/* Greeting */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-600 mb-1.5">
                    <MessageSquare className="w-3.5 h-3.5" />
                    Lời chào
                  </label>
                  <input
                    type="text"
                    value={formGreeting}
                    onChange={(e) => setFormGreeting(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-300 transition-all"
                  />
                </div>

                {/* System Prompt */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-600 mb-1.5">
                    <Settings2 className="w-3.5 h-3.5" />
                    System Prompt
                  </label>
                  <textarea
                    value={formPrompt}
                    onChange={(e) => setFormPrompt(e.target.value)}
                    rows={5}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-300 transition-all resize-none"
                  />
                  <p className="text-[10px] text-stone-400 mt-1">
                    Mặc định: chống xuyên tạc. Bạn có thể thay đổi tùy ý.
                  </p>
                </div>

                {/* Theme Color */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-600 mb-1.5">
                    <Palette className="w-3.5 h-3.5" />
                    Màu theme
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DEFAULT_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setFormColor(color)}
                        className={`w-8 h-8 rounded-lg transition-all ${
                          formColor === color
                            ? "ring-2 ring-offset-2 ring-stone-400 scale-110"
                            : "hover:scale-105"
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                {/* Allowed Domains */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-600 mb-1.5">
                    <Globe className="w-3.5 h-3.5" />
                    Domain cho phép
                  </label>
                  <input
                    type="text"
                    value={formDomains}
                    onChange={(e) => setFormDomains(e.target.value)}
                    placeholder="* (tất cả) hoặc example.com, *.example.com"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-300 transition-all"
                  />
                  <p className="text-[10px] text-stone-400 mt-1">
                    Dùng * để cho phép tất cả. Phân cách bằng dấu phẩy.
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    onClick={handleCreate}
                    disabled={!formName.trim() || isCreating}
                    className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl"
                  >
                    {isCreating ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                    ) : (
                      <Plus className="w-4 h-4 mr-1.5" />
                    )}
                    Tạo Bot
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowCreate(false);
                      resetForm();
                    }}
                    className="rounded-xl text-stone-500"
                  >
                    Hủy
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Separator */}
          <div className="border-t border-stone-100 mb-6" />

          {/* Bot List */}
          <div className="mb-4 flex items-center gap-2">
            <Bot className="w-4 h-4 text-stone-400" />
            <h2 className="text-sm font-semibold text-stone-700">
              Bot đã tạo
            </h2>
            <Badge className="bg-stone-100 text-stone-500 text-[10px] border-0">
              {bots.length}
            </Badge>
          </div>

          {bots.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-stone-200 py-14 text-center">
              <Bot className="w-10 h-10 text-stone-300 mx-auto mb-3" />
              <p className="text-sm text-stone-400 font-medium">
                Chưa có bot nào
              </p>
              <p className="text-xs text-stone-400/80 mt-0.5">
                Nhấn &quot;Tạo Bot Mới&quot; ở trên để bắt đầu
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {bots.map((bot, index) => (
                <div
                  key={bot.id}
                  className="animate-fade-in-up rounded-2xl border border-stone-200 bg-white overflow-hidden"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {/* Bot header */}
                  <div className="p-4 flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0"
                      style={{ backgroundColor: bot.theme_color }}
                    >
                      {bot.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-stone-700 truncate">
                          {bot.name}
                        </p>
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: bot.theme_color }}
                        />
                      </div>
                      <p className="text-xs text-stone-400 mt-0.5 truncate">
                        {bot.greeting}
                      </p>
                      <p className="text-[10px] text-stone-400 mt-1">
                        Tạo: {formatDate(bot.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <a
                        href={`/widget/chat/${bot.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                        title="Xem trước"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <button
                        onClick={() => handleDelete(bot.id, bot.name)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Xóa"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Embed code */}
                  <div className="border-t border-stone-100 px-4 py-3 bg-stone-50/50">
                    <div className="flex items-center gap-2 mb-2">
                      <FileCode2 className="w-3.5 h-3.5 text-stone-400" />
                      <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider">
                        Embed Code
                      </span>
                    </div>
                    <div className="relative">
                      <pre className="text-[11px] text-stone-600 bg-stone-900 text-stone-300 rounded-lg px-3 py-2.5 overflow-x-auto whitespace-pre-wrap break-all font-mono">
                        {getEmbedCode(bot.id)}
                      </pre>
                      <button
                        onClick={() =>
                          handleCopy(getEmbedCode(bot.id), bot.id)
                        }
                        className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-md bg-stone-700 hover:bg-stone-600 text-stone-300 text-[10px] font-medium transition-colors"
                      >
                        {copied === bot.id ? (
                          <>
                            <Check className="w-3 h-3" />
                            Đã copy!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-[10px] text-stone-400 mt-1.5">
                      Dán đoạn code trên vào thẻ{" "}
                      <code className="bg-stone-200 px-1 rounded text-stone-600">
                        &lt;body&gt;
                      </code>{" "}
                      của website bạn
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
