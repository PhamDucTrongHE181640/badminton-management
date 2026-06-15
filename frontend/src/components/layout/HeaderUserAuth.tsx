"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Button, ButtonLink } from "@/components/ui";
import { API_BASE_URL, apiFetch } from "@/lib/http";

type UserProfile = {
  email: string;
  full_name: string;
  roles: string[];
};

function loginUrl() {
  return `${API_BASE_URL}/api/v1/auth/google/start`;
}

export function HeaderUserAuth() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        const profile = await apiFetch<UserProfile>("/api/v1/auth/me", {
          credentials: "include",
        });
        if (!cancelled) setUser(profile);
      } catch {
        if (!cancelled) setUser(null);
      }
    }

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  async function logout() {
    setIsLoggingOut(true);
    try {
      await apiFetch("/api/v1/auth/logout", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({}),
      });
      setUser(null);
    } finally {
      setIsLoggingOut(false);
    }
  }

  const initials = useMemo(() => {
    if (!user?.full_name) return "U";
    return user.full_name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((item) => item[0]?.toUpperCase() ?? "")
      .join("");
  }, [user?.full_name]);
  const isOwner = user?.roles.includes("owner") ?? false;

  if (user) {
    return (
      <div className="flex shrink-0 items-center gap-2 lg:gap-3">
        <Link href="/player/profile" className="flex shrink-0 items-center gap-2 rounded-xl px-1 py-1 transition hover:bg-slate-50" title="Hồ sơ của tôi">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-semibold text-red-800">
            {initials}
          </span>
          <div className="hidden max-w-[190px] leading-tight 2xl:block">
            <p className="truncate text-sm font-semibold text-slate-900">{user.full_name}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>
        </Link>
        {isOwner ? (
          <ButtonLink href="/owner/dashboard" size="sm" variant="outline" className="hidden whitespace-nowrap lg:inline-flex" title="Quản lý owner">
            Quản lý
          </ButtonLink>
        ) : null}
        <Button size="sm" variant="outline" onClick={logout} disabled={isLoggingOut} className="whitespace-nowrap">
          {isLoggingOut ? "Đang đăng xuất..." : "Đăng xuất"}
        </Button>
      </div>
    );
  }

  return (
    <a
      href={loginUrl()}
      className="inline-flex items-center justify-center rounded-xl bg-red-800 px-5 py-2 text-sm font-semibold text-white shadow-xs transition duration-200 hover:bg-red-900 shrink-0 cursor-pointer"
    >
      Đăng nhập
    </a>
  );
}
