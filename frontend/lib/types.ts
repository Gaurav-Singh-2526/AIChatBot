export type UserRole = "user" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  selectedChatbotId: string | null;
}

export interface Chatbot {
  _id: string;
  name: string;
  slug: string;
  description: string;
  systemPrompt?: string;
  allowedTopics: string[];
  restrictedTopics: string[];
  model: string;
  isActive: boolean;
  isDeleted: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Chat {
  _id: string;
  userId: string;
  chatbotId:
    | string
    | {
        _id: string;
        name: string;
        slug: string;
        description?: string;
        isActive?: boolean;
        isDeleted?: boolean;
        model?: string;
      }
    | null;
  title: string;
  model: string;
  isArchived?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ClassificationStatus = "IN_DOMAIN" | "OUT_OF_DOMAIN" | "AMBIGUOUS";

export interface ClassificationMeta {
  status: ClassificationStatus | null;
  reason: string | null;
}

export interface Message {
  _id: string;
  chatId: string;
  userId: string;
  role: "user" | "assistant" | "system";
  content: string;
  classification?: ClassificationMeta;
  model?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface FeedbackEntry {
  _id: string;
  messageId: string;
  rating: "positive" | "negative";
  comment?: string;
}

export interface OllamaModel {
  name: string;
  size: number | null;
  modifiedAt: string | null;
}

export interface StreamEvent {
  type: "start" | "chunk" | "done" | "error";
  model?: string;
  chatbotId?: string | null;
  chatbotName?: string;
  userMessageId?: string;
  assistantMessageId?: string;
  content?: string;
  classification?: ClassificationMeta;
  rejected?: boolean;
  clarification?: boolean;
  message?: string;
}

export interface AnalyticsOverview {
  totalUsers: number;
  activeUsers: number;
  totalChatbots: number;
  activeChatbots: number;
  totalConversations: number;
  totalMessages: number;
  totalQuestions: number;
  inDomainQuestions: number;
  outOfDomainQuestions: number;
  ambiguousQuestions: number;
  avgResponseTimeMs: number;
  feedback: {
    total: number;
    positive: number;
    negative: number;
  };
}

export interface ChatbotUsageStat {
  chatbotId: string;
  name: string;
  slug: string;
  model: string;
  isActive: boolean;
  conversationCount: number;
  totalQuestions: number;
  inDomainCount: number;
  outOfDomainCount: number;
  ambiguousCount: number;
  avgResponseTimeMs: number;
  positiveFeedback: number;
  negativeFeedback: number;
}

export interface ModelUsageStat {
  model: string;
  count: number;
  avgResponseTimeMs: number;
}

export interface ActivityLogEntry {
  _id: string;
  action: string;
  classificationStatus: ClassificationStatus | null;
  model: string | null;
  responseTimeMs: number;
  success: boolean;
  createdAt: string;
  userId?: { name: string; email: string } | null;
  chatbotId?: { name: string; slug: string } | null;
}

export interface AnalyticsResponse {
  success: boolean;
  overview: AnalyticsOverview;
  chatbotUsage: ChatbotUsageStat[];
  modelUsage: ModelUsageStat[];
  recentActivity: ActivityLogEntry[];
}
