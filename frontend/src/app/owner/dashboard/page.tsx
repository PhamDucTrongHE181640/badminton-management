"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type UserProfile = {
  email: string;
  full_name: string;
  roles: string[];
};

type OwnerRequest = {
  id: string;
  business_name: string;
  contact_phone: string | null;
  facility_overview: string | null;
  status: string;
  submitted_at: string;
  reviewed_at: string | null;
  review_note: string | null;
};

const statusLabel: Record<string, string> = {
  pending: "Đang chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Đã từ chối",
  cancelled: "Đã hủy",
};

export default function OwnerDashboardPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [requests, setRequests] = useState<OwnerRequest[]>([]);
  const [businessName, setBusinessName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [facilityOverview, setFacilityOverview] = useState("");
  const [message, setMessage] = useState("Đang tải thông tin chủ sân...");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const latestRequest = useMemo(() => requests[0] ?? null, [requests]);
  const isOwner = user?.roles.includes("owner") || latestRequest?.status === "approved";

  async function loadDashboard() {
    setError("");
    try {
      const [meResponse, requestsResponse] = await Promise.all([
        fetch(`${apiBaseUrl}/api/v1/auth/me`, {
          cache: "no-store",
          credentials: "include",
        }),
        fetch(`${apiBaseUrl}/api/v1/owner/requests/me`, {
          cache: "no-store",
          credentials: "include",
        }),
      ]);

      if (!meResponse.ok) {
        setUser(null);
        setMessage("Bạn cần đăng nhập Google trước khi đăng ký chủ sân");
        return;
      }

      setUser(await meResponse.json());
      if (requestsResponse.ok) {
        setRequests(await requestsResponse.json());
      }
      setMessage("Thông tin chủ sân đã sẵn sàng");
    } catch {
      setError("Không kết nối được API chủ sân");
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  async function submitOwnerRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/owner/requests`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_name: businessName,
          contact_phone: contactPhone || null,
          facility_overview: facilityOverview || null,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload?.error?.message ?? "Không gửi được hồ sơ chủ sân");
        return;
      }

      setBusinessName("");
      setContactPhone("");
      setFacilityOverview("");
      await loadDashboard();
    } catch {
      setError("Không kết nối được API chủ sân");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-slate-950">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">
              NetUp Chủ sân
            </p>
            <h1 className="mt-2 text-3xl font-semibold">Bảng điều khiển chủ sân</h1>
            <p className="mt-2 text-sm text-slate-600">{message}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              href="/"
            >
              Trang chính
            </Link>
            {isOwner ? (
              <Link
                className="rounded bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                href="/owner/courts"
              >
                Quản lý sân
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
        <div className="rounded border border-slate-200 bg-white p-6">
          <p className="text-sm font-semibold uppercase text-slate-500">Tài khoản</p>
          <h2 className="mt-3 text-xl font-semibold">
            {user?.full_name ?? "Chưa đăng nhập"}
          </h2>
          <p className="mt-1 text-sm text-slate-600">{user?.email ?? "Không có phiên"}</p>
          <p className="mt-4 text-sm text-slate-600">
            Quyền hiện tại: {user?.roles.join(", ") ?? "chưa có"}
          </p>
          {!user ? (
            <a
              className="mt-5 inline-flex rounded bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              href={`${apiBaseUrl}/api/v1/auth/google/start`}
            >
              Đăng nhập bằng Google
            </a>
          ) : null}
        </div>

        <div className="rounded border border-slate-200 bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase text-slate-500">Hồ sơ owner</p>
              <h2 className="mt-3 text-xl font-semibold">
                {latestRequest
                  ? statusLabel[latestRequest.status] ?? latestRequest.status
                  : "Chưa gửi yêu cầu"}
              </h2>
            </div>
            {isOwner ? (
              <span className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                Có quyền vận hành
              </span>
            ) : null}
          </div>

          {latestRequest ? (
            <div className="mt-5 rounded border border-slate-200 bg-slate-50 p-4">
              <p className="font-semibold text-slate-900">{latestRequest.business_name}</p>
              <p className="mt-2 text-sm text-slate-600">
                Điện thoại: {latestRequest.contact_phone ?? "chưa có"}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {latestRequest.facility_overview ?? "Chưa có mô tả cơ sở"}
              </p>
              {latestRequest.review_note ? (
                <p className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Ghi chú duyệt: {latestRequest.review_note}
                </p>
              ) : null}
            </div>
          ) : null}

          {user && !isOwner && latestRequest?.status !== "pending" ? (
            <form onSubmit={submitOwnerRequest} className="mt-6 grid gap-4">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Tên cơ sở kinh doanh
                <input
                  className="rounded border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-900"
                  value={businessName}
                  onChange={(event) => setBusinessName(event.target.value)}
                  required
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Số điện thoại liên hệ
                <input
                  className="rounded border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-900"
                  value={contactPhone}
                  onChange={(event) => setContactPhone(event.target.value)}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Mô tả cơ sở
                <textarea
                  className="min-h-28 rounded border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-900"
                  value={facilityOverview}
                  onChange={(event) => setFacilityOverview(event.target.value)}
                />
              </label>
              <button
                className="rounded bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-400"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Đang gửi..." : "Gửi yêu cầu chủ sân"}
              </button>
            </form>
          ) : null}

          {error ? (
            <p className="mt-5 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
