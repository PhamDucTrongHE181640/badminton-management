"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type SessionDetail = {
  id: string;
  title: string;
  post_type: string;
  status: string;
  starts_at: string;
  duration_minutes: number;
  open_slots: number;
  max_slots: number;
  slot_price_vnd: number;
  full_court_price_vnd: number;
  allows_solo_join: boolean;
  court_name: string;
  sub_court_name: string;
  sport: string;
  complex_name: string;
  district: string;
};

type BookingResult = {
  id: string;
  booking_code: string;
  status: string;
  total_price_vnd: number;
  deposit_required_vnd: number;
  remaining_due_vnd: number;
  payment_method: string;
};

function money(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

export default function PlayerBookingCreatePage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params?.sessionId ?? "";

  const [session, setSession] = useState<SessionDetail | null>(null);
  const [booking, setBooking] = useState<BookingResult | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("Đang tải chi tiết phiên sân...");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [mode, setMode] = useState<"solo" | "full_court">("solo");
  const [paymentMethod, setPaymentMethod] = useState<"vnpay" | "cash">("cash");
  const [seatsBooked, setSeatsBooked] = useState("1");

  async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
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
    return payload as T;
  }

  async function loadSession() {
    setError("");
    try {
      const detail = await apiFetch<SessionDetail>(`/api/v1/player/sessions/${sessionId}`);
      setSession(detail);
      if (!detail.allows_solo_join) {
        setMode("full_court");
      }
      setMessage("Vui lòng chọn phương án booking");
    } catch (caught) {
      setSession(null);
      setError(caught instanceof Error ? caught.message : "Không tải được chi tiết phiên sân");
      setMessage("Không thể khởi tạo form booking");
    }
  }

  useEffect(() => {
    if (sessionId) {
      loadSession();
    }
  }, [sessionId]);

  const estimate = useMemo(() => {
    if (!session) return null;
    const seats = mode === "full_court" ? session.max_slots : Number(seatsBooked || "1");
    const base = mode === "full_court" ? session.full_court_price_vnd : session.slot_price_vnd * seats;
    return { seats, base };
  }, [mode, seatsBooked, session]);

  async function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    setIsSubmitting(true);
    setError("");
    try {
      const payload: Record<string, unknown> = {
        session_id: session.id,
        mode,
        payment_method: paymentMethod,
      };
      if (mode === "solo") {
        payload.seats_booked = Number(seatsBooked);
      }
      const created = await apiFetch<BookingResult>("/api/v1/player/bookings", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setBooking(created);
      setMessage("Đã tạo booking. Hoàn tất đặt cọc ở Sprint 4.");
    } catch (caught) {
      setBooking(null);
      setError(caught instanceof Error ? caught.message : "Không tạo được booking");
      setMessage("Booking thất bại");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-slate-950">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl flex-col gap-4 px-6 py-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">
              NetUp Booking
            </p>
            <h1 className="mt-2 text-3xl font-semibold">Tạo booking</h1>
            <p className="mt-2 text-sm text-slate-600">{message}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              href="/player/discovery"
            >
              Quay lại discovery
            </Link>
            <Link
              className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              href="/player/bookings"
            >
              Booking của tôi
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-4xl gap-6 px-6 py-8 lg:grid-cols-2 lg:px-8">
        <div className="rounded border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Chi tiết phiên sân</h2>
          {session ? (
            <div className="mt-4 space-y-2 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">{session.title}</p>
              <p>
                {session.complex_name} · {session.court_name} - {session.sub_court_name}
              </p>
              <p>{session.district}</p>
              <p>{new Date(session.starts_at).toLocaleString("vi-VN")}</p>
              <p>
                {session.open_slots}/{session.max_slots} slot · {session.sport}
              </p>
              <p>
                {money(session.slot_price_vnd)}đ/slot · {money(session.full_court_price_vnd)}đ/nguyên sân
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-600">Chưa đọc được phiên sân</p>
          )}
        </div>

        <form onSubmit={submitBooking} className="rounded border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Form booking</h2>
          <label className="mt-4 grid gap-2 text-sm font-semibold text-slate-700">
            Mode
            <select
              className="rounded border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-900"
              value={mode}
              onChange={(event) => setMode(event.target.value as "solo" | "full_court")}
            >
              <option value="solo" disabled={session ? !session.allows_solo_join : false}>
                solo
              </option>
              <option value="full_court">full_court</option>
            </select>
          </label>
          <label className="mt-3 grid gap-2 text-sm font-semibold text-slate-700">
            Phương thức thanh toán phần còn lại
            <select
              className="rounded border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-900"
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value as "vnpay" | "cash")}
            >
              <option value="cash">cash</option>
              <option value="vnpay">vnpay</option>
            </select>
          </label>
          {mode === "solo" ? (
            <label className="mt-3 grid gap-2 text-sm font-semibold text-slate-700">
              Số slot (1-2)
              <input
                className="rounded border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-900"
                value={seatsBooked}
                onChange={(event) => setSeatsBooked(event.target.value)}
                inputMode="numeric"
              />
            </label>
          ) : null}
          <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <p>Ước tính ghế: {estimate?.seats ?? "-"}</p>
            <p>Ước tính base price: {estimate ? `${money(estimate.base)}đ` : "-"}</p>
            <p>Đặt cọc được tính theo cấu hình hệ thống từ backend.</p>
          </div>
          <button
            className="mt-5 w-full rounded bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-400"
            disabled={!session || isSubmitting}
          >
            {isSubmitting ? "Đang tạo booking..." : "Xác nhận booking"}
          </button>
        </form>
      </section>

      {error ? (
        <section className="mx-auto max-w-4xl px-6 pb-4 lg:px-8">
          <p className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        </section>
      ) : null}

      {booking ? (
        <section className="mx-auto max-w-4xl px-6 pb-10 lg:px-8">
          <div className="rounded border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
            <p className="font-semibold">Tạo booking thành công</p>
            <p className="mt-1">Mã booking: {booking.booking_code}</p>
            <p className="mt-1">Trạng thái: {booking.status}</p>
            <p className="mt-1">
              Tổng phí: {money(booking.total_price_vnd)}đ · Cọc: {money(booking.deposit_required_vnd)}
              đ · Còn lại: {money(booking.remaining_due_vnd)}đ
            </p>
          </div>
        </section>
      ) : null}
    </main>
  );
}
