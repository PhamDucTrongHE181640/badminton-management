"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/admin/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload?.error?.message ?? "Đăng nhập không thành công");
        return;
      }

      window.localStorage.setItem("netup_admin_access_token", payload.access_token);
      window.localStorage.setItem("netup_admin_refresh_token", payload.refresh_token);
      router.push("/_internal/netup-admin/dashboard");
    } catch {
      setError("Không kết nối được API admin");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f7f9] px-6 text-slate-950">
      <form onSubmit={submit} className="w-full max-w-md rounded border border-slate-200 bg-white p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">
          NetUp Quản trị
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Đăng nhập quản trị</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Đường dẫn nội bộ cho quản trị viên nền tảng. Tài khoản phát triển mặc định là
          <span className="font-mono"> admin</span>.
        </p>

        <label className="mt-6 block text-sm font-semibold text-slate-700" htmlFor="username">
          Tên đăng nhập
        </label>
        <input
          id="username"
          className="mt-2 w-full rounded border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
        />

        <label className="mt-4 block text-sm font-semibold text-slate-700" htmlFor="password">
          Mật khẩu
        </label>
        <input
          id="password"
          className="mt-2 w-full rounded border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          autoComplete="current-password"
        />

        {error ? (
          <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <button
          className="mt-6 w-full rounded bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:bg-slate-400"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>
      </form>
    </main>
  );
}
