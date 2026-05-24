"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type Booking = {
  id: string;
  booking_code: string;
  session_title: string | null;
  session_starts_at: string | null;
  status: string;
  mode: string;
  payment_method: string;
  seats_booked: number;
  total_price_vnd: number;
  deposit_required_vnd: number;
  remaining_due_vnd: number;
  complex_name: string | null;
  court_name: string | null;
  sub_court_name: string | null;
};

function money(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

export default function PlayerBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [message, setMessage] = useState("Đang tải danh sách booking...");
  const [error, setError] = useState("");

  async function loadBookings() {
    setError("");
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/player/bookings`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });
      const payload = response.status === 204 ? null : await response.json();
      if (!response.ok) {
        const detail = payload?.error?.details?.[0];
        throw new Error(
          detail?.field ? `${detail.field}: ${detail.message}` : payload?.error?.message
        );
      }
      const items = payload as Booking[];
      setBookings(items);
      setMessage(`Đang có ${items.length} booking`);
    } catch (caught) {
      setBookings([]);
      setError(caught instanceof Error ? caught.message : "Không tải được booking");
      setMessage("Vui lòng đăng nhập để xem booking");
    }
  }

  useEffect(() => {
    loadBookings();
  }, []);

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-slate-950">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">
              NetUp Người chơi
            </p>
            <h1 className="mt-2 text-3xl font-semibold">Booking của tôi</h1>
            <p className="mt-2 text-sm text-slate-600">{message}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              href="/player/discovery"
            >
              Tiếp tục discovery
            </Link>
            <Link
              className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              href="/player/matches"
            >
              Match history
            </Link>
            <Link
              className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              href="/"
            >
              Trang chính
            </Link>
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

      <section className="mx-auto grid max-w-7xl gap-4 px-6 py-8 lg:grid-cols-2 lg:px-8">
        {bookings.map((item) => (
          <article key={item.id} className="rounded border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold">{item.booking_code}</p>
              <span className="rounded border border-slate-300 bg-slate-50 px-2 py-1 text-xs font-semibold uppercase text-slate-700">
                {item.status}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-700">{item.session_title ?? "Phiên sân"}</p>
            <p className="mt-1 text-sm text-slate-600">
              {item.complex_name ?? ""} · {item.court_name ?? "Sân"} - {item.sub_court_name ?? ""}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {item.session_starts_at
                ? new Date(item.session_starts_at).toLocaleString("vi-VN")
                : "Chưa có thời gian"}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {item.mode} · {item.seats_booked} slot · {item.payment_method}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Tổng: {money(item.total_price_vnd)}đ · Cọc: {money(item.deposit_required_vnd)}đ · Còn
              lại: {money(item.remaining_due_vnd)}đ
            </p>
          </article>
        ))}
      </section>
    </main>
  );
}
