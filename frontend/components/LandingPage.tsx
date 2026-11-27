"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useTheme } from "./ThemeProvider";

interface LandingPageProps {
  onOpenAuth: (mode: "login" | "register") => void;
}

interface PreviewSample {
  id: string;
  name: string;
  model: string;
  inDomainQ: string;
  inDomainA: string;
  outDomainQ: string;
  outDomainA: string;
}

const PREVIEW_SAMPLES: PreviewSample[] = [
  {
    id: "programming",
    name: "Programming",
    model: "qwen2.5:3b",
    inDomainQ: "Why use an index on (userId, updatedAt) in MongoDB?",
    inDomainA:
      "A compound index on { userId: 1, updatedAt: -1 } lets MongoDB filter a user's chats and return them sorted newest-first without an in-memory sort.",
    outDomainQ: "What is the best recipe for sourdough bread?",
    outDomainA:
      "Sorry! I am a Programming Assistant. I can only help you with programming and related technical topics."
  },
  {
    id: "healthcare",
    name: "Healthcare",
    model: "qwen2.5:3b",
    inDomainQ: "What do systolic and diastolic blood pressure numbers mean?",
    inDomainA:
      "Systolic (top number) measures artery pressure when the heart beats; diastolic (bottom number) measures pressure while the heart rests between beats.",
    outDomainQ: "Write a quicksort function in TypeScript.",
    outDomainA:
      "Sorry! I am a Healthcare Assistant. I can only help you with general health, nutrition, and wellness topics."
  },
  {
    id: "finance",
    name: "Finance",
    model: "qwen2.5:3b",
    inDomainQ: "How does dollar-cost averaging reduce timing risk?",
    inDomainA:
      "Investing a fixed amount on a regular schedule buys more shares when prices dip and fewer when prices rise, smoothing your average cost over time.",
    outDomainQ: "How do I fix a CORS error in Express?",
    outDomainA:
      "Sorry! I am a Finance Assistant. I can only help you with personal finance, budgeting, and accounting topics."
  }
];

const DOMAINS = [
  {
    name: "Programming Assistant",
    scope: "Code, debugging, SQL & NoSQL schemas, React, Node.js, ML concepts",
    boundary: "Rejects cooking, travel, general trivia"
  },
  {
    name: "Healthcare Assistant",
    scope: "Nutrition, anatomy, vital signs, preventive wellness, medical terms",
    boundary: "Rejects coding, finance, legal advice"
  },
  {
    name: "Finance Assistant",
    scope: "Budgeting, accounting principles, compound interest, market basics",
    boundary: "Rejects software engineering, medical topics"
  },
  {
    name: "Education Assistant",
    scope: "Mathematics, sciences, history, academic writing, study habits",
    boundary: "Rejects medical prescriptions, legal counsel"
  },
  {
    name: "Legal Assistant",
    scope: "Contract structure, IP basics, privacy compliance, legal terms",
    boundary: "Rejects debugging, recipes, medical advice"
  },
  {
    name: "Custom Admin Chatbots",
    scope: "Created by admins with custom prompts, allowed topics, and models",
    boundary: "Can be activated, paused, or soft-deleted anytime"
  }
];

