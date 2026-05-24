"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { adminFetch, adminLogout } from "../_lib/auth";

type AdminProfile = {
  username: string;
  is_super_admin: boolean;
};

type AdminDashboardMetrics = {
  bookings: {
    total: number;
    awaiting_deposit: number;
    checked_in: number;
    completed: number;
    last_7d: number;
  };
  payments: {
    total: number;
    paid: number;
    processing: number;
    paid_amount_vnd: number;
  };
  checkins: {
    total: number;
    last_7d: number;
  };
  owner_requests: {
    pending: number;
    approved: number;
    rejected: number;
  };
};

type AuditLog = {
  id: string;
  actor_user_id: string | null;
  actor_email: string | null;
  actor_full_name: string | null;
  event_type: string;
  entity_type: string;
  entity_id: string;
  payload: Record<string, unknown>;
  created_at: string;
};

function formatVnd(value: number): string {
  return new Intl.NumberFormat("vi-VN").format(value);
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [metrics, setMetrics] = useState<AdminDashboardMetrics | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const [entityTypeFilter, setEntityTypeFilter] = useState("");
  const [message, setMessage] = useState("Đang tải dữ liệu dashboard...");
  const [error, setError] = useState("");

  async function bootstrap() {
    setError("");
    try {
      const [profile, dashboardMetrics] = await Promise.all([
        adminFetch<AdminProfile>("/api/v1/admin/auth/me"),
        adminFetch<AdminDashboardMetrics>("/api/v1/admin/dashboard/metrics"),
      ]);
      setAdmin(profile);
      setMetrics(dashboardMetrics);
      setMessage("Dashboard đã đồng bộ số liệu vận hành.");
      await loadAuditLogs(eventTypeFilter, entityTypeFilter);
    } catch (caught) {
      const nextError = caught instanceof Error ? caught.message : "Không tải được dashboard";
      if (nextError === "admin_unauthorized") {
        router.push("/_internal/netup-admin/login");
        return;
      }
      setError(nextError);
      setMessage("Không thể tải dashboard admin.");
      setAdmin(null);
      setMetrics(null);
      setAuditLogs([]);
    }
  }

  async function loadAuditLogs(nextEventType: string, nextEntityType: string) {
    const query = new URLSearchParams();
    query.set("limit", "40");
    if (nextEventType.trim()) query.set("event_type", nextEventType.trim());
    if (nextEntityType.trim()) query.set("entity_type", nextEntityType.trim());

    try {
      const logs = await adminFetch<AuditLog[]>(`/api/v1/admin/audit-logs?${query.toString()}`);
      setAuditLogs(logs);
    } catch (caught) {
      const nextError = caught instanceof Error ? caught.message : "Không tải được audit logs";
      if (nextError === "admin_unauthorized") {
        router.push("/_internal/netup-admin/login");
        return;
      }
      setError(nextError);
      setAuditLogs([]);
    }
  }

  useEffect(() => {
    bootstrap();
  }, []);

  async function applyAuditFilter() {
    await loadAuditLogs(eventTypeFilter, entityTypeFilter);
  }

  async function logout() {
    await adminLogout();
    router.push("/_internal/netup-admin/login");
  }

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-slate-950">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">
              NetUp Quản trị
            </p>
            <h1 className="mt-2 text-3xl font-semibold">Bảng điều khiển vận hành</h1>
            <p className="mt-2 text-sm text-slate-600">{message}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              href="/_internal/netup-admin/config"
            >
              Cấu hình hệ thống
            </Link>
            <Link
              className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              href="/_internal/netup-admin/owner-requests"
            >
              Duyệt owner
            </Link>
            <button
              className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={logout}
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <section className="mx-auto max-w-7xl px-6 py-4 lg:px-8">
          <p className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        </section>
      ) : null}

      <section className="mx-auto grid max-w-7xl gap-5 px-6 py-8 lg:grid-cols-4 lg:px-8">
        <article className="rounded border border-slate-200 bg-white p-5 lg:col-span-1">
          <p className="text-xs font-semibold uppercase text-slate-500">Admin</p>
          <h2 className="mt-2 text-xl font-semibold">{admin?.username ?? "Đang tải"}</h2>
          <p className="mt-2 text-sm text-slate-600">
            {admin?.is_super_admin ? "Quản trị viên cấp cao" : "Quản trị viên vận hành"}
          </p>
        </article>

        <article className="rounded border border-slate-200 bg-white p-5 lg:col-span-1">
          <p className="text-xs font-semibold uppercase text-slate-500">Bookings</p>
          <h2 className="mt-2 text-xl font-semibold">{metrics?.bookings.total ?? 0}</h2>
          <p className="mt-2 text-sm text-slate-600">
            Awaiting deposit: {metrics?.bookings.awaiting_deposit ?? 0}
          </p>
          <p className="mt-1 text-sm text-slate-600">Checked-in: {metrics?.bookings.checked_in ?? 0}</p>
          <p className="mt-1 text-sm text-slate-600">Last 7d: {metrics?.bookings.last_7d ?? 0}</p>
        </article>

        <article className="rounded border border-slate-200 bg-white p-5 lg:col-span-1">
          <p className="text-xs font-semibold uppercase text-slate-500">Payments</p>
          <h2 className="mt-2 text-xl font-semibold">{metrics?.payments.paid ?? 0}</h2>
          <p className="mt-2 text-sm text-slate-600">Processing: {metrics?.payments.processing ?? 0}</p>
          <p className="mt-1 text-sm text-slate-600">
            Paid amount: {formatVnd(metrics?.payments.paid_amount_vnd ?? 0)}đ
          </p>
        </article>

        <article className="rounded border border-slate-200 bg-white p-5 lg:col-span-1">
          <p className="text-xs font-semibold uppercase text-slate-500">Owner Requests</p>
          <h2 className="mt-2 text-xl font-semibold">{metrics?.owner_requests.pending ?? 0}</h2>
          <p className="mt-2 text-sm text-slate-600">Approved: {metrics?.owner_requests.approved ?? 0}</p>
          <p className="mt-1 text-sm text-slate-600">Rejected: {metrics?.owner_requests.rejected ?? 0}</p>
          <p className="mt-1 text-sm text-slate-600">Check-ins: {metrics?.checkins.total ?? 0}</p>
        </article>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-10 lg:px-8">
        <div className="rounded border border-slate-200 bg-white p-5">
          <h2 className="text-xl font-semibold">Audit trail</h2>
          <p className="mt-2 text-sm text-slate-600">
            Theo dõi thay đổi config/role/action của admin trong hệ thống.
          </p>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              event_type
              <input
                className="rounded border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-900"
                value={eventTypeFilter}
                onChange={(event) => setEventTypeFilter(event.target.value)}
                placeholder="admin_config_updated"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              entity_type
              <input
                className="rounded border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-900"
                value={entityTypeFilter}
                onChange={(event) => setEntityTypeFilter(event.target.value)}
                placeholder="admin_config"
              />
            </label>
            <div className="flex items-end">
              <button
                className="rounded bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                onClick={applyAuditFilter}
              >
                Lọc audit logs
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            {auditLogs.length === 0 ? (
              <p className="text-sm text-slate-600">Chưa có audit log theo điều kiện lọc.</p>
            ) : (
              auditLogs.map((item) => (
                <article key={item.id} className="rounded border border-slate-200 bg-slate-50 p-4 text-sm">
                  <p className="font-semibold text-slate-900">
                    {item.event_type} · {item.entity_type}#{item.entity_id}
                  </p>
                  <p className="mt-1 text-slate-600">
                    Actor: {item.actor_full_name || item.actor_email || item.actor_user_id || "system"}
                  </p>
                  <p className="mt-1 text-slate-600">
                    {new Date(item.created_at).toLocaleString("vi-VN")}
                  </p>
                  <pre className="mt-2 overflow-x-auto rounded border border-slate-200 bg-white p-2 text-xs text-slate-700">
                    {JSON.stringify(item.payload, null, 2)}
                  </pre>
                </article>
              ))
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
