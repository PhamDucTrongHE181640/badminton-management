"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type AdminProfile = {
  username: string;
  is_super_admin: boolean;
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [message, setMessage] = useState("Đang kiểm tra phiên đăng nhập...");

  useEffect(() => {
    async function loadProfile() {
      const accessToken = window.localStorage.getItem("netup_admin_access_token");
      if (!accessToken) {
        router.push("/_internal/netup-admin/login");
        return;
      }

      const response = await fetch(`${apiBaseUrl}/api/v1/admin/auth/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        window.localStorage.removeItem("netup_admin_access_token");
        window.localStorage.removeItem("netup_admin_refresh_token");
        router.push("/_internal/netup-admin/login");
        return;
      }

      setAdmin(await response.json());
      setMessage("Phiên admin đang hoạt động");
    }

    loadProfile();
  }, [router]);

  async function logout() {
    const refreshToken = window.localStorage.getItem("netup_admin_refresh_token");
    if (refreshToken) {
      await fetch(`${apiBaseUrl}/api/v1/admin/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    }
    window.localStorage.removeItem("netup_admin_access_token");
    window.localStorage.removeItem("netup_admin_refresh_token");
    router.push("/_internal/netup-admin/login");
  }

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-slate-950">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">
              NetUp Quản trị
            </p>
            <h1 className="mt-2 text-2xl font-semibold">Bảng điều khiển quản trị</h1>
          </div>
          <button
            className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            onClick={logout}
          >
            Đăng xuất
          </button>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-3 lg:px-8">
        <div className="rounded border border-slate-200 bg-white p-6">
          <p className="text-sm font-semibold uppercase text-slate-500">Tài khoản</p>
          <h2 className="mt-3 text-xl font-semibold">{admin?.username ?? "Đang tải"}</h2>
          <p className="mt-2 text-sm text-slate-600">
            {admin?.is_super_admin ? "Quản trị viên cấp cao" : "Quản trị viên vận hành"}
          </p>
        </div>
        <div className="rounded border border-slate-200 bg-white p-6">
          <p className="text-sm font-semibold uppercase text-slate-500">Trạng thái</p>
          <h2 className="mt-3 text-xl font-semibold">{message}</h2>
          <p className="mt-2 text-sm text-slate-600">Token admin được kiểm tra qua API backend.</p>
        </div>
        <div className="rounded border border-slate-200 bg-white p-6">
          <p className="text-sm font-semibold uppercase text-slate-500">Sprint kế tiếp</p>
          <h2 className="mt-3 text-xl font-semibold">Duyệt owner và cấu hình hệ thống</h2>
          <p className="mt-2 text-sm text-slate-600">
            Các màn hình nghiệp vụ sẽ được nối sau khi API domain hoàn tất.
          </p>
          <a
            className="mt-5 inline-flex rounded bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            href="/_internal/netup-admin/owner-requests"
          >
            Mở duyệt owner
          </a>
        </div>
      </section>
    </main>
  );
}
