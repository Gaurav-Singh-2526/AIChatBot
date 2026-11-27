"use client";

import React from "react";
import type { Chatbot } from "@/lib/types";

interface ChatbotSelectorProps {
  chatbots: Chatbot[];
  selectedChatbot: Chatbot | null;
  switching: boolean;
  onSelect: (chatbotId: string) => void;
}

export default function ChatbotSelector({
  chatbots,
  selectedChatbot,
  switching,
  onSelect
}: ChatbotSelectorProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0 flex-1">
      <div className="flex items-center gap-2 min-w-0 max-w-full">
        <label
          htmlFor="chatbot-select"
          className="hidden sm:inline text-xs font-medium text-zinc-500 dark:text-zinc-400 shrink-0"
        >
          Assistant
        </label>
        <select
          id="chatbot-select"
          value={selectedChatbot?._id || ""}
          disabled={switching || chatbots.length === 0}
          onChange={(e) => {
            if (e.target.value) onSelect(e.target.value);
          }}
          className="max-w-full min-w-0 truncate rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-zinc-900 dark:text-zinc-100 focus:border-zinc-900 dark:focus:border-zinc-300 focus:outline-none disabled:opacity-60"
        >
          {chatbots.length === 0 && (
            <option value="">No active assistants</option>
          )}
          {chatbots.map((bot) => (
            <option key={bot._id} value={bot._id}>
              {bot.name} ({bot.model})
            </option>
          ))}
        </select>
      </div>

      {selectedChatbot && (
        <span
          className="hidden md:inline-block max-w-sm truncate text-xs text-zinc-500 dark:text-zinc-400"
          title={selectedChatbot.description}
        >
          {selectedChatbot.description}
        </span>
      )}
    </div>
  );
}
