"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Card, Field, Notice, inputClassName } from "@/components/ui";

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");

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
    <main className="grid min-h-[calc(100vh-120px)] place-items-center">
      <Card className="grid w-full max-w-5xl overflow-hidden p-0 lg:grid-cols-[1fr_440px]">
        <div
          className="hidden min-h-[520px] bg-cover bg-center lg:block"
          style={{
            backgroundImage:
              "linear-gradient(130deg, rgba(15,23,42,0.2), rgba(127,29,29,0.38)), url('/courts/badminton1.jpg')",
          }}
          aria-hidden="true"
        />
        <form onSubmit={submit} className="space-y-5 p-6 sm:p-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-800">
              NetUp quản trị
            </p>
            <h1 className="mt-3 font-heading text-3xl font-semibold text-ink">Đăng nhập quản trị</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Khu vực nội bộ để theo dõi vận hành, duyệt chủ sân và thay đổi cấu hình hệ thống.
            </p>
          </div>

          <Field label="Tên đăng nhập">
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
            {isSubmitting ? "Đang đăng nhập..." : "Đăng nhập"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
