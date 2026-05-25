"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Badge, Button, ButtonLink, Card, Notice, PageHero, StatCard } from "@/components/ui";
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
  const tone: Record<ServiceState, "neutral" | "success" | "danger"> = {
    checking: "neutral",
    online: "success",
    offline: "danger",
  };
  const labels: Record<ServiceState, string> = {
    checking: "đang kiểm tra",
    online: "sẵn sàng",
    offline: "mất kết nối",
  };

  return <Badge tone={tone[state]}>{labels[state]}</Badge>;
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
    <div className="fade-up space-y-5">
      <PageHero
        eyebrow="NetUp Platform"
        title="Đặt sân, ghép kèo và vận hành sân trong một sản phẩm."
        description="NetUp gom các luồng chính cho người chơi, chủ sân và quản trị: tìm sân, booking, đặt cọc, check-in, đánh giá level, lịch đấu và cấu hình vận hành."
        actions={
          <>
          {user ? (
            <Button onClick={logout} disabled={isLoggingOut}>
              {isLoggingOut ? "Đang đăng xuất..." : "Đăng xuất"}
            </Button>
          ) : (
            <a
              href={`${API_BASE_URL}/api/v1/auth/google/start`}
              className="inline-flex items-center justify-center rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              Đăng nhập Google
            </a>
          )}
          <ButtonLink href="/_internal/netup-admin/login" variant="outline">
            Đăng nhập quản trị
          </ButtonLink>
          </>
        }
        aside={
          <div
            className="min-h-[240px] rounded-lg bg-cover bg-center"
            style={{
              backgroundImage:
                "linear-gradient(130deg, rgba(15,23,42,0.18), rgba(127,29,29,0.34)), url('/courts/football1.jpeg')",
            }}
            aria-hidden="true"
          />
        }
      />

      <Notice tone={user ? "success" : "info"}>
        <p className="font-semibold">Trạng thái phiên: {authMessage}</p>
        {user ? <p>{user.full_name} · {user.email} · {user.roles.join(", ")}</p> : null}
      </Notice>

      <section className="grid gap-4 md:grid-cols-3">
        {roleCards.map((card) => (
          <Card key={card.href} className="flex flex-col">
            <h2 className="font-heading text-xl font-semibold text-ink">{card.title}</h2>
            <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{card.description}</p>
            <Link
              href={card.href}
              className="mt-4 inline-flex items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Mở khu vực
            </Link>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="API"
          value={<StatusPill state={health.api} />}
          helper="Dịch vụ backend xử lý booking, auth và vận hành."
        />
        <StatCard
          label="Database"
          value={<StatusPill state={health.database} />}
          helper="PostgreSQL lưu dữ liệu phiên sân, booking, payment và audit."
        />
      </section>
    </div>
  );
}
