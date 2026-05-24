"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { API_BASE_URL, apiFetch } from "@/lib/http";

type ServiceState = "checking" | "online" | "offline";

type UserProfile = {
  email: string;
  full_name: string;
  roles: string[];
};

type HealthState = {
  api: ServiceState;
  database: ServiceState;
};

const roleCards = [
  {
    title: "Người chơi",
    description: "Discovery, booking, assessment, match history và chat pool.",
    href: "/player/discovery",
  },
  {
    title: "Chủ sân",
    description: "Vận hành sân, quản lý slot và check-in người chơi theo booking.",
    href: "/owner/dashboard",
  },
  {
    title: "Quản trị",
    description: "Dashboard vận hành, cấu hình hệ thống và audit trail.",
    href: "/_internal/netup-admin/dashboard",
  },
];

function StatusPill({ state }: { state: ServiceState }) {
  const styles: Record<ServiceState, string> = {
    checking: "border-slate-300 bg-slate-100 text-slate-700",
    online: "border-emerald-200 bg-emerald-50 text-emerald-700",
    offline: "border-red-200 bg-red-50 text-red-700",
  };
  const labels: Record<ServiceState, string> = {
    checking: "đang kiểm tra",
    online: "sẵn sàng",
    offline: "mất kết nối",
  };

  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase ${styles[state]}`}>
      {labels[state]}
    </span>
  );
}

export default function HomePage() {
  const [health, setHealth] = useState<HealthState>({ api: "checking", database: "checking" });
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authMessage, setAuthMessage] = useState("Đang kiểm tra phiên đăng nhập");
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkHealth() {
      const [apiResult, dbResult] = await Promise.allSettled([
        fetch(`${API_BASE_URL}/api/v1/health/live`, { cache: "no-store" }),
        fetch(`${API_BASE_URL}/api/v1/health/ready`, { cache: "no-store" }),
      ]);

      if (cancelled) return;

      setHealth({
        api: apiResult.status === "fulfilled" && apiResult.value.ok ? "online" : "offline",
        database: dbResult.status === "fulfilled" && dbResult.value.ok ? "online" : "offline",
      });
    }

    async function checkAuth() {
      try {
        const profile = await apiFetch<UserProfile>("/api/v1/auth/me", {
          credentials: "include",
        });
        if (cancelled) return;
        setUser(profile);
        setAuthMessage("Đã đăng nhập");
      } catch {
        if (cancelled) return;
        setUser(null);
        setAuthMessage("Chưa đăng nhập");
      }
    }

    void checkHealth();
    void checkAuth();
    const timer = window.setInterval(checkHealth, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
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
      setAuthMessage("Đã đăng xuất");
    } catch {
      setAuthMessage("Không thể đăng xuất lúc này");
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <div className="fade-up space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-red-700">NetUp Platform</p>
        <h1 className="mt-3 max-w-3xl font-heading text-3xl font-semibold leading-tight text-ink sm:text-5xl">
          Nền tảng đặt sân thể thao và vận hành chủ sân, sẵn sàng đưa vào sử dụng.
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
          Hệ thống gồm đầy đủ luồng player-owner-admin: discovery, booking, payments, check-in,
          assessment, match feedback, chat pool, cấu hình vận hành và audit logs.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          {user ? (
            <button
              className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-400"
              onClick={logout}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? "Đang đăng xuất..." : "Đăng xuất"}
            </button>
          ) : (
            <a
              href={`${API_BASE_URL}/api/v1/auth/google/start`}
              className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Đăng nhập Google
            </a>
          )}
          <Link
            href="/_internal/netup-admin/login"
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Đăng nhập quản trị
          </Link>
        </div>

        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Trạng thái phiên: {authMessage}</p>
          {user ? <p className="mt-1">{user.full_name} · {user.email} · {user.roles.join(", ")}</p> : null}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {roleCards.map((card) => (
          <article key={card.href} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-heading text-xl font-semibold text-ink">{card.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{card.description}</p>
            <Link
              href={card.href}
              className="mt-4 inline-flex rounded-full border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Mở khu vực
            </Link>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-heading text-xl font-semibold text-ink">Sức khoẻ hệ thống</h2>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900">API</span>
            <StatusPill state={health.api} />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900">Database</span>
            <StatusPill state={health.database} />
          </div>
        </div>
      </section>
    </div>
  );
}
