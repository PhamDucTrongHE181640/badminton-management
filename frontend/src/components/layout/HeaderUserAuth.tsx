"use client";

import { useMemo } from "react";

import { Button, ButtonLink } from "@/components/ui";
import { API_BASE_URL } from "@/lib/http";

export type UserProfile = {
  email: string;
  full_name: string;
  roles: string[];
};

function loginUrl() {
  return `${API_BASE_URL}/api/v1/auth/google/start`;
}

type HeaderUserAuthProps = {
  user: UserProfile | null;
  logout: () => Promise<void>;
  isLoggingOut: boolean;
};

export function HeaderUserAuth({ user, logout, isLoggingOut }: HeaderUserAuthProps) {
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
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-xs font-semibold text-red-800">
            {initials}
          </span>
          <div className="hidden max-w-[220px] leading-tight sm:block">
            <p className="truncate text-sm font-semibold text-slate-900">{user.full_name}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>
        </div>
        {isOwner ? (
          <ButtonLink href="/owner/dashboard" size="sm" variant="outline">
            Kênh quản lý
          </ButtonLink>
        ) : null}
        <Button size="sm" variant="outline" onClick={logout} disabled={isLoggingOut}>
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

