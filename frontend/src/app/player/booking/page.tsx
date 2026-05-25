"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Badge, Button, ButtonLink, Card, EmptyState, Field, Notice, PageHero, inputClassName } from "@/components/ui";
import { apiFetch } from "@/lib/http";
import {
  bookingModeLabel,
  bookingStatusLabel,
  courtImageForSport,
  errorMessage,
  formatTimeRange,
  formatVnd,
  paymentMethodLabel,
  postTypeLabel,
  sportLabel,
} from "@/lib/format";

type BookingMode = "solo" | "full_court";
type PaymentMethod = "vnpay" | "cash";

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
  address?: string;
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

type DepositIntent = {
  booking_id: string;
  booking_code: string;
  payment_transaction_id: string;
  external_ref: string;
  amount_vnd: number;
  status: string;
  expires_at: string | null;
  payment_url: string;
};

function BookingCreateContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId") ?? "";
  const modeParam = searchParams.get("mode");

  const [session, setSession] = useState<SessionDetail | null>(null);
  const [booking, setBooking] = useState<BookingResult | null>(null);
  const [depositIntent, setDepositIntent] = useState<DepositIntent | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("Đang chuẩn bị thông tin đặt sân...");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingDeposit, setIsCreatingDeposit] = useState(false);

  const [mode, setMode] = useState<BookingMode>(modeParam === "full_court" ? "full_court" : "solo");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [seatsBooked, setSeatsBooked] = useState("1");

  async function loadSession() {
    if (!sessionId) {
      setSession(null);
      setMessage("Hãy chọn một khung giờ từ trang đặt sân trước.");
      return;
    }

    setError("");
    try {
      const detail = await apiFetch<SessionDetail>(`/api/v1/player/sessions/${sessionId}`, {
        credentials: "include",
      });
      setSession(detail);
      if (!detail.allows_solo_join || modeParam === "full_court") {
        setMode("full_court");
      }
      setMessage("Kiểm tra lại thông tin rồi xác nhận booking.");
    } catch (caught) {
      setSession(null);
      setError(errorMessage(caught, "Không tải được chi tiết phiên sân"));
      setMessage("Không thể mở form booking.");
    }
  }

  useEffect(() => {
    void loadSession();
  }, [sessionId]);

  const estimate = useMemo(() => {
    if (!session) return null;
    const seats = mode === "full_court" ? session.max_slots : Math.max(1, Math.min(2, Number(seatsBooked || "1")));
    const base = mode === "full_court" ? session.full_court_price_vnd : session.slot_price_vnd * seats;
    return { seats, base };
  }, [mode, seatsBooked, session]);

  async function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    setIsSubmitting(true);
    setError("");
    setDepositIntent(null);
    try {
      const payload: Record<string, unknown> = {
        session_id: session.id,
        mode,
        payment_method: paymentMethod,
      };
      if (mode === "solo") {
        payload.seats_booked = Math.max(1, Math.min(2, Number(seatsBooked || "1")));
      }
      const created = await apiFetch<BookingResult>("/api/v1/player/bookings", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify(payload),
      });
      setBooking(created);
      setMessage("Booking đã được tạo. Bước tiếp theo là thanh toán tiền cọc.");
    } catch (caught) {
      setBooking(null);
      setError(errorMessage(caught, "Không tạo được booking"));
      setMessage("Booking chưa thành công.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function createDepositIntent() {
    if (!booking) return;
    setIsCreatingDeposit(true);
    setError("");
    try {
      const intent = await apiFetch<DepositIntent>(`/api/v1/player/bookings/${booking.id}/deposit-payment`, {
        method: "POST",
        credentials: "include",
      });
      setDepositIntent(intent);
      setMessage("Đã tạo giao dịch cọc. Mở VNPay sandbox để hoàn tất thanh toán.");
    } catch (caught) {
      setDepositIntent(null);
      setError(errorMessage(caught, "Không tạo được giao dịch cọc"));
    } finally {
      setIsCreatingDeposit(false);
    }
  }

  if (!sessionId) {
    return (
      <EmptyState
        title="Chưa chọn khung giờ"
        description="Bạn cần vào trang đặt sân và chọn một khung giờ trước khi tạo booking."
        action={<ButtonLink href="/player/discovery">Tìm sân ngay</ButtonLink>}
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Xác nhận booking"
        title={session ? session.sub_court_name : "Đang tải khung giờ"}
        description={message}
        actions={
          <>
            <ButtonLink href="/player/discovery" variant="outline">
              Chọn khung giờ khác
            </ButtonLink>
            <ButtonLink href="/player/bookings" variant="outline">
              Booking của tôi
            </ButtonLink>
          </>
        }
        aside={
          <div
            className="min-h-[220px] rounded-lg bg-cover bg-center"
            style={{
              backgroundImage: `linear-gradient(130deg, rgba(15,23,42,0.2), rgba(127,29,29,0.36)), url('${courtImageForSport(
                session?.sport,
              )}')`,
            }}
            aria-hidden="true"
          />
        }
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}

      <section className="grid gap-5 lg:grid-cols-[1fr_420px]">
        <div className="space-y-5">
          <Card className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-heading text-xl font-semibold text-ink">
                  {session?.title ?? "Chưa có thông tin sân"}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {session
                    ? `${session.complex_name} · ${session.court_name} - ${session.sub_court_name}`
                    : "Đang tải dữ liệu"}
                </p>
              </div>
              {session ? <Badge tone="accent">{postTypeLabel(session.post_type)}</Badge> : null}
            </div>

            {session ? (
              <div className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
                <p>
                  <span className="font-semibold text-slate-950">Thời gian:</span>{" "}
                  {formatTimeRange(session.starts_at, session.duration_minutes)}
                </p>
                <p>
                  <span className="font-semibold text-slate-950">Môn:</span> {sportLabel(session.sport)}
                </p>
                <p>
                  <span className="font-semibold text-slate-950">Khu vực:</span> {session.district}
                </p>
                <p>
                  <span className="font-semibold text-slate-950">Slot còn:</span> {session.open_slots}/
                  {session.max_slots}
                </p>
                <p>
                  <span className="font-semibold text-slate-950">Giá ghép:</span>{" "}
                  {formatVnd(session.slot_price_vnd)}
                </p>
                <p>
                  <span className="font-semibold text-slate-950">Bao sân:</span>{" "}
                  {formatVnd(session.full_court_price_vnd)}
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-600">Chưa đọc được phiên sân.</p>
            )}
          </Card>

          {booking ? (
            <Card className="space-y-4 border-emerald-200 bg-emerald-50">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-emerald-800">Tạo booking thành công</p>
                  <h2 className="mt-1 font-heading text-2xl font-semibold text-emerald-950">
                    {booking.booking_code}
                  </h2>
                </div>
                <Badge tone="success">{bookingStatusLabel(booking.status)}</Badge>
              </div>
              <div className="grid gap-3 text-sm text-emerald-950 sm:grid-cols-3">
                <p>
                  <span className="block text-emerald-800">Tổng tiền</span>
                  <strong>{formatVnd(booking.total_price_vnd)}</strong>
                </p>
                <p>
                  <span className="block text-emerald-800">Tiền cọc</span>
                  <strong>{formatVnd(booking.deposit_required_vnd)}</strong>
                </p>
                <p>
                  <span className="block text-emerald-800">Còn lại</span>
                  <strong>{formatVnd(booking.remaining_due_vnd)}</strong>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={createDepositIntent} disabled={isCreatingDeposit} variant="secondary">
                  {isCreatingDeposit ? "Đang tạo giao dịch..." : "Thanh toán cọc VNPay"}
                </Button>
                <ButtonLink href="/player/bookings" variant="outline">
                  Xem booking của tôi
                </ButtonLink>
              </div>
            </Card>
          ) : null}

          {depositIntent ? (
            <Card className="space-y-3">
              <h2 className="font-heading text-xl font-semibold text-ink">Giao dịch cọc đã sẵn sàng</h2>
              <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                <p>
                  <span className="font-semibold text-slate-950">Mã giao dịch:</span>{" "}
                  {depositIntent.external_ref}
                </p>
                <p>
                  <span className="font-semibold text-slate-950">Số tiền:</span>{" "}
                  {formatVnd(depositIntent.amount_vnd)}
                </p>
                <p>
                  <span className="font-semibold text-slate-950">Trạng thái:</span> {depositIntent.status}
                </p>
                <p>
                  <span className="font-semibold text-slate-950">Hết hạn:</span>{" "}
                  {depositIntent.expires_at
                    ? new Date(depositIntent.expires_at).toLocaleString("vi-VN")
                    : "Không có"}
                </p>
              </div>
              <a
                className="inline-flex items-center justify-center rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                href={depositIntent.payment_url}
                target="_blank"
                rel="noreferrer"
              >
                Mở VNPay sandbox
              </a>
            </Card>
          ) : null}
        </div>

        <form onSubmit={submitBooking} className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="font-heading text-xl font-semibold text-ink">Chọn cách đặt</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Tiền cọc luôn thanh toán online. Phần còn lại có thể trả tại sân hoặc qua VNPay.
            </p>
          </div>

          <Field label="Kiểu booking">
            <select
              className={inputClassName}
              value={mode}
              onChange={(event) => setMode(event.target.value as BookingMode)}
            >
              <option value="solo" disabled={session ? !session.allows_solo_join : false}>
                Ghép lẻ theo slot
              </option>
              <option value="full_court">Bao nguyên sân</option>
            </select>
          </Field>

          {mode === "solo" ? (
            <Field label="Số slot" helper="Mỗi booking ghép lẻ hiện cho phép 1-2 slot.">
              <input
                className={inputClassName}
                value={seatsBooked}
                onChange={(event) => setSeatsBooked(event.target.value)}
                inputMode="numeric"
                min={1}
                max={2}
              />
            </Field>
          ) : (
            <Notice tone="info">Bạn đang bao trọn sân cho nhóm riêng.</Notice>
          )}

          <Field label="Thanh toán phần còn lại">
            <select
              className={inputClassName}
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
            >
              <option value="cash">Trả tại sân</option>
              <option value="vnpay">Thanh toán VNPay</option>
            </select>
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["Loại đặt", bookingModeLabel(mode)],
              ["Tạm tính", estimate ? formatVnd(estimate.base) : "-"],
              ["Số slot", String(estimate?.seats ?? "-")],
              ["Thanh toán", paymentMethodLabel(paymentMethod)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
                <p className="mt-1 text-sm font-semibold text-slate-950">{value}</p>
              </div>
            ))}
          </div>

          <Button className="w-full" disabled={!session || isSubmitting}>
            {isSubmitting ? "Đang tạo booking..." : "Xác nhận booking"}
          </Button>
        </form>
      </section>
    </div>
  );
}

export default function PlayerBookingCreatePage() {
  return (
    <Suspense fallback={<EmptyState title="Đang mở booking" description="NetUp đang chuẩn bị form đặt sân." />}>
      <BookingCreateContent />
    </Suspense>
  );
}
