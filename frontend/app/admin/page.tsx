"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import AdminDashboard from "@/components/AdminDashboard";
import { fetchMe, getStoredToken, setStoredToken } from "@/lib/api";
import type { User } from "@/lib/types";

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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
      if (active) setLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-sm text-slate-500">
        Verifying admin session...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 text-center">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          Sign In Required
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Please sign in with an administrator account first.
        </p>
        <Link
          href="/"
          className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Go to Login
        </Link>
      </div>
    );
  }

  return <AdminDashboard user={user} />;
}
