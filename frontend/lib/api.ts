import type {
  AnalyticsResponse,
  Chat,
  Chatbot,
  FeedbackEntry,
  Message,
  OllamaModel,
  StreamEvent,
  User
} from "./types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || " https://aichatbot-2-31nv.onrender.com";

const TOKEN_STORAGE_KEY = "aichatbot_token";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `Request failed with status ${res.status}`);
  }
  return data as T;
}

// -------- Auth --------
export async function registerUser(payload: {
  name: string;
  email: string;
  password: string;
}) {
  return request<{ success: boolean; token: string; user: User }>(
    "/api/auth/register",
    { method: "POST", body: JSON.stringify(payload) }
  );
}

export async function loginUser(payload: { email: string; password: string }) {
  return request<{ success: boolean; token: string; user: User }>(
    "/api/auth/login",
    { method: "POST", body: JSON.stringify(payload) }
  );
}

export async function fetchMe() {
  return request<{ success: boolean; user: User }>("/api/auth/me");
}

// -------- User Chatbots --------
export async function fetchActiveChatbots() {
  return request<{
    success: boolean;
    selectedChatbotId: string | null;
    chatbots: Chatbot[];
  }>("/api/chatbots");
}

export async function selectChatbot(id: string) {
  return request<{
    success: boolean;
    selectedChatbotId: string;
    chatbot: Chatbot;
  }>(`/api/chatbots/select/${id}`, { method: "PUT" });
}

// -------- Chats --------
export async function fetchChats(chatbotId?: string | "legacy" | null) {
  const query = chatbotId ? `?chatbotId=${encodeURIComponent(chatbotId)}` : "";
  return request<{ success: boolean; chats: Chat[] }>(`/api/chats${query}`);
}

export async function createChat(payload: {
  chatbotId?: string | null;
  title?: string;
}) {
  return request<{ success: boolean; chat: Chat }>("/api/chats", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function fetchChatById(chatId: string) {
  return request<{ success: boolean; chat: Chat; messages: Message[] }>(
    `/api/chats/${chatId}`
  );
}

export async function renameChat(chatId: string, title: string) {
  return request<{ success: boolean; chat: Chat }>(`/api/chats/${chatId}`, {
    method: "PATCH",
    body: JSON.stringify({ title })
  });
}

export async function deleteChat(chatId: string) {
  return request<{ success: boolean; message: string }>(
    `/api/chats/${chatId}`,
    { method: "DELETE" }
  );
}

export async function clearChatMessages(chatId: string) {
  return request<{ success: boolean; message: string }>(
    `/api/chats/${chatId}/messages`,
    { method: "DELETE" }
  );
}

// -------- Messaging & NDJSON Streaming --------
export async function regenerateMessage(chatId: string) {
  return request<{
    success: boolean;
    assistantMessage: Message;
  }>("/api/messages/regenerate", {
    method: "POST",
    body: JSON.stringify({ chatId })
  });
}

export async function streamMessage({
  chatId,
  content,
  signal,
  onEvent
}: {
  chatId: string;
  content: string;
  signal: AbortSignal;
  onEvent: (event: StreamEvent) => void;
}): Promise<void> {
  const token = getStoredToken();
  const res = await fetch(`${API_BASE}/api/messages/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ chatId, content }),
    signal
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || `Stream error (${res.status})`);
  }

  if (!res.body) {
    throw new Error("Streaming is not supported in this browser");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parsed = JSON.parse(trimmed) as StreamEvent;
      onEvent(parsed);
    }
  }

  if (buffer.trim()) {
    const parsed = JSON.parse(buffer.trim()) as StreamEvent;
    onEvent(parsed);
  }
}

// -------- Feedback & Settings & Models --------
export async function submitFeedback(payload: {
  messageId: string;
  rating: "positive" | "negative";
  comment?: string;
}) {
  return request<{ success: boolean; feedback: FeedbackEntry }>(
    "/api/feedback",
    { method: "POST", body: JSON.stringify(payload) }
  );
}

export async function fetchFeedbackForChat(chatId: string) {
  return request<{ success: boolean; feedback: FeedbackEntry[] }>(
    `/api/feedback/chat/${chatId}`
  );
}

export async function updateUserTheme(theme: "light" | "dark" | "system") {
  return request<{ success: boolean }>("/api/users/settings", {
    method: "PUT",
    body: JSON.stringify({ theme })
  });
}

export async function fetchAvailableModels() {
  return request<{
    success: boolean;
    ollamaReachable: boolean;
    defaultModel: string;
    models: OllamaModel[];
  }>("/api/models");
}

// -------- Admin APIs --------
export async function adminFetchChatbots() {
  return request<{ success: boolean; chatbots: Chatbot[] }>(
    "/api/admin/chatbots"
  );
}

export interface ChatbotPayload {
  name: string;
  slug?: string;
  description: string;
  systemPrompt: string;
  allowedTopics: string[];
  restrictedTopics: string[];
  model: string;
  isActive: boolean;
}

export async function adminCreateChatbot(payload: ChatbotPayload) {
  return request<{ success: boolean; chatbot: Chatbot }>(
    "/api/admin/chatbots",
    { method: "POST", body: JSON.stringify(payload) }
  );
}

export async function adminUpdateChatbot(id: string, payload: ChatbotPayload) {
  return request<{ success: boolean; chatbot: Chatbot }>(
    `/api/admin/chatbots/${id}`,
    { method: "PUT", body: JSON.stringify(payload) }
  );
}

export async function adminToggleChatbotStatus(id: string, isActive: boolean) {
  return request<{ success: boolean; chatbot: Chatbot }>(
    `/api/admin/chatbots/${id}/status`,
    { method: "PATCH", body: JSON.stringify({ isActive }) }
  );
}

export async function adminDeleteChatbot(id: string) {
  return request<{ success: boolean; message: string }>(
    `/api/admin/chatbots/${id}`,
    { method: "DELETE" }
  );
}

export async function adminFetchAnalytics() {
  return request<AnalyticsResponse>("/api/admin/analytics");
}
