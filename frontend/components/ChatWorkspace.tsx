"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  clearChatMessages,
  createChat,
  deleteChat,
  fetchActiveChatbots,
  fetchChatById,
  fetchChats,
  fetchFeedbackForChat,
  regenerateMessage,
  renameChat,
  selectChatbot,
  submitFeedback
} from "@/lib/api";
import { getSocket, streamMessageWithSocket } from "@/lib/socket";
import type { Chat, Chatbot, Message, User } from "@/lib/types";
import ChatbotSelector from "./ChatbotSelector";
import ChatSidebar from "./ChatSidebar";
import MessageList from "./MessageList";

interface ChatWorkspaceProps {
  user: User;
  onUserUpdate: (user: User) => void;
  onLogout: () => void;
}

export default function ChatWorkspace({
  user,
  onUserUpdate,
  onLogout
}: ChatWorkspaceProps) {
  const [chatbots, setChatbots] = useState<Chatbot[]>([]);
  const [selectedChatbot, setSelectedChatbot] = useState<Chatbot | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [feedbackMap, setFeedbackMap] = useState<
    Record<string, "positive" | "negative">
  >({});
  const [showLegacyChats, setShowLegacyChats] = useState(false);

  const [input, setInput] = useState("");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const loadChatsForScope = useCallback(
    async (chatbotId: string | null, legacyMode: boolean) => {
      try {
        const res = await fetchChats(
          legacyMode ? "legacy" : chatbotId || undefined
        );
        setChats(res.chats);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load chats");
      }
    },
    []
  );

  // Initial load: active chatbots + scoped chat list
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        const res = await fetchActiveChatbots();
        if (!mounted) return;
        setChatbots(res.chatbots);

        let initialBot =
          res.chatbots.find((b) => b._id === res.selectedChatbotId) ||
          res.chatbots[0] ||
          null;

        if (initialBot && initialBot._id !== res.selectedChatbotId) {
          try {
            const selectedRes = await selectChatbot(initialBot._id);
            initialBot = selectedRes.chatbot;
            onUserUpdate({ ...user, selectedChatbotId: initialBot._id });
          } catch {
            // Keep UI functional even if selection fails
          }
        }

        if (!mounted) return;
        setSelectedChatbot(initialBot);
        if (initialBot) {
          await loadChatsForScope(initialBot._id, false);
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error ? err.message : "Failed to load assistants"
          );
        }
      }
    };
    init();
    return () => {
      mounted = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize authenticated Socket.IO connection
  useEffect(() => {
    getSocket();
  }, [user.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, streaming]);

  const handleSelectChatbot = async (chatbotId: string) => {
    if (streaming) {
      abortControllerRef.current?.abort();
      setStreaming(false);
    }
    setError(null);
    setSwitching(true);
    try {
      const res = await selectChatbot(chatbotId);
      setSelectedChatbot(res.chatbot);
      setShowLegacyChats(false);
      setActiveChatId(null);
      setMessages([]);
      setFeedbackMap({});
      onUserUpdate({ ...user, selectedChatbotId: res.selectedChatbotId });
      await loadChatsForScope(res.selectedChatbotId, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to switch assistant");
    } finally {
      setSwitching(false);
    }
  };

  const handleToggleLegacy = async () => {
    const nextLegacy = !showLegacyChats;
    setShowLegacyChats(nextLegacy);
    setActiveChatId(null);
    setMessages([]);
    setFeedbackMap({});
    await loadChatsForScope(selectedChatbot?._id || null, nextLegacy);
  };

  const handleSelectChat = async (chatId: string) => {
    if (streaming) {
      abortControllerRef.current?.abort();
      setStreaming(false);
    }
    setError(null);
    try {
      const [chatRes, fbRes] = await Promise.all([
        fetchChatById(chatId),
        fetchFeedbackForChat(chatId)
      ]);
      setActiveChatId(chatId);
      setMessages(chatRes.messages);
      const map: Record<string, "positive" | "negative"> = {};
      for (const entry of fbRes.feedback) {
        map[entry.messageId] = entry.rating;
      }
      setFeedbackMap(map);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open chat");
    }
  };

  const handleNewChat = async () => {
    if (streaming) {
      abortControllerRef.current?.abort();
      setStreaming(false);
    }
    setError(null);
    if (!selectedChatbot) {
      setError("Please select an active assistant first.");
      return null;
    }
    try {
      const res = await createChat({ chatbotId: selectedChatbot._id });
      setShowLegacyChats(false);
      setChats((prev) => [res.chat, ...prev]);
      setActiveChatId(res.chat._id);
      setMessages([]);
      setFeedbackMap({});
      return res.chat;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create chat");
      return null;
    }
  };

  const handleRenameChat = async (chatId: string, title: string) => {
    try {
      const res = await renameChat(chatId, title);
      setChats((prev) =>
        prev.map((c) => (c._id === chatId ? res.chat : c))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename chat");
    }
  };

  const handleDeleteChat = async (chatId: string) => {
    try {
      await deleteChat(chatId);
      setChats((prev) => prev.filter((c) => c._id !== chatId));
      if (activeChatId === chatId) {
        setActiveChatId(null);
        setMessages([]);
        setFeedbackMap({});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete chat");
    }
  };

  const handleClearChat = async () => {
    if (!activeChatId) return;
    try {
      await clearChatMessages(activeChatId);
      setMessages([]);
      setFeedbackMap({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear messages");
    }
  };

  const handleStopGeneration = () => {
    abortControllerRef.current?.abort();
    setStreaming(false);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (streaming) return;

    const trimmed = input.trim();
    if (!trimmed) return;
    if (trimmed.length > 20000) {
      setError("Message cannot exceed 20,000 characters.");
      return;
    }

    setError(null);
    let targetChatId = activeChatId;

    if (!targetChatId) {
      const created = await handleNewChat();
      if (!created) return;
      targetChatId = created._id;
    }

    setInput("");
    const tempUserId = `temp-user-${Date.now()}`;
    const tempAssistantId = `temp-assistant-${Date.now()}`;

    const optimisticUser: Message = {
      _id: tempUserId,
      chatId: targetChatId,
      userId: user.id,
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString()
    };

    const optimisticAssistant: Message = {
      _id: tempAssistantId,
      chatId: targetChatId,
      userId: user.id,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString()
    };

    setMessages((prev) => [...prev, optimisticUser, optimisticAssistant]);

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setStreaming(true);

    try {
      await streamMessageWithSocket({
        chatId: targetChatId,
        content: trimmed,
        signal: controller.signal,
        onEvent: (event) => {
          if (event.type === "start") {
            setMessages((prev) =>
              prev.map((m) =>
                m._id === tempUserId && event.userMessageId
                  ? {
                      ...m,
                      _id: event.userMessageId,
                      classification: event.classification
                    }
                  : m._id === tempAssistantId
                    ? {
                        ...m,
                        model: event.model || null,
                        classification: event.classification
                      }
                    : m
              )
            );
          } else if (event.type === "chunk" && event.content) {
            setMessages((prev) =>
              prev.map((m) =>
                m._id === tempAssistantId
                  ? { ...m, content: m.content + event.content }
                  : m
              )
            );
          } else if (event.type === "done") {
            setMessages((prev) =>
              prev.map((m) =>
                m._id === tempAssistantId
                  ? {
                      ...m,
                      _id: event.assistantMessageId || m._id,
                      content: event.content ?? m.content,
                      classification: event.classification ?? m.classification
                    }
                  : m
              )
            );
          } else if (event.type === "error") {
            setError(event.message || "Streaming failed");
          }
        }
      });

      // Refresh chat list to pick up auto-generated title and updated timestamp
      await loadChatsForScope(selectedChatbot?._id || null, showLegacyChats);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        // Remove incomplete temporary assistant bubble when stopped by user
        setMessages((prev) => prev.filter((m) => m._id !== tempAssistantId));
      } else {
        setError(err instanceof Error ? err.message : "Failed to send message");
        setMessages((prev) => prev.filter((m) => m._id !== tempAssistantId));
      }
    } finally {
      setStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleRegenerate = async () => {
    if (!activeChatId || streaming) return;
    setError(null);
    setStreaming(true);
    try {
      const res = await regenerateMessage(activeChatId);
      const chatRes = await fetchChatById(activeChatId);
      setMessages(chatRes.messages);
      if (!res.assistantMessage) {
        setError("Regeneration returned empty response");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to regenerate response"
      );
    } finally {
      setStreaming(false);
    }
  };

  const handleFeedback = async (
    messageId: string,
    rating: "positive" | "negative"
  ) => {
    try {
      await submitFeedback({ messageId, rating });
      setFeedbackMap((prev) => ({ ...prev, [messageId]: rating }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save feedback");
    }
  };

  const handleCopy = (content: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(content).catch(() => {});
    }
  };

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-[#fafaf9] dark:bg-[#0c0c0e]">
      <ChatSidebar
        user={user}
        selectedChatbot={selectedChatbot}
        chats={chats}
        activeChatId={activeChatId}
        showLegacyChats={showLegacyChats}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        onToggleLegacy={handleToggleLegacy}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        onRenameChat={handleRenameChat}
        onDeleteChat={handleDeleteChat}
        onLogout={onLogout}
      />

      <main className="flex flex-1 flex-col min-w-0">
        {/* Top bar */}
        <header className="flex items-center justify-between gap-2 sm:gap-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 sm:px-5 py-2.5 sm:py-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open chat history"
              className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-1.5 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 md:hidden shrink-0 cursor-pointer"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
              </svg>
            </button>
            <ChatbotSelector
              chatbots={chatbots}
              selectedChatbot={selectedChatbot}
              switching={switching}
              onSelect={handleSelectChatbot}
            />
          </div>

          <div className="flex items-center gap-2">
            {activeChatId && messages.length > 0 && (
              <button
                type="button"
                onClick={handleClearChat}
                disabled={streaming}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 cursor-pointer"
              >
                Clear chat
              </button>
            )}
          </div>
        </header>

        {error && (
          <div className="mx-auto mt-3 w-full max-w-3xl px-4">
            <div className="flex items-center justify-between rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/50 px-4 py-2 text-xs text-red-700 dark:text-red-300">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setError(null)}
                className="ml-4 font-semibold hover:underline cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        <MessageList
          messages={messages}
          selectedChatbot={selectedChatbot}
          streaming={streaming}
          feedbackMap={feedbackMap}
          onCopy={handleCopy}
          onFeedback={handleFeedback}
          onRegenerate={handleRegenerate}
        />
        <div ref={bottomRef} />

        {/* Input Composer */}
        <div className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-3">
          <form
            onSubmit={handleSendMessage}
            className="mx-auto flex max-w-3xl items-end gap-2"
          >
            <div className="relative flex-1">
              <textarea
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={
                  selectedChatbot
                    ? `Message ${selectedChatbot.name}...`
                    : "Select an assistant to start chatting..."
                }
                disabled={!selectedChatbot && !activeChatId}
                className="w-full resize-none rounded-lg border border-zinc-300 dark:border-zinc-700 bg-[#fafaf9] dark:bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:border-zinc-900 dark:focus:border-zinc-300 focus:outline-none disabled:opacity-50"
              />
            </div>

            {streaming ? (
              <button
                type="button"
                onClick={handleStopGeneration}
                className="shrink-0 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 transition cursor-pointer"
              >
                Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() || (!selectedChatbot && !activeChatId)}
                className="shrink-0 rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2.5 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-40 transition cursor-pointer"
              >
                Send
              </button>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}
