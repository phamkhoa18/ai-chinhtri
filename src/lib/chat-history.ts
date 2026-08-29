"use client";

export interface ChatConversation {
  id: string;
  title: string;
  messages: ChatMessageData[];
  mode: "analyze" | "chat";
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageData {
  role: "user" | "assistant";
  content: string;
  analysis?: {
    claims: {
      claim: string;
      tactic: string;
      reason: string;
      impact: string;
      severity: "high" | "medium" | "low";
    }[];
    sources: {
      title: string;
      url: string;
      snippet: string;
      relevance: string;
    }[];
    rebuttal: string;
    ragContext: string[];
  };
}

const STORAGE_KEY = "saomai-chat-history";
const MAX_CONVERSATIONS = 50;

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

function generateTitle(firstMessage: string): string {
  const cleaned = firstMessage.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 50) return cleaned;
  return cleaned.substring(0, 47) + "...";
}

export function listConversations(): ChatConversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const conversations: ChatConversation[] = JSON.parse(raw);
    // Sort by updatedAt descending
    return conversations.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  } catch {
    return [];
  }
}

export function getConversation(id: string): ChatConversation | null {
  const conversations = listConversations();
  return conversations.find((c) => c.id === id) || null;
}

export function createConversation(mode: "analyze" | "chat"): ChatConversation {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    title: mode === "analyze" ? "Phân tích mới" : "Chat mới",
    messages: [],
    mode,
    createdAt: now,
    updatedAt: now,
  };
}

export function saveConversation(conversation: ChatConversation): void {
  if (typeof window === "undefined") return;
  try {
    const conversations = listConversations();
    const existingIndex = conversations.findIndex((c) => c.id === conversation.id);

    // Auto-generate title from first user message
    const firstUserMsg = conversation.messages.find((m) => m.role === "user");
    if (firstUserMsg) {
      conversation.title = generateTitle(firstUserMsg.content);
    }

    conversation.updatedAt = new Date().toISOString();

    if (existingIndex >= 0) {
      conversations[existingIndex] = conversation;
    } else {
      conversations.unshift(conversation);
    }

    // Enforce max limit — remove oldest
    while (conversations.length > MAX_CONVERSATIONS) {
      conversations.pop();
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch (e) {
    console.error("Failed to save conversation:", e);
  }
}

export function deleteConversation(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const conversations = listConversations();
    const filtered = conversations.filter((c) => c.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error("Failed to delete conversation:", e);
  }
}
