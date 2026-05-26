"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type UserProfile = {
  email: string;
  full_name: string;
  roles: string[];
};

type SkillTierSummary = {
  has_assessment: boolean;
};

export default function GoogleCallbackPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [message, setMessage] = useState("Đang hoàn tất đăng nhập Google...");
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    async function loadMe() {
      const response = await fetch(`${apiBaseUrl}/api/v1/auth/me`, {
        credentials: "include",
      });
      if (!response.ok) {
        setMessage("Không đọc được phiên đăng nhập. Vui lòng thử lại.");
        return;
      }

      const profile = await response.json();
      setUser(profile);

      const tierResponse = await fetch(`${apiBaseUrl}/api/v1/player/skill-tier`, {
        credentials: "include",
      });
      if (tierResponse.ok) {
        const tier = (await tierResponse.json()) as SkillTierSummary;
        if (!tier.has_assessment) {
          setMessage("Đăng nhập thành công. Đang mở bước thiết lập trình độ ban đầu...");
          router.replace("/player/assessment?firstLogin=1");
          return;
        }
      }

      setMessage("Đăng nhập Google thành công");
    }

    loadMe();
  }, [router]);

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
      setMessage("Đã đăng xuất");
      setIsLoggingOut(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f7f9] px-6 text-slate-950">
      <section className="w-full max-w-lg rounded border border-slate-200 bg-white p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">
          NetUp
        </p>
        <h1 className="mt-3 text-3xl font-semibold">{message}</h1>
        {user ? (
          <div className="mt-5 rounded border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-600">Tài khoản</p>
            <p className="mt-1 font-semibold">{user.full_name}</p>
            <p className="mt-1 text-sm text-slate-600">{user.email}</p>
            <p className="mt-3 text-sm text-slate-600">
              Quyền hiện tại: {user.roles.join(", ")}
            </p>
          </div>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            className="inline-flex rounded bg-red-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-900"
            href="/"
          >
            Quay về trang chính
          </a>
          {user ? (
            <button
              className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
              disabled={isLoggingOut}
              onClick={logout}
            >
              {isLoggingOut ? "Đang đăng xuất" : "Đăng xuất"}
            </button>
          ) : null}
        </div>
      </section>
    </main>
  );
}
