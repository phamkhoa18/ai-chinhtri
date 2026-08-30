"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Upload,
  FileText,
  Trash2,
  Plus,
  CheckCircle2,
  AlertCircle,
  Loader2,
  BookOpen,
  FileUp,
  Clock,
  Layers,
  HardDrive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface DocumentInfo {
  id: string;
  name: string;
  created_at: string;
  chunk_count: number;
  file_type: string | null;
  file_size: number;
}

export default function KnowledgePage() {
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [textInput, setTextInput] = useState("");
  const [textName, setTextName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch("/api/documents");
      if (!res.ok) {
        console.error("Failed to fetch documents: status", res.status);
        return;
      }
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        console.error("Failed to fetch documents: unexpected content-type", contentType);
        return;
      }
      const data = await res.json();
      setDocuments(data.documents || []);
    } catch {
      console.error("Failed to fetch documents");
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setUploadProgress(10);
    try {
      const formData = new FormData();
      formData.append("file", file);
      setUploadProgress(30);
      const res = await fetch("/api/documents", { method: "POST", body: formData });
      setUploadProgress(80);
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error("Server không phản hồi — vui lòng thử lại sau.");
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi upload tài liệu");
      setUploadProgress(100);
      setNotification({ type: "success", message: data.message });
      fetchDocuments();
    } catch (error) {
      setNotification({ type: "error", message: (error as Error).message });
    } finally {
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 500);
    }
  };

  const handleTextSubmit = async () => {
    if (!textInput.trim()) return;
    setIsUploading(true);
    setUploadProgress(20);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textInput, name: textName || undefined }),
      });
      setUploadProgress(80);
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error("Server không phản hồi — vui lòng thử lại sau.");
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi thêm tài liệu");
      setUploadProgress(100);
      setNotification({ type: "success", message: data.message });
      setTextInput("");
      setTextName("");
      fetchDocuments();
    } catch (error) {
      setNotification({ type: "error", message: (error as Error).message });
    } finally {
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 500);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      const res = await fetch("/api/documents", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        let errorMsg = "Không thể xóa tài liệu";
        try {
          const contentType = res.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            const data = await res.json();
            errorMsg = data.error || errorMsg;
          }
        } catch { /* ignore parse error */ }
        throw new Error(errorMsg);
      }
      setNotification({ type: "success", message: `Đã xóa "${name}"` });
      fetchDocuments();
    } catch (error) {
      setNotification({ type: "error", message: (error as Error).message || "Không thể xóa tài liệu" });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "—";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
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
              <div className="w-9 h-9 rounded-xl bg-vn-yellow/15 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-vn-yellow-dark" />
              </div>
              <h1 className="text-lg font-semibold text-stone-800">
                Cơ Sở Tri Thức
              </h1>
            </div>
            <p className="text-sm text-stone-400 pl-12">
              Upload tài liệu để AI sử dụng làm nguồn tham khảo khi phân tích
            </p>
          </div>

          {/* Upload Area */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
            {/* File Upload */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = ".pdf,.docx,.doc,.txt,.md,.csv";
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) handleFileUpload(file);
                };
                input.click();
              }}
              className={`rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all min-h-[200px] flex flex-col justify-center ${
                dragOver
                  ? "border-vn-red bg-vn-red/5 scale-[0.99]"
                  : "border-stone-200 bg-stone-50/50 hover:border-stone-300 hover:bg-stone-50"
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-stone-200 flex items-center justify-center mx-auto mb-3">
                <FileUp className="w-5 h-5 text-vn-red" />
              </div>
              <p className="text-sm font-semibold text-stone-700 mb-1">
                Kéo thả file hoặc nhấn để chọn
              </p>
              <p className="text-xs text-stone-400">PDF, DOCX, TXT, MD, CSV</p>

              {isUploading && (
                <div className="mt-4">
                  <Progress value={uploadProgress} className="h-1.5" />
                  <p className="text-xs text-stone-400 mt-1.5 flex items-center justify-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Đang xử lý...
                  </p>
                </div>
              )}
            </div>

            {/* Text Input */}
            <div className="rounded-2xl border border-stone-200 bg-white p-5 flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center">
                  <Upload className="w-4 h-4 text-stone-500" />
                </div>
                <span className="text-sm font-semibold text-stone-700">
                  Nhập text trực tiếp
                </span>
              </div>
              <div className="space-y-2.5 flex-1 flex flex-col">
                <input
                  type="text"
                  value={textName}
                  onChange={(e) => setTextName(e.target.value)}
                  placeholder="Tên tài liệu (không bắt buộc)"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-vn-red/15 focus:border-vn-red/30 transition-all"
                />
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Paste nội dung tài liệu vào đây..."
                  className="flex-1 min-h-[80px] w-full px-3 py-2 text-sm rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-vn-red/15 focus:border-vn-red/30 transition-all resize-none"
                />
                <Button
                  onClick={handleTextSubmit}
                  disabled={!textInput.trim() || isUploading}
                  className="w-full bg-vn-red hover:bg-vn-red-dark text-white rounded-xl"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Thêm vào Knowledge Base
                </Button>
              </div>
            </div>
          </div>

          {/* Separator */}
          <div className="border-t border-stone-100 mb-6" />

          {/* Document List */}
          <div className="mb-4 flex items-center gap-2">
            <Layers className="w-4 h-4 text-stone-400" />
            <h2 className="text-sm font-semibold text-stone-700">
              Tài liệu đã upload
            </h2>
            <Badge className="bg-stone-100 text-stone-500 text-[10px] border-0">
              {documents.length}
            </Badge>
          </div>

          {documents.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-stone-200 py-14 text-center">
              <BookOpen className="w-10 h-10 text-stone-300 mx-auto mb-3" />
              <p className="text-sm text-stone-400 font-medium">
                Chưa có tài liệu nào
              </p>
              <p className="text-xs text-stone-400/80 mt-0.5">
                Upload file hoặc paste text ở trên để bắt đầu
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map((doc, index) => (
                <div
                  key={doc.id}
                  className="animate-fade-in-up group rounded-xl border border-stone-200 bg-white p-4 flex items-center gap-3 hover:border-stone-300 transition-colors"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="w-9 h-9 rounded-lg bg-vn-red/5 flex items-center justify-center shrink-0 border border-vn-red/10">
                    <FileText className="w-4 h-4 text-vn-red" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-stone-700">
                      {doc.name}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 mt-1 text-xs text-stone-400">
                      <span className="flex items-center gap-1">
                        <Layers className="w-3 h-3" />
                        {doc.chunk_count} đoạn
                      </span>
                      <span className="flex items-center gap-1">
                        <HardDrive className="w-3 h-3" />
                        {formatFileSize(doc.file_size)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(doc.created_at)}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 touch-visible transition-opacity text-stone-400 hover:text-red-600 hover:bg-red-50 h-8 w-8 rounded-lg"
                    onClick={() => handleDelete(doc.id, doc.name)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
