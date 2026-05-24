"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type Checkin = {
  id: string;
  booking_code: string;
  booking_status: string;
  payment_method: string;
  cash_collected_vnd: number;
  remaining_due_vnd: number;
  checked_in_at: string;
  session_title: string;
  session_starts_at: string;
  complex_name: string;
  court_name: string;
  sub_court_name: string;
};

function money(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

export default function OwnerCheckinPage() {
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [message, setMessage] = useState("Đang tải dữ liệu check-in...");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [method, setMethod] = useState<"booking_code" | "qr">("booking_code");
  const [bookingCode, setBookingCode] = useState("");
  const [qrPayload, setQrPayload] = useState("");
  const [cashCollected, setCashCollected] = useState("");
  const [note, setNote] = useState("");

  async function apiFetch(path: string, init?: RequestInit) {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
    const payload = response.status === 204 ? null : await response.json();
    if (!response.ok) {
      const detail = payload?.error?.details?.[0];
      throw new Error(detail?.field ? `${detail.field}: ${detail.message}` : payload?.error?.message);
    }
    return payload;
  }

  async function loadCheckins() {
    setError("");
    try {
      const payload = await apiFetch("/api/v1/owner/checkins");
      setCheckins(payload as Checkin[]);
      setMessage(`Đang có ${payload.length} lượt check-in`);
    } catch (caught) {
      setCheckins([]);
      setError(caught instanceof Error ? caught.message : "Không tải được check-in");
      setMessage("Cần tài khoản owner đã được duyệt");
    }
  }

  useEffect(() => {
    loadCheckins();
  }, []);

  async function submitCheckin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    try {
      const body: Record<string, unknown> = {
        note: note || null,
      };
      if (method === "booking_code") {
        body.booking_code = bookingCode.trim();
      } else {
        body.qr_payload = qrPayload.trim();
      }
      if (cashCollected.trim()) {
        body.cash_collected_vnd = Number(cashCollected);
      }

      await apiFetch("/api/v1/owner/checkins", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setBookingCode("");
      setQrPayload("");
      setCashCollected("");
      setNote("");
      await loadCheckins();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể check-in");
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
            <h1 className="mt-2 text-3xl font-semibold">Check-in booking</h1>
            <p className="mt-2 text-sm text-slate-600">{message}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              href="/owner/dashboard"
            >
              Dashboard owner
            </Link>
            <Link
              className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              href="/owner/courts"
            >
              Quản lý sân
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
        <form onSubmit={submitCheckin} className="rounded border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold">Tạo check-in</h2>
          <label className="mt-4 grid gap-2 text-sm font-semibold text-slate-700">
            Phương thức xác thực
            <select
              className="rounded border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-900"
              value={method}
              onChange={(event) => setMethod(event.target.value as "booking_code" | "qr")}
            >
              <option value="booking_code">booking_code</option>
              <option value="qr">qr</option>
            </select>
          </label>

          {method === "booking_code" ? (
            <label className="mt-3 grid gap-2 text-sm font-semibold text-slate-700">
              Booking code
              <input
                className="rounded border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-900"
                value={bookingCode}
                onChange={(event) => setBookingCode(event.target.value)}
                required
              />
            </label>
          ) : (
            <label className="mt-3 grid gap-2 text-sm font-semibold text-slate-700">
              QR payload
              <input
                className="rounded border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-900"
                value={qrPayload}
                onChange={(event) => setQrPayload(event.target.value)}
                required
              />
            </label>
          )}

          <label className="mt-3 grid gap-2 text-sm font-semibold text-slate-700">
            Tiền mặt thu tại sân (nếu có)
            <input
              className="rounded border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-900"
              value={cashCollected}
              onChange={(event) => setCashCollected(event.target.value)}
              inputMode="numeric"
              placeholder="Để trống để backend tự tính cho booking cash"
            />
          </label>

          <label className="mt-3 grid gap-2 text-sm font-semibold text-slate-700">
            Ghi chú
            <textarea
              className="min-h-24 rounded border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-900"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>

          <button
            className="mt-5 w-full rounded bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-400"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Đang check-in..." : "Xác nhận check-in"}
          </button>
        </form>

        <div className="rounded border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold">Lịch sử check-in</h2>
          <div className="mt-4 grid gap-3">
            {checkins.map((item) => (
              <article key={item.id} className="rounded border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{item.booking_code}</p>
                  <span className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold uppercase text-slate-700">
                    {item.booking_status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {item.session_title} ·{" "}
                  {new Date(item.session_starts_at).toLocaleString("vi-VN")}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {item.complex_name} · {item.court_name} - {item.sub_court_name}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Thu tiền mặt: {money(item.cash_collected_vnd)}đ · Còn phải thu:{" "}
                  {money(item.remaining_due_vnd)}đ
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Check-in lúc: {new Date(item.checked_in_at).toLocaleString("vi-VN")}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {error ? (
        <section className="mx-auto max-w-7xl px-6 pb-8 lg:px-8">
          <p className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        </section>
      ) : null}
    </main>
  );
}
