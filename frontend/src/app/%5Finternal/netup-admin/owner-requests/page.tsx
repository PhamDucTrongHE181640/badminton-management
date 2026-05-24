"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type OwnerRequest = {
  id: string;
  user_id: string;
  business_name: string;
  contact_phone: string | null;
  facility_overview: string | null;
  status: string;
  submitted_at: string;
  reviewed_at: string | null;
  review_note: string | null;
  user_email: string | null;
  user_full_name: string | null;
};

const statusLabel: Record<string, string> = {
  pending: "Đang chờ",
  approved: "Đã duyệt",
  rejected: "Đã từ chối",
  cancelled: "Đã hủy",
};

export default function AdminOwnerRequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<OwnerRequest[]>([]);
  const [message, setMessage] = useState("Đang tải hồ sơ owner...");
  const [error, setError] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function accessToken() {
    return window.localStorage.getItem("netup_admin_access_token");
  }

  async function loadRequests() {
    const token = accessToken();
    if (!token) {
      router.push("/_internal/netup-admin/login");
      return;
    }

    setError("");
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/admin/owner-requests`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload?.error?.message ?? "Không tải được hồ sơ owner");
        return;
      }

      setRequests(payload);
      setMessage("Danh sách owner request đã được đồng bộ");
    } catch {
      setError("Không kết nối được API admin");
    }
  }

  useEffect(() => {
    loadRequests();
  }, []);

  async function review(requestId: string, action: "approve" | "reject") {
    const token = accessToken();
    if (!token) {
      router.push("/_internal/netup-admin/login");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/v1/admin/owner-requests/${requestId}/${action}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ review_note: reviewNote || null }),
        },
      );
      const payload = await response.json();

      if (!response.ok) {
        setError(payload?.error?.message ?? "Không cập nhật được hồ sơ owner");
        return;
      }

      setReviewNote("");
      await loadRequests();
    } catch {
      setError("Không kết nối được API admin");
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
              NetUp Quản trị
            </p>
            <h1 className="mt-2 text-3xl font-semibold">Duyệt hồ sơ chủ sân</h1>
            <p className="mt-2 text-sm text-slate-600">{message}</p>
          </div>
          <Link
            className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            href="/_internal/netup-admin/dashboard"
          >
            Bảng điều khiển
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        <label className="grid max-w-2xl gap-2 text-sm font-semibold text-slate-700">
          Ghi chú duyệt áp dụng cho thao tác tiếp theo
          <textarea
            className="min-h-24 rounded border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-900"
            value={reviewNote}
            onChange={(event) => setReviewNote(event.target.value)}
          />
        </label>

        {error ? (
          <p className="mt-5 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <div className="mt-6 grid gap-4">
          {requests.map((request) => (
            <article key={request.id} className="rounded border border-slate-200 bg-white p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">
                    {statusLabel[request.status] ?? request.status}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold">{request.business_name}</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    {request.user_full_name ?? "Người dùng"} ·{" "}
                    {request.user_email ?? "chưa có email"}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Điện thoại: {request.contact_phone ?? "chưa có"}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {request.facility_overview ?? "Chưa có mô tả cơ sở"}
                  </p>
                  {request.review_note ? (
                    <p className="mt-3 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      Ghi chú trước đó: {request.review_note}
                    </p>
                  ) : null}
                </div>
                {request.status === "pending" ? (
                  <div className="flex gap-3">
                    <button
                      className="rounded bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-400"
                      disabled={isSubmitting}
                      onClick={() => review(request.id, "approve")}
                    >
                      Duyệt
                    </button>
                    <button
                      className="rounded border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:text-red-300"
                      disabled={isSubmitting}
                      onClick={() => review(request.id, "reject")}
                    >
                      Từ chối
                    </button>
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
