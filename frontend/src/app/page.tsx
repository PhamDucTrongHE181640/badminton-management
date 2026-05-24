"use client";

import { useEffect, useMemo, useState } from "react";

type ServiceState = "checking" | "online" | "offline";

type HealthState = {
  api: ServiceState;
  database: ServiceState;
  apiMessage: string;
  databaseMessage: string;
};

type UserProfile = {
  email: string;
  full_name: string;
  roles: string[];
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const sprintItems = [
  "Cấu trúc monorepo cho frontend và backend",
  "FastAPI, healthcheck và chuẩn lỗi",
  "Migration Postgres từ schema.sql",
  "Nền tảng Docker Compose",
  "CI cho lint, test, migration và build",
];

const services = [
  { name: "frontend", port: "3000", purpose: "Giao diện Next.js 15" },
  { name: "backend-api", port: "8000", purpose: "FastAPI và OpenAPI" },
  { name: "postgres", port: "5432", purpose: "Cơ sở dữ liệu quan hệ NetUp" },
  { name: "redis", port: "6379", purpose: "Cache, giới hạn tần suất và hàng đợi nền" },
  { name: "adminer", port: "8080", purpose: "Giao diện quản trị cơ sở dữ liệu" },
];

const roles = [
  {
    name: "Người chơi",
    title: "Tìm sân, đặt sân, thanh toán",
    description: "Discovery, xem phiên sân, tạo booking solo/full-court đã nối API ở Sprint 3.",
    href: "/player/discovery",
  },
  {
    name: "Chủ sân",
    title: "Quản lý sân và check-in",
    description: "Onboarding chủ sân và quản lý inventory sân đã nối API thật ở Sprint 2.",
    href: "/owner/dashboard",
  },
  {
    name: "Quản trị",
    title: "Cấu hình và vận hành",
    description: "Đăng nhập admin local và duyệt owner request qua route ẩn.",
    href: "/_internal/netup-admin/login",
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
    <span className={`rounded border px-2 py-1 text-xs font-semibold uppercase ${styles[state]}`}>
      {labels[state]}
    </span>
  );
}

async function readHealth(path: string): Promise<boolean> {
  const response = await fetch(`${apiBaseUrl}${path}`, { cache: "no-store" });
  return response.ok;
}

export default function Home() {
  const [health, setHealth] = useState<HealthState>({
    api: "checking",
    database: "checking",
    apiMessage: "Đang kiểm tra API",
    databaseMessage: "Đang kiểm tra cơ sở dữ liệu",
  });
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authMessage, setAuthMessage] = useState("Đang kiểm tra phiên đăng nhập");
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      try {
        const response = await fetch(`${apiBaseUrl}/api/v1/auth/me`, {
          cache: "no-store",
          credentials: "include",
        });

        if (cancelled) {
          return;
        }

        if (!response.ok) {
          setUser(null);
          setAuthMessage("Chưa đăng nhập");
          return;
        }

        setUser(await response.json());
        setAuthMessage("Đã đăng nhập");
      } catch {
        if (!cancelled) {
          setUser(null);
          setAuthMessage("Chưa đọc được phiên đăng nhập");
        }
      }
    }

    async function checkHealth() {
      const [liveResult, readyResult] = await Promise.allSettled([
        readHealth("/api/v1/health/live"),
        readHealth("/api/v1/health/ready"),
      ]);

      if (cancelled) {
        return;
      }

      const apiOnline = liveResult.status === "fulfilled" && liveResult.value;
      const databaseOnline = readyResult.status === "fulfilled" && readyResult.value;

      setHealth({
        api: apiOnline ? "online" : "offline",
        database: databaseOnline ? "online" : "offline",
        apiMessage: apiOnline ? "FastAPI đang phản hồi" : "Không kết nối được FastAPI",
        databaseMessage: databaseOnline
          ? "Postgres đã sẵn sàng"
          : "Postgres chưa sẵn sàng",
      });
    }

    checkAuth();
    checkHealth();
    const intervalId = window.setInterval(checkHealth, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  async function logout() {
    setIsLoggingOut(true);
    try {
      await fetch(`${apiBaseUrl}/api/v1/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
    } finally {
      setUser(null);
      setAuthMessage("Đã đăng xuất");
      setIsLoggingOut(false);
    }
  }

  const completedCount = useMemo(() => sprintItems.length, []);

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-slate-950">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-8 lg:flex-row lg:items-end lg:justify-between lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
              NetUp Sprint 0
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-normal text-slate-950 sm:text-5xl">
              Nền tảng vận hành
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
              FastAPI, Postgres, Redis, Docker Compose, migration, CI và giao diện đầu tiên
              cho các luồng Người chơi, Chủ sân và Quản trị.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {user ? (
                <button
                  className="rounded bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                  disabled={isLoggingOut}
                  onClick={logout}
                >
                  {isLoggingOut ? "Đang đăng xuất" : "Đăng xuất"}
                </button>
              ) : (
                <a
                  className="rounded bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                  href={`${apiBaseUrl}/api/v1/auth/google/start`}
                >
                  Đăng nhập bằng Google
                </a>
              )}
              <a
                className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                href="/_internal/netup-admin/login"
              >
                Vào trang quản trị
              </a>
              <a
                className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                href="/owner/dashboard"
              >
                Vào khu chủ sân
              </a>
              <a
                className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                href="/player/discovery"
              >
                Vào khu người chơi
              </a>
            </div>
            <div className="mt-5 rounded border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">
                Phiên người dùng
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{authMessage}</p>
              {user ? (
                <p className="mt-1 text-sm text-slate-600">
                  {user.full_name} · {user.email} · Quyền: {user.roles.join(", ")}
                </p>
              ) : (
                <p className="mt-1 text-sm text-slate-600">
                  Đăng nhập bằng Google để tạo hoặc tiếp tục phiên người chơi.
                </p>
              )}
            </div>
          </div>
          <div className="grid min-w-72 grid-cols-2 gap-3 rounded border border-slate-200 bg-slate-50 p-4">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">API</p>
              <div className="mt-2">
                <StatusPill state={health.api} />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Cơ sở dữ liệu</p>
              <div className="mt-2">
                <StatusPill state={health.database} />
              </div>
            </div>
            <p className="col-span-2 text-sm text-slate-600">{health.apiMessage}</p>
            <p className="col-span-2 text-sm text-slate-600">{health.databaseMessage}</p>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
        <div className="rounded border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Checklist sprint</h2>
              <p className="mt-1 text-sm text-slate-600">
                {completedCount} hạng mục nền tảng đã sẵn sàng để kiểm tra Sprint 0.
              </p>
            </div>
            <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
              Sẵn sàng kiểm tra
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {sprintItems.map((item) => (
              <div key={item} className="rounded border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-900">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-semibold text-slate-950">Hợp đồng API</h2>
          <div className="mt-5 space-y-3">
            <div className="rounded border border-slate-200 bg-slate-50 p-4">
              <p className="font-mono text-sm text-slate-900">GET /api/v1/health/live</p>
              <p className="mt-1 text-sm text-slate-600">
                Kiểm tra tiến trình API, không phụ thuộc cơ sở dữ liệu.
              </p>
            </div>
            <div className="rounded border border-slate-200 bg-slate-50 p-4">
              <p className="font-mono text-sm text-slate-900">GET /api/v1/health/ready</p>
              <p className="mt-1 text-sm text-slate-600">
                Kiểm tra Postgres bằng truy vấn SELECT 1.
              </p>
            </div>
          </div>
          <a
            className="mt-5 inline-flex rounded bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            href={`${apiBaseUrl}/api/docs`}
            target="_blank"
            rel="noreferrer"
          >
            Mở tài liệu API
          </a>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-8 lg:grid-cols-5 lg:px-8">
        {services.map((service) => (
          <div key={service.name} className="rounded border border-slate-200 bg-white p-5">
            <p className="font-mono text-sm font-semibold text-slate-950">{service.name}</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">{service.port}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{service.purpose}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-10 lg:grid-cols-3 lg:px-8">
        {roles.map((role) => (
          <div key={role.name} className="rounded border border-slate-200 bg-white p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
              {role.name}
            </p>
            <h2 className="mt-3 text-xl font-semibold text-slate-950">{role.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{role.description}</p>
            {role.href ? (
              <a
                className="mt-5 inline-flex w-full justify-center rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                href={role.href}
              >
                Mở khu vực
              </a>
            ) : (
              <button
                className="mt-5 w-full rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-500"
                disabled
              >
                Sẽ mở ở sprint tiếp theo
              </button>
            )}
          </div>
        ))}
      </section>
    </main>
  );
}
