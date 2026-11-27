"use client";

import React, { useEffect, useState } from "react";
import AuthScreen from "@/components/AuthScreen";
import ChatWorkspace from "@/components/ChatWorkspace";
import LandingPage from "@/components/LandingPage";
import { fetchMe, getStoredToken, setStoredToken } from "@/lib/api";
import { disconnectSocket } from "@/lib/socket";
import type { User } from "@/lib/types";

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authMode, setAuthMode] = useState<"login" | "register" | null>(null);

  useEffect(() => {
    let active = true;
    const token = getStoredToken();
    const task = token
      ? fetchMe()
          .then((res) => {
            if (active) setUser(res.user);
          })
          .catch(() => {
            setStoredToken(null);
            if (active) setUser(null);
          })
      : Promise.resolve();

    task.finally(() => {
      if (active) setCheckingAuth(false);
    });

    return () => {
      active = false;
    };
  }, []);

  const handleLogout = () => {
    disconnectSocket();
    setStoredToken(null);
    setUser(null);
    setAuthMode(null);
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-sm text-slate-500">
        Loading session...
      </div>
    );
  }

  if (!user) {
    if (authMode) {
      return (
        <AuthScreen
          initialMode={authMode}
          onBack={() => setAuthMode(null)}
          onAuthenticated={(loggedInUser) => {
            setUser(loggedInUser);
            setAuthMode(null);
          }}
        />
      );
    }
    return <LandingPage onOpenAuth={(mode) => setAuthMode(mode)} />;
  }

  return (
    <ChatWorkspace
      user={user}
      onUserUpdate={setUser}
      onLogout={handleLogout}
    />
  );
}
