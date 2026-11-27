"use client";

import React, { useState } from "react";
import type { Chatbot, ClassificationStatus, Message } from "@/lib/types";

interface MessageListProps {
  messages: Message[];
  selectedChatbot: Chatbot | null;
  streaming: boolean;
  feedbackMap: Record<string, "positive" | "negative">;
  onCopy: (content: string) => void;
  onFeedback: (messageId: string, rating: "positive" | "negative") => void;
  onRegenerate: () => void;
}

const statusLabel: Record<ClassificationStatus, { text: string; className: string }> = {
  IN_DOMAIN: {
    text: "In domain",
    className: "text-emerald-700 dark:text-emerald-400"
  },
  OUT_OF_DOMAIN: {
    text: "Out of domain",
    className: "text-amber-700 dark:text-amber-400"
  },
  AMBIGUOUS: {
    text: "Needs clarification",
    className: "text-sky-700 dark:text-sky-400"
  }
};

export default function MessageList({
  messages,
  selectedChatbot,
  streaming,
  feedbackMap,
  onCopy,
  onFeedback,
  onRegenerate
}: MessageListProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string, content: string) => {
    onCopy(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <div className="max-w-md space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {selectedChatbot
              ? selectedChatbot.name
              : "Select a domain assistant"}
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
            {selectedChatbot
              ? selectedChatbot.description
              : "Choose an active assistant from the top bar to start a conversation."}
          </p>
          {selectedChatbot && selectedChatbot.allowedTopics.length > 0 && (
            <p className="pt-2 text-xs text-zinc-400 dark:text-zinc-500">
              Topics: {selectedChatbot.allowedTopics.slice(0, 5).join(" · ")}
            </p>
          )}
        </div>
      </div>
    );
  }

  const lastAssistantIndex = [...messages]
    .reverse()
    .findIndex((m) => m.role === "assistant");
  const lastAssistantId =
    lastAssistantIndex >= 0
      ? messages[messages.length - 1 - lastAssistantIndex]._id
      : null;

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="mx-auto max-w-3xl space-y-6">
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          const status = msg.classification?.status;
          const isPersisted = !msg._id.startsWith("temp-");
          const currentRating = feedbackMap[msg._id];

          return (
            <div
              key={msg._id}
              className={`flex ${isUser ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[92%] sm:max-w-[85%] rounded-xl px-3.5 sm:px-4 py-2.5 sm:py-3 text-sm leading-relaxed ${
                  isUser
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                }`}
              >
                {!isUser && status && (
                  <div className="mb-1.5 flex items-center gap-2 text-[11px]">
                    <span
                      title={msg.classification?.reason || undefined}
                      className={`font-medium ${statusLabel[status].className}`}
                    >
                      {statusLabel[status].text}
                    </span>
                    {msg.model && (
                      <span className="font-mono text-zinc-400 dark:text-zinc-500">
                        · {msg.model}
                      </span>
                    )}
                  </div>
                )}

                <div className="whitespace-pre-wrap break-words">
                  {msg.content || (streaming && !isUser ? "..." : "")}
                </div>

                {!isUser && msg.content && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400">
                    <button
                      type="button"
                      onClick={() => handleCopy(msg._id, msg.content)}
                      className="hover:text-zinc-900 dark:hover:text-zinc-100 transition cursor-pointer"
                    >
                      {copiedId === msg._id ? "Copied" : "Copy"}
                    </button>

                    {isPersisted && (
                      <>
                        <button
                          type="button"
                          onClick={() => onFeedback(msg._id, "positive")}
                          className={`transition cursor-pointer ${
                            currentRating === "positive"
                              ? "text-emerald-700 dark:text-emerald-400 font-medium"
                              : "hover:text-zinc-900 dark:hover:text-zinc-100"
                          }`}
                        >
                          Helpful
                        </button>
                        <button
                          type="button"
                          onClick={() => onFeedback(msg._id, "negative")}
                          className={`transition cursor-pointer ${
                            currentRating === "negative"
                              ? "text-red-600 dark:text-red-400 font-medium"
                              : "hover:text-zinc-900 dark:hover:text-zinc-100"
                          }`}
                        >
                          Not helpful
                        </button>
                      </>
                    )}

                    {msg._id === lastAssistantId && !streaming && isPersisted && (
                      <button
                        type="button"
                        onClick={onRegenerate}
                        className="hover:text-zinc-900 dark:hover:text-zinc-100 transition cursor-pointer"
                      >
                        Regenerate
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {streaming && (
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 pl-1">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-500" />
            <span>Generating response...</span>
          </div>
        )}
      </div>
    </div>
  );
}
