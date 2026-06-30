"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Card, Field, Notice, inputClassName } from "@/components/ui";
import { API_BASE_URL } from "@/lib/http";

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");

function googleLoginUrl() {
  return `${API_BASE_URL}/api/v1/auth/google/start`;
}

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitAdmin(event: FormEvent<HTMLFormElement>) {
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
        setError(payload?.error?.message ?? "Đăng nhập admin không thành công");
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
    <main className="mx-auto grid min-h-[calc(100vh-120px)] w-full max-w-6xl items-center px-4 py-8 sm:px-6">
      <section className="grid overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:grid-cols-[1fr_420px]">
        <div
          className="min-h-[320px] bg-cover bg-center p-6 text-white lg:min-h-[560px] lg:p-8"
          style={{
            backgroundImage:
              "linear-gradient(135deg, rgba(127,29,29,0.76), rgba(15,23,42,0.38)), url('/courts/badminton1.jpg')",
          }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-100">NetUp</p>
          <h1 className="mt-4 max-w-xl font-heading text-4xl font-semibold leading-tight">
            Đăng nhập để đặt sân, tham gia giải đấu hoặc quản trị hệ thống.
          </h1>
        </div>

        <div className="space-y-5 p-5 sm:p-7">
          <Card className="space-y-4 border-red-100 bg-red-50/40">
            <div>
              <h2 className="font-heading text-xl font-semibold text-ink">Người chơi / Chủ sân</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Sử dụng tài khoản Google để đồng bộ hồ sơ và đăng ký dịch vụ.
              </p>
            </div>
            <a
              href={googleLoginUrl()}
              className="inline-flex w-full items-center justify-center rounded-lg bg-red-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-900"
            >
              Tiếp tục với Google
            </a>
          </Card>

          <form onSubmit={submitAdmin} className="space-y-4 rounded-lg border border-slate-200 p-5">
            <div>
              <h2 className="font-heading text-xl font-semibold text-ink">Admin</h2>
              <p className="mt-1 text-sm text-slate-600">Tài khoản demo: admin / admin12345</p>
            </div>

            <Field label="Tài khoản">
              <input
                className={inputClassName}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
              />
            </Field>

            <Field label="Mật khẩu">
              <input
                className={inputClassName}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                autoComplete="current-password"
              />
            </Field>

            {error ? <Notice tone="danger">{error}</Notice> : null}

            <Button className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Đang đăng nhập..." : "Đăng nhập admin"}
            </Button>
          </form>
        </div>
      </section>
    </main>
  );
}
