"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { Chat, Chatbot, User } from "@/lib/types";
import { useTheme } from "./ThemeProvider";

interface ChatSidebarProps {
  user: User;
  selectedChatbot: Chatbot | null;
  chats: Chat[];
  activeChatId: string | null;
  showLegacyChats: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onToggleLegacy: () => void;
  onNewChat: () => void;
  onSelectChat: (chatId: string) => void;
  onRenameChat: (chatId: string, title: string) => Promise<void>;
  onDeleteChat: (chatId: string) => Promise<void>;
  onLogout: () => void;
}

export default function ChatSidebar({
  user,
  selectedChatbot,
  chats,
  activeChatId,
  showLegacyChats,
  mobileOpen,
  onCloseMobile,
  onToggleLegacy,
  onNewChat,
  onSelectChat,
  onRenameChat,
  onDeleteChat,
  onLogout
}: ChatSidebarProps) {
  const { theme, toggleTheme } = useTheme();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const startRename = (chat: Chat) => {
    setEditingId(chat._id);
    setDraftTitle(chat.title);
  };

  const submitRename = async (chatId: string) => {
    if (draftTitle.trim()) {
      await onRenameChat(chatId, draftTitle.trim());
    }
    setEditingId(null);
  };

  return (
    <>
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-full w-72 shrink-0 flex-col border-r border-zinc-200 dark:border-zinc-800 bg-[#f5f5f4] dark:bg-[#111114] transition-transform duration-200 md:static md:w-68 md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-3.5 border-b border-zinc-200 dark:border-zinc-800 space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-4 w-4 text-zinc-900 dark:text-zinc-100"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M4 6h16M4 12h10M4 18h14" strokeLinecap="round" />
              </svg>
              <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                DomainChat
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={toggleTheme}
                title="Toggle theme"
                aria-label="Toggle theme"
                className="rounded-md p-1.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                {theme === "dark" ? (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32 1.41-1.41" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                onClick={onCloseMobile}
                aria-label="Close sidebar"
                className="rounded-md p-1.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 md:hidden cursor-pointer"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              onNewChat();
              onCloseMobile();
            }}
            disabled={!selectedChatbot && !showLegacyChats}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 px-3 py-2 text-xs font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 transition cursor-pointer"
          >
            <span>+</span>
            <span>
              New {selectedChatbot ? selectedChatbot.name.split(" ")[0] : ""} chat
            </span>
          </button>
        </div>

      <div className="px-3.5 py-2 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
        <span className="font-medium truncate">
          {showLegacyChats
            ? "Legacy chats"
            : selectedChatbot
              ? selectedChatbot.name
              : "Chats"}
        </span>
        <button
          type="button"
          onClick={onToggleLegacy}
          className="text-zinc-700 dark:text-zinc-300 hover:underline shrink-0 ml-2 cursor-pointer"
        >
          {showLegacyChats ? "Domain" : "Legacy"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
        {chats.length === 0 ? (
          <p className="px-3 py-8 text-center text-xs text-zinc-400 dark:text-zinc-500">
            No conversations yet.
          </p>
        ) : (
          chats.map((chat) => {
            const isActive = chat._id === activeChatId;
            return (
              <div
                key={chat._id}
                className={`group rounded-lg px-2.5 py-2 transition ${
                  isActive
                    ? "bg-zinc-200/80 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium"
                    : "hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300"
                }`}
              >
                {editingId === chat._id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      submitRename(chat._id);
                    }}
                  >
                    <input
                      autoFocus
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      onBlur={() => submitRename(chat._id)}
                      className="w-full rounded border border-zinc-400 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2 py-0.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none"
                    />
                  </form>
                ) : confirmDeleteId === chat._id ? (
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-red-600 dark:text-red-400">
                      Delete?
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={async () => {
                          await onDeleteChat(chat._id);
                          setConfirmDeleteId(null);
                        }}
                        className="rounded bg-red-600 px-2 py-0.5 text-white hover:bg-red-700 cursor-pointer"
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded bg-zinc-300 dark:bg-zinc-700 px-2 py-0.5 cursor-pointer"
                      >
                        No
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectChat(chat._id);
                        onCloseMobile();
                      }}
                      className="flex-1 truncate text-left text-[13px] cursor-pointer"
                    >
                      {chat.title || "New Chat"}
                    </button>
                    <div className="flex md:hidden md:group-hover:flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => startRename(chat)}
                        title="Rename"
                        aria-label="Rename chat"
                        className="rounded p-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(chat._id)}
                        title="Delete"
                        aria-label="Delete chat"
                        className="rounded p-1 text-zinc-500 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-zinc-200 dark:border-zinc-800 p-3 space-y-2">
        {user.role === "admin" && (
          <Link
            href="/admin"
            className="block w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-center text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            Admin console
          </Link>
        )}

        <div className="flex items-center justify-between gap-2 px-1">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-zinc-900 dark:text-zinc-100">
              {user.name}
            </p>
            <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
              {user.role}
            </p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-md px-2 py-1 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition cursor-pointer"
          >
            Log out
          </button>
        </div>
      </div>
    </aside>
    </>
  );
}
