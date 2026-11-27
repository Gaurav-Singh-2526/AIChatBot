"use client";

import React, { useState } from "react";
import { loginUser, registerUser, setStoredToken } from "@/lib/api";
import type { User } from "@/lib/types";
import { useTheme } from "./ThemeProvider";

interface AuthScreenProps {
  initialMode?: "login" | "register";
  onBack?: () => void;
  onAuthenticated: (user: User) => void;
}

export default function AuthScreen({
  initialMode = "login",
  onBack,
  onAuthenticated
}: AuthScreenProps) {
  const { theme, toggleTheme } = useTheme();
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "register") {
        if (name.trim().length < 2) {
          throw new Error("Name must be at least 2 characters.");
        }
        if (password.length < 8) {
          throw new Error("Password must be at least 8 characters.");
        }
        const res = await registerUser({ name: name.trim(), email, password });
        setStoredToken(res.token);
        onAuthenticated(res.user);
      } else {
        const res = await loginUser({ email, password });
        setStoredToken(res.token);
        onAuthenticated(res.user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-[#fafaf9] dark:bg-[#0c0c0e] px-4 py-16">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="fixed top-4 left-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
        >
          &larr; Home
        </button>
      )}
      <button
        type="button"
        onClick={toggleTheme}
        aria-label="Toggle theme"
        className="fixed top-4 right-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
      >
        {theme === "dark" ? "Light" : "Dark"}
      </button>

      <div className="w-full max-w-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-7 shadow-sm">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-5 w-5 text-zinc-900 dark:text-zinc-100"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M4 6h16M4 12h10M4 18h14" strokeLinecap="round" />
            </svg>
            <span className="text-sm font-semibold">DomainChat</span>
          </div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            {mode === "login" ? "Sign in" : "Create account"}
          </h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {mode === "login"
              ? "Continue to your domain assistants."
              : "Register to start chatting with domain assistants."}
          </p>
        </div>

        <div className="mb-5 grid grid-cols-2 rounded-lg bg-zinc-100 dark:bg-zinc-900 p-1">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError(null);
            }}
            className={`rounded-md py-1.5 text-xs font-medium transition cursor-pointer ${
              mode === "login"
                ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs"
                : "text-zinc-500 dark:text-zinc-400"
            }`}
          >
            Log in
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setError(null);
            }}
            className={`rounded-md py-1.5 text-xs font-medium transition cursor-pointer ${
              mode === "register"
                ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs"
                : "text-zinc-500 dark:text-zinc-400"
            }`}
          >
            Register
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === "register" && (
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Name
              </label>
              <input
                type="text"
                required
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-zinc-900 dark:focus:border-zinc-300 focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Email
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-zinc-900 dark:focus:border-zinc-300 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={mode === "register" ? 8 : 1}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "register" ? "Min 8 characters" : "Password"}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-zinc-900 dark:focus:border-zinc-300 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-zinc-900 dark:bg-zinc-100 py-2.5 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 transition cursor-pointer"
          >
            {loading
              ? "Please wait..."
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}