export default function LandingPage({ onOpenAuth }: LandingPageProps) {
  const { theme, toggleTheme } = useTheme();
  const [activeSampleId, setActiveSampleId] = useState("programming");
  const sample =
    PREVIEW_SAMPLES.find((s) => s.id === activeSampleId) || PREVIEW_SAMPLES[0];

  return (
    <div className="min-h-screen bg-[#fafaf9] dark:bg-[#0c0c0e] text-zinc-900 dark:text-zinc-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-200/80 dark:border-zinc-800/80 bg-[#fafaf9]/90 dark:bg-[#0c0c0e]/90 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 sm:px-6 py-3.5 sm:py-4">
          <div className="flex items-center gap-2 shrink-0">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-5 w-5 text-zinc-900 dark:text-zinc-100"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M4 6h16M4 12h10M4 18h14" strokeLinecap="round" />
            </svg>
            <span className="font-semibold tracking-tight text-sm sm:text-base">
              DomainChat
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-7 text-sm text-zinc-600 dark:text-zinc-400">
            <a
              href="#assistants"
              className="hover:text-zinc-900 dark:hover:text-zinc-100 transition"
            >
              Assistants
            </a>
            <a
              href="#how-it-works"
              className="hover:text-zinc-900 dark:hover:text-zinc-100 transition"
            >
              How it works
            </a>
            <Link
              href="/admin"
              className="hover:text-zinc-900 dark:hover:text-zinc-100 transition"
            >
              Admin
            </Link>
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="rounded-lg p-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/70 transition cursor-pointer"
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
              onClick={() => onOpenAuth("login")}
              className="rounded-lg px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition cursor-pointer"
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => onOpenAuth("register")}
              className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-3 sm:px-3.5 py-1.5 text-xs sm:text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition cursor-pointer"
            >
              Get started
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-5xl px-4 sm:px-6 pt-12 pb-16 sm:pt-20 sm:pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            <div className="lg:col-span-6 space-y-6 pt-2">
              <p className="text-xs font-medium uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                Local Ollama • Domain-Scoped Chat
              </p>

              <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight leading-[1.12] text-zinc-900 dark:text-zinc-50">
                One workspace for focused, domain-only AI assistants.
              </h1>

              <p className="text-base text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-lg">
                Switch between Programming, Healthcare, Finance, Education,
                Legal, or custom admin-built assistants. Each domain keeps its
                own conversation history and checks every question before
                answering.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => onOpenAuth("register")}
                  className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-5 py-2.5 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition cursor-pointer"
                >
                  Open workspace
                </button>
                <a
                  href="#assistants"
                  className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition"
                >
                  Browse assistants
                </a>
              </div>
            </div>

            {/* Interactive Sample Switcher */}
            <div className="lg:col-span-6">
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 dark:border-zinc-800 px-3 sm:px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900/70">
                  <div className="flex items-center gap-1">
                    {PREVIEW_SAMPLES.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveSampleId(item.id)}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                          item.id === sample.id
                            ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                            : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                        }`}
                      >
                        {item.name}
                      </button>
                    ))}
                  </div>
                  <span className="text-[11px] font-mono text-zinc-400">
                    {sample.model}
                  </span>
                </div>

                <div className="p-5 space-y-4 text-sm">
                  <div className="space-y-2">
                    <div className="flex justify-end">
                      <div className="rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-3.5 py-2 max-w-[85%] text-xs sm:text-sm">
                        {sample.inDomainQ}
                      </div>
                    </div>
                    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50 px-3.5 py-2.5 space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                        <span>In domain</span>
                        <span className="text-zinc-400 font-normal">
                          streamed reply
                        </span>
                      </div>
                      <p className="text-zinc-700 dark:text-zinc-300 text-xs sm:text-sm leading-relaxed">
                        {sample.inDomainA}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 space-y-2">
                    <div className="flex justify-end">
                      <div className="rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-3.5 py-2 max-w-[85%] text-xs sm:text-sm">
                        {sample.outDomainQ}
                      </div>
                    </div>
                    <div className="rounded-lg border border-amber-200/80 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 px-3.5 py-2.5 space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-amber-800 dark:text-amber-300 font-medium">
                        <span>Out of domain</span>
                        <span className="text-zinc-400 font-normal">
                          generation skipped
                        </span>
                      </div>
                      <p className="text-zinc-700 dark:text-zinc-300 text-xs sm:text-sm leading-relaxed">
                        {sample.outDomainA}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <p className="mt-2.5 text-xs text-zinc-500 dark:text-zinc-400 text-right">
                Click tabs above to preview domain boundaries.
              </p>
            </div>
          </div>
        </section>

        {/* Assistants Directory */}
        <section
          id="assistants"
          className="border-t border-zinc-200 dark:border-zinc-800 py-16"
        >
          <div className="mx-auto max-w-5xl px-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">
                  Available assistants
                </h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Five default domains are ready out of the box; admins can add
                  or update domains at any time.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenAuth("login")}
                className="text-sm font-medium text-zinc-900 dark:text-zinc-100 underline underline-offset-4 hover:text-zinc-600 dark:hover:text-zinc-300 self-start sm:self-auto cursor-pointer"
              >
                Sign in to switch &rarr;
              </button>
            </div>

            <div className="divide-y divide-zinc-200 dark:divide-zinc-800 border-y border-zinc-200 dark:border-zinc-800">
              {DOMAINS.map((domain) => (
                <div
                  key={domain.name}
                  className="py-4 grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-6 items-baseline"
                >
                  <div className="md:col-span-4 font-medium text-sm text-zinc-900 dark:text-zinc-100">
                    {domain.name}
                  </div>
                  <div className="md:col-span-5 text-sm text-zinc-600 dark:text-zinc-400">
                    {domain.scope}
                  </div>
                  <div className="md:col-span-3 text-xs text-zinc-500 dark:text-zinc-500 md:text-right">
                    {domain.boundary}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section
          id="how-it-works"
          className="border-t border-zinc-200 dark:border-zinc-800 py-16"
        >
          <div className="mx-auto max-w-5xl px-6">
            <h2 className="text-2xl font-semibold tracking-tight mb-8">
              How every message is handled
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-2 border-t border-zinc-300 dark:border-zinc-700 pt-4">
                <span className="text-xs font-mono text-zinc-500">01</span>
                <h3 className="font-medium text-base">
                  Domain-isolated history
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Each chat belongs to one assistant. Switching assistants loads
                  only that domain&apos;s conversations without mixing prompts.
                </p>
              </div>

              <div className="space-y-2 border-t border-zinc-300 dark:border-zinc-700 pt-4">
                <span className="text-xs font-mono text-zinc-500">02</span>
                <h3 className="font-medium text-base">
                  Pre-stream classification
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Before generating an answer, Ollama classifies the question as
                  in-domain, out-of-domain, or ambiguous—and blocks prompt
                  injection attempts.
                </p>
              </div>

              <div className="space-y-2 border-t border-zinc-300 dark:border-zinc-700 pt-4">
                <span className="text-xs font-mono text-zinc-500">03</span>
                <h3 className="font-medium text-base">
                  Admin control & metrics
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Admins manage system prompts, allowed topics, model
                  selection, active status, and view latency and rating stats.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 text-xs text-zinc-500 dark:text-zinc-400">
          <span>DomainChat — Next.js, Express, MongoDB &amp; Ollama</span>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => onOpenAuth("login")}
              className="hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => onOpenAuth("register")}
              className="hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
            >
              Register
            </button>
            <Link
              href="/admin"
              className="hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              Admin
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
