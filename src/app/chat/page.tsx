"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import {
  Send,
  AlertTriangle,
  ExternalLink,
  FileText,
  Copy,
  Check,
  Loader2,
  Search,
  PenLine,
  Sparkles,
  Star,
  TriangleAlert,
  CircleAlert,
  Info,
  Plus,
  History,
  Trash2,
  X,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Markdown } from "@/components/Markdown";
import {
  listConversations,
  getConversation,
  saveConversation,
  deleteConversation,
  createConversation,
  type ChatConversation,
  type ChatMessageData,
} from "@/lib/chat-history";

interface DetectedClaim {
  claim: string;
  tactic: string;
  reason: string;
  impact: string;
  severity: "high" | "medium" | "low";
}

interface SourceEvidence {
  title: string;
  url: string;
  snippet: string;
  relevance: string;
}

interface AnalysisResult {
  claims: DetectedClaim[];
  sources: SourceEvidence[];
  rebuttal: string;
  ragContext: string[];
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  analysis?: AnalysisResult;
  isStreaming?: boolean;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisPhase, setAnalysisPhase] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [mode, setMode] = useState<"analyze" | "chat">("analyze");
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load conversations list on mount
  useEffect(() => {
    setConversations(listConversations());
  }, []);

  // Save messages to current conversation whenever messages change
  useEffect(() => {
    if (!currentConversationId || messages.length === 0) return;
    // Don't save if last message is still streaming
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.isStreaming) return;

    const conv = getConversation(currentConversationId);
    if (conv) {
      conv.messages = messages.map((m) => ({
        role: m.role,
        content: m.content,
        analysis: m.analysis,
      }));
      conv.mode = mode;
      saveConversation(conv);
      setConversations(listConversations());
    }
  }, [messages, currentConversationId, mode]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, analysisPhase, scrollToBottom]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "0px";
      el.style.height = Math.min(el.scrollHeight, 200) + "px";
    }
  }, [input]);

  const startNewConversation = useCallback(() => {
    const conv = createConversation(mode);
    saveConversation(conv);
    setCurrentConversationId(conv.id);
    setMessages([]);
    setConversations(listConversations());
    setShowHistory(false);
  }, [mode]);

  const loadConversation = useCallback((conv: ChatConversation) => {
    setCurrentConversationId(conv.id);
    setMode(conv.mode);
    setMessages(
      conv.messages.map((m) => ({
        role: m.role,
        content: m.content,
        analysis: m.analysis,
      }))
    );
    setShowHistory(false);
  }, []);

  const handleDeleteConversation = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      deleteConversation(id);
      const updated = listConversations();
      setConversations(updated);
      if (currentConversationId === id) {
        if (updated.length > 0) {
          loadConversation(updated[0]);
        } else {
          setCurrentConversationId(null);
          setMessages([]);
        }
      }
    },
    [currentConversationId, loadConversation]
  );

  const ensureConversation = useCallback(() => {
    if (!currentConversationId) {
      const conv = createConversation(mode);
      saveConversation(conv);
      setCurrentConversationId(conv.id);
      setConversations(listConversations());
      return conv.id;
    }
    return currentConversationId;
  }, [currentConversationId, mode]);

  const handleAnalyze = async () => {
    if (!input.trim() || isAnalyzing) return;
    ensureConversation();
    const userMessage: ChatMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsAnalyzing(true);

    try {
      setAnalysisPhase("detecting");
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input }),
      });

      // Check content-type to avoid parsing HTML as JSON
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error("Server không phản hồi — vui lòng thử lại sau.");
      }

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Lỗi phân tích");
      }
      const result: AnalysisResult = await res.json();
      setAnalysisPhase("");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: result.rebuttal, analysis: result },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Lỗi: ${(error as Error).message}` },
      ]);
    } finally {
      setIsAnalyzing(false);
      setAnalysisPhase("");
    }
  };

  const handleChat = async () => {
    if (!input.trim() || isAnalyzing) return;
    ensureConversation();
    const userMessage: ChatMessage = { role: "user", content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsAnalyzing(true);
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "", isStreaming: true },
    ]);

    try {
      const chatMessages = newMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: chatMessages }),
      });
      if (!res.ok || !res.headers.get("content-type")?.includes("text/event-stream")) {
        throw new Error("Server không phản hồi — vui lòng thử lại sau.");
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
    } catch (error) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: `Lỗi: ${(error as Error).message}`,
        };
        return updated;
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = () => {
    if (mode === "analyze") handleAnalyze();
    else handleChat();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Vừa xong";
    if (mins < 60) return `${mins} phút trước`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} ngày trước`;
    return new Date(dateStr).toLocaleDateString("vi-VN");
  };

  const severityConfig = {
    high: {
      color: "bg-red-50 text-red-700 border-red-200",
      icon: TriangleAlert,
      label: "Nghiêm trọng",
    },
    medium: {
      color: "bg-amber-50 text-amber-700 border-amber-200",
      icon: CircleAlert,
      label: "Trung bình",
    },
    low: {
      color: "bg-blue-50 text-blue-700 border-blue-200",
      icon: Info,
      label: "Nhẹ",
    },
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* ────── HISTORY DRAWER (mobile overlay / desktop inline) ────── */}
      {showHistory && (
        <>
          {/* Backdrop — mobile only */}
          <div
            className="fixed inset-0 bg-black/30 z-40 md:hidden animate-fade-in"
            onClick={() => setShowHistory(false)}
          />
          {/* Panel */}
          <div className="fixed inset-y-0 left-0 w-[280px] sm:w-[320px] bg-white z-50 shadow-2xl flex flex-col animate-slide-in-left rounded-r-2xl">
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-stone-500" />
                <span className="text-sm font-semibold text-stone-700">Lịch sử chat</span>
                <Badge className="bg-stone-100 text-stone-500 text-[10px] border-0">
                  {conversations.length}
                </Badge>
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-stone-100 text-stone-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* New conversation button */}
            <div className="px-3 py-2.5 border-b border-stone-50">
              <button
                onClick={startNewConversation}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-vn-red/5 hover:bg-vn-red/10 text-vn-red text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Cuộc trò chuyện mới
              </button>
            </div>

            {/* Conversation list */}
            <div className="flex-1 overflow-y-auto px-2 py-2">
              {conversations.length === 0 ? (
                <div className="text-center py-10">
                  <MessageSquare className="w-8 h-8 text-stone-200 mx-auto mb-2" />
                  <p className="text-xs text-stone-400">Chưa có cuộc trò chuyện nào</p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {conversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => loadConversation(conv)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl transition-all group flex items-start gap-2.5 ${
                        currentConversationId === conv.id
                          ? "bg-vn-red/8 border border-vn-red/15"
                          : "hover:bg-stone-50 border border-transparent"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm truncate leading-snug ${
                            currentConversationId === conv.id
                              ? "font-semibold text-vn-red"
                              : "font-medium text-stone-700"
                          }`}
                        >
                          {conv.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge
                            className={`text-[9px] border-0 px-1.5 py-0 ${
                              conv.mode === "analyze"
                                ? "bg-red-50 text-red-500"
                                : "bg-blue-50 text-blue-500"
                            }`}
                          >
                            {conv.mode === "analyze" ? "Phân tích" : "Chat"}
                          </Badge>
                          <span className="text-[10px] text-stone-400">
                            {formatTimeAgo(conv.updatedAt)}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDeleteConversation(e, conv.id)}
                        className="opacity-0 group-hover:opacity-100 touch-visible shrink-0 mt-0.5 w-6 h-6 rounded-md flex items-center justify-center text-stone-300 hover:text-red-500 hover:bg-red-50 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ────── HEADER (sticky) ────── */}
      <header className="shrink-0 border-b border-stone-100 bg-white px-3 sm:px-5 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* History toggle button */}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-stone-100 text-stone-400 transition-colors shrink-0 relative"
          >
            <History className="w-4 h-4" />
            {conversations.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-vn-red text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                {conversations.length > 9 ? "9+" : conversations.length}
              </span>
            )}
          </button>

          <div className="w-8 h-8 rounded-lg overflow-hidden shadow-sm shrink-0 hidden sm:block">
            <Image src="/saomai-logo.jpg" alt="SaoMai AI" width={32} height={32} className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[13px] font-semibold text-stone-800 leading-tight truncate">
              SaoMai AI
            </h1>
            <p className="text-[11px] text-stone-400 hidden sm:block">
              Nhận diện & phản biện xuyên tạc
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode switcher */}
          <div className="flex bg-stone-100 p-0.5 rounded-lg">
            <button
              onClick={() => setMode("analyze")}
              className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                mode === "analyze"
                  ? "bg-white text-stone-800 shadow-sm"
                  : "text-stone-500 hover:text-stone-700"
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden xs:inline sm:inline">Phân tích</span>
            </button>
            <button
              onClick={() => setMode("chat")}
              className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                mode === "chat"
                  ? "bg-white text-stone-800 shadow-sm"
                  : "text-stone-500 hover:text-stone-700"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden xs:inline sm:inline">Chat</span>
            </button>
          </div>

          {/* New conversation button */}
          <button
            onClick={startNewConversation}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors shrink-0"
            title="Cuộc trò chuyện mới"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ────── MESSAGES (scrollable) ────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-3 py-4 md:px-5 md:py-6 space-y-4 md:space-y-6">
          {/* Empty State */}
          {messages.length === 0 && (
            <div className="text-center pt-12 sm:pt-16 pb-8">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-vn-red/10 to-vn-yellow/10 flex items-center justify-center mx-auto mb-4">
                <Star className="w-7 h-7 text-vn-yellow fill-vn-yellow/30" />
              </div>
              <h2 className="text-base font-semibold text-stone-800 mb-1.5">
                {mode === "analyze"
                  ? "Phân Tích Thông Tin Xuyên Tạc"
                  : "Chat với SaoMai AI"}
              </h2>
              <p className="text-sm text-stone-400 max-w-md mx-auto leading-relaxed px-4">
                {mode === "analyze"
                  ? "Paste đoạn text nghi xuyên tạc vào ô bên dưới. AI sẽ nhận diện, tìm nguồn chính thống, và viết bài phản biện."
                  : "Hỏi bất kỳ câu hỏi nào liên quan đến nhận diện và phản biện thông tin xuyên tạc."}
              </p>

              {mode === "analyze" && (
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-sm mx-auto px-4 sm:px-0">
                  {[
                    { icon: AlertTriangle, label: "Nhận diện", desc: "Phát hiện xuyên tạc" },
                    { icon: Search, label: "Tìm nguồn", desc: "Báo chính thống" },
                    { icon: PenLine, label: "Phản biện", desc: "Có dẫn chứng" },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="p-3 rounded-xl bg-stone-50 text-center border border-stone-100"
                    >
                      <item.icon className="w-4 h-4 text-vn-red mx-auto mb-1.5" />
                      <p className="text-[11px] font-semibold text-stone-700">{item.label}</p>
                      <p className="text-[10px] text-stone-400 mt-0.5">{item.desc}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Recent conversations hint */}
              {conversations.length > 0 && (
                <button
                  onClick={() => setShowHistory(true)}
                  className="mt-6 inline-flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-600 transition-colors"
                >
                  <History className="w-3.5 h-3.5" />
                  {conversations.length} cuộc trò chuyện trước
                </button>
              )}
            </div>
          )}

          {/* Messages */}
          {messages.map((msg, i) => (
            <div key={i} className="animate-fade-in-up">
              {msg.role === "user" ? (
                /* ── User bubble ── */
                <div className="flex justify-end">
                  <div className="max-w-[85%] sm:max-w-[75%] bg-vn-red text-white rounded-2xl rounded-tr-lg px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap shadow-sm break-words">
                    {msg.content}
                  </div>
                </div>
              ) : (
                /* ── Assistant response ── */
                <div className="space-y-3">
                  {msg.analysis && (
                    <div className="space-y-3">
                      {/* Claims */}
                      {msg.analysis.claims.length > 0 && (
                        <div className="rounded-2xl border border-red-200 bg-red-50/60 p-3 sm:p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <AlertTriangle className="w-4 h-4 text-vn-red" />
                            <span className="text-sm font-semibold text-vn-red">
                              Nhận diện xuyên tạc
                            </span>
                            <Badge className="bg-red-100 text-red-700 text-[10px] border-0">
                              {msg.analysis.claims.length} luận điểm
                            </Badge>
                          </div>
                          <div className="space-y-2">
                            {msg.analysis.claims.map((claim, j) => {
                              const config = severityConfig[claim.severity];
                              const SeverityIcon = config.icon;
                              return (
                                <div
                                  key={j}
                                  className={`rounded-xl border p-3 ${config.color}`}
                                >
                                  <div className="flex items-start gap-2">
                                    <SeverityIcon className="w-4 h-4 mt-0.5 shrink-0" />
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium leading-snug break-words">
                                        {claim.claim}
                                      </p>
                                      <p className="text-xs mt-1 opacity-80 break-words">{claim.reason}</p>
                                      <Badge variant="outline" className="mt-1.5 text-[10px]">
                                        {config.label}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Sources */}
                      {msg.analysis.sources.length > 0 && (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3 sm:p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <Search className="w-4 h-4 text-emerald-600" />
                            <span className="text-sm font-semibold text-emerald-700">
                              Nguồn chính thống
                            </span>
                            <Badge className="bg-emerald-100 text-emerald-700 text-[10px] border-0">
                              {msg.analysis.sources.length} nguồn
                            </Badge>
                          </div>
                          <div className="space-y-2">
                            {msg.analysis.sources.map((source, j) => (
                              <a
                                key={j}
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block rounded-xl border border-emerald-200 bg-white p-3 hover:shadow-sm transition-shadow group"
                              >
                                <div className="flex items-start gap-2">
                                  <ExternalLink className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-stone-700 leading-snug group-hover:text-emerald-700 break-words line-clamp-2">
                                      {source.title}
                                    </p>
                                    <p className="text-xs text-stone-400 mt-0.5 line-clamp-2 break-words">
                                      {source.snippet}
                                    </p>
                                    <p className="text-[10px] text-emerald-500 mt-1 truncate break-all">
                                      {source.url}
                                    </p>
                                  </div>
                                </div>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* RAG Context */}
                      {msg.analysis.ragContext.length > 0 && (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3 sm:p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <FileText className="w-4 h-4 text-amber-600" />
                            <span className="text-sm font-semibold text-amber-700">
                              Từ Knowledge Base
                            </span>
                          </div>
                          <div className="space-y-2">
                            {msg.analysis.ragContext.map((ctx, j) => (
                              <div
                                key={j}
                                className="text-xs bg-white rounded-lg border border-amber-200 p-3 text-stone-500 leading-relaxed break-words"
                              >
                                {ctx}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Rebuttal */}
                      <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-3 sm:p-4">
                        <div className="flex items-center justify-between mb-3 gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <PenLine className="w-4 h-4 text-blue-600 shrink-0" />
                            <span className="text-sm font-semibold text-blue-700">
                              Bài phản biện
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-100 shrink-0"
                            onClick={() => handleCopy(msg.content, `rebuttal-${i}`)}
                          >
                            {copied === `rebuttal-${i}` ? (
                              <Check className="w-3.5 h-3.5 mr-1" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 mr-1" />
                            )}
                            {copied === `rebuttal-${i}` ? "Đã copy" : "Copy"}
                          </Button>
                        </div>
                        <div className="text-sm text-stone-700 leading-relaxed break-words">
                          <Markdown content={msg.content} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Regular chat message */}
                  {!msg.analysis && (
                    <div className="flex gap-2 sm:gap-3">
                      <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0 mt-0.5 shadow-sm">
                        <Image src="/saomai-logo.jpg" alt="SaoMai" width={28} height={28} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0 bg-stone-50 rounded-2xl rounded-tl-lg px-3 sm:px-4 py-3 text-sm text-stone-700 leading-relaxed border border-stone-100 break-words">
                        <Markdown content={msg.content} />
                        {msg.isStreaming && !msg.content && (
                          <div className="typing-dots flex gap-1 py-1">
                            <span />
                            <span />
                            <span />
                          </div>
                        )}
                        {msg.isStreaming && msg.content && (
                          <span className="inline-block w-1.5 h-4 bg-vn-red/60 animate-pulse ml-0.5 align-text-bottom rounded-sm" />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Analysis Phase Indicator */}
          {isAnalyzing && analysisPhase && (
            <div className="animate-fade-in-up flex gap-2 sm:gap-3">
              <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0 shadow-sm">
                <Image src="/saomai-logo.jpg" alt="SaoMai" width={28} height={28} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0 bg-stone-50 rounded-2xl rounded-tl-lg px-3 sm:px-4 py-3 border border-stone-100">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-vn-red shrink-0" />
                  <span className="text-sm font-medium text-stone-600">
                    {analysisPhase === "detecting" && "Đang nhận diện luận điểm xuyên tạc..."}
                    {analysisPhase === "searching" && "Đang tìm nguồn chính thống..."}
                    {analysisPhase === "rebutting" && "Đang viết bài phản biện..."}
                  </span>
                </div>
                <div className="mt-2 h-1 bg-stone-200 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-vn-red to-vn-yellow animate-shimmer rounded-full" />
                </div>
              </div>
            </div>
          )}

          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ────── INPUT (sticky bottom) ────── */}
      <div className="shrink-0 border-t border-stone-100 bg-white p-3 sm:p-4 pb-safe">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2 bg-stone-50 rounded-2xl border border-stone-200 p-1.5 focus-within:border-vn-red/30 focus-within:ring-2 focus-within:ring-vn-red/10 transition-all">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                mode === "analyze"
                  ? "Dán nội dung nghi ngờ xuyên tạc..."
                  : "Hỏi SaoMai AI..."
              }
              className="flex-1 resize-none bg-transparent px-2.5 sm:px-3 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 outline-none min-h-[40px] max-h-[200px]"
              rows={1}
              disabled={isAnalyzing}
            />
            <Button
              onClick={handleSubmit}
              disabled={!input.trim() || isAnalyzing}
              className="bg-vn-red hover:bg-vn-red-dark text-white h-9 w-9 rounded-xl shrink-0 shadow-sm"
              size="icon"
            >
              {isAnalyzing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          <p className="text-[10px] text-stone-400 mt-2 text-center">
            Hệ thống AI bảo vệ nền tảng tư tưởng — Phân tích mang tính tham khảo, không thay thế đánh giá chuyên gia.
          </p>
        </div>
      </div>
    </div>
  );
}
