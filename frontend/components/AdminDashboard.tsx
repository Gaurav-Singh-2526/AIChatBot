"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  adminCreateChatbot,
  adminDeleteChatbot,
  adminFetchAnalytics,
  adminFetchChatbots,
  adminToggleChatbotStatus,
  adminUpdateChatbot,
  fetchAvailableModels,
  type ChatbotPayload
} from "@/lib/api";
import type { AnalyticsResponse, Chatbot, OllamaModel, User } from "@/lib/types";
import { useTheme } from "./ThemeProvider";

interface AdminDashboardProps {
  user: User;
}

const emptyForm = (defaultModel: string) => ({
  name: "",
  slug: "",
  description: "",
  systemPrompt: "",
  allowedTopicsText: "",
  restrictedTopicsText: "",
  model: defaultModel,
  isActive: true
});

export default function AdminDashboard({ user }: AdminDashboardProps) {
  const { theme, toggleTheme } = useTheme();
  const [tab, setTab] = useState<"analytics" | "chatbots">("analytics");
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [chatbots, setChatbots] = useState<Chatbot[]>([]);
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [defaultModel, setDefaultModel] = useState("qwen2.5:3b");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Create / Edit modal state
  const [editingBot, setEditingBot] = useState<Chatbot | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm("qwen2.5:3b"));
  const [saving, setSaving] = useState(false);

  // Delete confirmation modal
  const [deleteTarget, setDeleteTarget] = useState<Chatbot | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const [analyticsRes, chatbotsRes, modelsRes] = await Promise.all([
        adminFetchAnalytics(),
        adminFetchChatbots(),
        fetchAvailableModels()
      ]);
      setAnalytics(analyticsRes);
      setChatbots(chatbotsRes.chatbots);
      setModels(modelsRes.models);
      setDefaultModel(modelsRes.defaultModel);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user.role === "admin") {
      Promise.resolve().then(() => loadAll());
    }
  }, [user.role, loadAll]);

  if (user.role !== "admin") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 text-center">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Access Denied
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Administrator privileges are required to view this dashboard.
        </p>
        <Link
          href="/"
          className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Back to Chat
        </Link>
      </div>
    );
  }

  const openCreateModal = () => {
    setEditingBot(null);
    setForm(emptyForm(defaultModel));
    setShowForm(true);
    setError(null);
  };

  const openEditModal = (bot: Chatbot) => {
    setEditingBot(bot);
    setForm({
      name: bot.name,
      slug: bot.slug,
      description: bot.description,
      systemPrompt: bot.systemPrompt || "",
      allowedTopicsText: bot.allowedTopics.join(", "),
      restrictedTopicsText: bot.restrictedTopics.join(", "),
      model: bot.model || defaultModel,
      isActive: bot.isActive
    });
    setShowForm(true);
    setError(null);
  };

  const handleSaveChatbot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const allowedTopics = form.allowedTopicsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const restrictedTopics = form.restrictedTopicsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (!form.name.trim() || !form.description.trim() || !form.systemPrompt.trim()) {
      setError("Name, description, and system prompt are required.");
      return;
    }
    if (allowedTopics.length === 0) {
      setError("Provide at least one allowed topic (comma-separated).");
      return;
    }

    const payload: ChatbotPayload = {
      name: form.name.trim(),
      ...(form.slug.trim() ? { slug: form.slug.trim() } : {}),
      description: form.description.trim(),
      systemPrompt: form.systemPrompt.trim(),
      allowedTopics,
      restrictedTopics,
      model: form.model.trim() || defaultModel,
      isActive: form.isActive
    };

    setSaving(true);
    try {
      if (editingBot) {
        await adminUpdateChatbot(editingBot._id, payload);
        setSuccessMsg(`Updated "${payload.name}"`);
      } else {
        await adminCreateChatbot(payload);
        setSuccessMsg(`Created "${payload.name}"`);
      }
      setShowForm(false);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save chatbot");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (bot: Chatbot) => {
    setError(null);
    setSuccessMsg(null);
    try {
      await adminToggleChatbotStatus(bot._id, !bot.isActive);
      setSuccessMsg(
        `${bot.name} ${!bot.isActive ? "activated" : "deactivated"}`
      );
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setError(null);
    setSuccessMsg(null);
    try {
      await adminDeleteChatbot(deleteTarget._id);
      setSuccessMsg(`Deleted "${deleteTarget.name}"`);
      setDeleteTarget(null);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete chatbot");
    }
  };

  const overview = analytics?.overview;

  return (
    <div className="min-h-screen bg-[#fafaf9] dark:bg-[#0c0c0e] text-zinc-900 dark:text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-6 py-4">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold">Admin Console</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Domain assistants and platform analytics
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              {theme === "dark" ? "Light" : "Dark"}
            </button>
            <Link
              href="/"
              className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-3.5 py-1.5 text-xs font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200"
            >
              Back to chat
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-4 sm:p-6 space-y-6">
        {/* Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-1">
            <button
              type="button"
              onClick={() => setTab("analytics")}
              className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition cursor-pointer ${
                tab === "analytics"
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              Analytics
            </button>
            <button
              type="button"
              onClick={() => setTab("chatbots")}
              className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition cursor-pointer ${
                tab === "chatbots"
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              Chatbots ({chatbots.length})
            </button>
          </div>

          {tab === "chatbots" && (
            <button
              type="button"
              onClick={openCreateModal}
              className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition cursor-pointer"
            >
              + New chatbot
            </button>
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/60 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/60 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
            {successMsg}
          </div>
        )}

        {loading ? (
          <div className="py-16 text-center text-sm text-slate-500">
            Loading dashboard data...
          </div>
        ) : tab === "analytics" && overview ? (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total Users" value={overview.totalUsers} sub={`${overview.activeUsers} active`} />
              <StatCard
                label="Chatbots"
                value={overview.totalChatbots}
                sub={`${overview.activeChatbots} active`}
              />
              <StatCard
                label="Conversations"
                value={overview.totalConversations}
                sub={`${overview.totalMessages} messages`}
              />
              <StatCard
                label="Avg Response Time"
                value={`${overview.avgResponseTimeMs} ms`}
                sub={`${overview.totalQuestions} classified queries`}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard
                label="In-Domain Queries"
                value={overview.inDomainQuestions}
                sub="Answered via domain prompt"
              />
              <StatCard
                label="Out-of-Domain Rejected"
                value={overview.outOfDomainQuestions}
                sub="Blocked prior to answer model"
              />
              <StatCard
                label="User Feedback"
                value={`${overview.feedback.positive} + / ${overview.feedback.negative} -`}
                sub={`${overview.feedback.total} total ratings`}
              />
            </div>

            {/* Per-Chatbot Usage Table */}
            <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
                <h2 className="font-semibold text-sm">Chatbot Usage Breakdown</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-xs">
                  <thead className="bg-zinc-50 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400">
                    <tr>
                      <th className="px-4 py-3 font-medium">Chatbot</th>
                      <th className="px-4 py-3 font-medium">Model</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Chats</th>
                      <th className="px-4 py-3 font-medium">Questions</th>
                      <th className="px-4 py-3 font-medium">In / Out / Amb</th>
                      <th className="px-4 py-3 font-medium">Avg Latency</th>
                      <th className="px-4 py-3 font-medium">Ratings (+/-)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {analytics.chatbotUsage.map((row) => (
                      <tr key={row.chatbotId}>
                        <td className="px-4 py-3 font-medium">{row.name}</td>
                        <td className="px-4 py-3 text-slate-500">{row.model}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              row.isActive
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                            }`}
                          >
                            {row.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-3">{row.conversationCount}</td>
                        <td className="px-4 py-3">{row.totalQuestions}</td>
                        <td className="px-4 py-3">
                          {row.inDomainCount} / {row.outOfDomainCount} / {row.ambiguousCount}
                        </td>
                        <td className="px-4 py-3">{row.avgResponseTimeMs} ms</td>
                        <td className="px-4 py-3">
                          +{row.positiveFeedback} / -{row.negativeFeedback}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        ) : (
          /* Manage Chatbots Tab */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {chatbots.map((bot) => (
              <div
                key={bot._id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-base">{bot.name}</h3>
                      <p className="text-xs text-slate-400">
                        slug: {bot.slug} • model: {bot.model}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        bot.isActive
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {bot.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {bot.description}
                  </p>

                  <div className="text-xs space-y-1">
                    <p>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        Allowed:
                      </span>{" "}
                      {bot.allowedTopics.join(", ")}
                    </p>
                    {bot.restrictedTopics.length > 0 && (
                      <p>
                        <span className="font-semibold text-amber-600 dark:text-amber-400">
                          Restricted:
                        </span>{" "}
                        {bot.restrictedTopics.join(", ")}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => openEditModal(bot)}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(bot)}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    {bot.isActive ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(bot)}
                    className="ml-auto rounded-lg border border-red-200 dark:border-red-900 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl">
            <h2 className="text-lg font-bold mb-4">
              {editingBot ? `Edit ${editingBot.name}` : "Create New Chatbot"}
            </h2>
            <form onSubmit={handleSaveChatbot} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Name *</label>
                  <input
                    required
                    maxLength={60}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">
                    Slug (optional)
                  </label>
                  <input
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    placeholder="auto-generated-from-name"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  Description *
                </label>
                <textarea
                  required
                  rows={2}
                  maxLength={500}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  System Prompt *
                </label>
                <textarea
                  required
                  rows={3}
                  value={form.systemPrompt}
                  onChange={(e) =>
                    setForm({ ...form, systemPrompt: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  Allowed Topics (comma-separated) *
                </label>
                <input
                  required
                  value={form.allowedTopicsText}
                  onChange={(e) =>
                    setForm({ ...form, allowedTopicsText: e.target.value })
                  }
                  placeholder="python, algorithms, databases, react"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  Restricted Topics (comma-separated)
                </label>
                <input
                  value={form.restrictedTopicsText}
                  onChange={(e) =>
                    setForm({ ...form, restrictedTopicsText: e.target.value })
                  }
                  placeholder="cooking, medical diagnosis, sports"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
                <div>
                  <label className="block text-xs font-medium mb-1">
                    Ollama Model
                  </label>
                  <select
                    value={form.model}
                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                  >
                    {models.map((m) => (
                      <option key={m.name} value={m.name}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <label className="flex items-center gap-2 text-sm pt-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) =>
                      setForm({ ...form, isActive: e.target.checked })
                    }
                  />
                  Active (visible to users)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? "Saving..." : editingBot ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Soft Delete Confirmation Dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl">
            <h3 className="text-base font-bold">Delete Chatbot?</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Are you sure you want to soft-delete{" "}
              <span className="font-semibold">{deleteTarget.name}</span>? Existing
              conversations will be preserved, but users will no longer be able to
              select it.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Soft Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub
}: {
  label: string;
  value: string | number;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">{sub}</p>
    </div>
  );
}
