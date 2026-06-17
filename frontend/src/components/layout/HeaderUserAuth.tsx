"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";

import { Button } from "@/components/ui";
import { API_BASE_URL } from "@/lib/http";

export type UserProfile = {
  email: string;
  full_name: string;
  roles: string[];
  avatar_url?: string | null;
};

function loginUrl() {
  return `${API_BASE_URL}/api/v1/auth/google/start`;
}

type HeaderUserAuthProps = {
  user: UserProfile | null;
  logout: () => Promise<void>;
  isLoggingOut: boolean;
  onProfileUpdated?: () => void;
};

export function HeaderUserAuth({ user, logout, isLoggingOut }: HeaderUserAuthProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const initials = useMemo(() => {
    if (!user?.full_name) return "U";
    return user.full_name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((item) => item[0]?.toUpperCase() ?? "")
      .join("");
  }, [user?.full_name]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  if (user) {
    return (
      <div className="relative" ref={dropdownRef}>
        {/* Toggle trigger */}
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-slate-100/80 text-left transition select-none cursor-pointer focus:outline-none"
        >
          {user.avatar_url ? (
            <img src={user.avatar_url} alt={user.full_name} className="h-9 w-9 rounded-full object-cover ring-2 ring-slate-100" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100 text-sm font-bold text-red-800 ring-2 ring-red-50">
              {initials}
            </span>
          )}
          <div className="hidden max-w-[150px] leading-tight sm:block">
            <p className="truncate text-sm font-bold text-slate-900 flex items-center gap-1">
              {user.full_name}
              <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 text-slate-400 transition duration-200 ${isDropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </p>
            <p className="truncate text-[10px] text-slate-400 font-semibold">{user.email}</p>
          </div>
        </button>

        {/* Dropdown Menu (Facebook style) */}
        {isDropdownOpen && (
          <div className="absolute right-0 top-14 z-50 w-[320px] rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xl animate-in fade-in slide-in-from-top-3 duration-200">
            {/* Profile Brief Card */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 shadow-xs">
              <div className="flex items-center gap-3">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt={user.full_name} className="h-12 w-12 rounded-full object-cover ring-4 ring-white shadow-xs" />
                ) : (
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-base font-black text-red-800 ring-4 ring-white shadow-xs">
                    {initials}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <h4 className="truncate font-heading text-sm font-bold text-slate-900">{user.full_name}</h4>
                  <p className="truncate text-[11px] text-slate-400 font-semibold">{user.email}</p>
                </div>
              </div>
              <div className="border-t border-slate-100 my-2.5" />
              <Link
                href="/player/profile/"
                onClick={() => setIsDropdownOpen(false)}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-150/70 hover:bg-slate-200/80 px-4 py-2 text-xs font-bold text-slate-750 transition cursor-pointer select-none text-center"
              >
                👤 Chỉnh sửa thông tin cá nhân
              </Link>
            </div>

            <div className="my-2 border-t border-slate-100" />

            {/* Menu Links by Roles */}
            <div className="space-y-1">
              {user.roles.includes("admin") && (
                <Link
                  href="/_internal/netup-admin/"
                  onClick={() => setIsDropdownOpen(false)}
                  className="flex items-center justify-between rounded-xl px-2.5 py-2 hover:bg-slate-50 transition text-slate-700 hover:text-slate-950"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-750 text-sm">🛡️</span>
                    <span className="text-xs font-bold">Trang quản trị (Admin)</span>
                  </div>
                  <span className="text-slate-400 text-xs">➔</span>
                </Link>
              )}

              {user.roles.includes("owner") && (
                <Link
                  href="/owner/dashboard/"
                  onClick={() => setIsDropdownOpen(false)}
                  className="flex items-center justify-between rounded-xl px-2.5 py-2 hover:bg-slate-50 transition text-slate-700 hover:text-slate-950"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-750 text-sm">📊</span>
                    <span className="text-xs font-bold">Kênh quản lý (Owner)</span>
                  </div>
                  <span className="text-slate-400 text-xs">➔</span>
                </Link>
              )}

              <Link
                href="/player/assessment/"
                onClick={() => setIsDropdownOpen(false)}
                className="flex items-center justify-between rounded-xl px-2.5 py-2 hover:bg-slate-50 transition text-slate-700 hover:text-slate-950"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-750 text-sm">⚡</span>
                  <span className="text-xs font-bold">Đánh giá trình độ AI</span>
                </div>
                <span className="text-slate-400 text-xs">➔</span>
              </Link>

              <Link
                href="/player/bookings/"
                onClick={() => setIsDropdownOpen(false)}
                className="flex items-center justify-between rounded-xl px-2.5 py-2 hover:bg-slate-50 transition text-slate-700 hover:text-slate-950"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-750 text-sm">📅</span>
                  <span className="text-xs font-bold">Lịch đặt sân của tôi</span>
                </div>
                <span className="text-slate-400 text-xs">➔</span>
              </Link>
            </div>

            <div className="my-2 border-t border-slate-100" />

            {/* Logout button */}
            <button
              onClick={() => {
                setIsDropdownOpen(false);
                void logout();
              }}
              disabled={isLoggingOut}
              className="w-full flex items-center gap-3 rounded-xl px-2.5 py-2 text-slate-700 hover:bg-red-50 hover:text-red-700 transition cursor-pointer select-none text-left"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-50 text-red-650 text-sm">🚪</span>
              <span className="text-xs font-bold">{isLoggingOut ? "Đang đăng xuất..." : "Đăng xuất"}</span>
            </button>
          </div>
        )}
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




