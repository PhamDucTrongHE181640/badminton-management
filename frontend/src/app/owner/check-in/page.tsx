"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { Badge, Button, ButtonLink, Card, Field, Notice, PageHero, StatCard, inputClassName } from "@/components/ui";
import { apiFetch } from "@/lib/http";
import { bookingStatusLabel, errorMessage, formatDateTime, formatFullDateTime, formatVnd, paymentMethodLabel } from "@/lib/format";

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

function statusTone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (["checked_in", "completed", "confirmed", "deposit_paid"].includes(status)) return "success";
  if (status === "awaiting_deposit") return "warning";
  if (status === "cancelled") return "danger";
  return "neutral";
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

  async function loadCheckins() {
    setError("");
    try {
      const payload = await apiFetch<Checkin[]>("/api/v1/owner/checkins", {
        credentials: "include",
      });
      setCheckins(payload);
      setMessage(payload.length ? `Đã ghi nhận ${payload.length} lượt check-in.` : "Chưa có lượt check-in nào.");
    } catch (caught) {
      setCheckins([]);
      setError(errorMessage(caught, "Không tải được check-in"));
      setMessage("Cần tài khoản owner đã được duyệt.");
    }
  }

  useEffect(() => {
    void loadCheckins();
  }, []);

  async function submitCheckin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    try {
      const body: Record<string, unknown> = { note: note || null };
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
        credentials: "include",
        body: JSON.stringify(body),
      });
      setBookingCode("");
      setQrPayload("");
      setCashCollected("");
      setNote("");
      await loadCheckins();
    } catch (caught) {
      setError(errorMessage(caught, "Không thể check-in booking"));
    } finally {
      setIsSubmitting(false);
    }
  }

  const todayCount = useMemo(() => {
    const today = new Date().toDateString();
    return checkins.filter((item) => new Date(item.checked_in_at).toDateString() === today).length;
  }, [checkins]);
  const cashCollectedTotal = checkins.reduce((total, item) => total + item.cash_collected_vnd, 0);
  const remainingTotal = checkins.reduce((total, item) => total + item.remaining_due_vnd, 0);

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Check-in tại sân"
        title="Xác nhận người chơi bằng mã booking hoặc QR."
        description={message}
        actions={
          <>
            <ButtonLink href="/owner/courts" variant="outline">
              Quản lý sân
            </ButtonLink>
            <ButtonLink href="/owner/dashboard" variant="outline">
              Tổng quan owner
            </ButtonLink>
          </>
        }
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Check-in hôm nay" value={todayCount} helper="Theo thời gian xác nhận" tone="accent" />
        <StatCard label="Tổng lượt" value={checkins.length} helper="Tất cả lịch sử check-in" />
        <StatCard label="Tiền mặt đã thu" value={formatVnd(cashCollectedTotal)} helper="Phần thu tại sân" tone="success" />
        <StatCard label="Còn phải thu" value={formatVnd(remainingTotal)} helper="Theo booking cash" tone={remainingTotal > 0 ? "warning" : "default"} />
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <form onSubmit={submitCheckin} className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="font-heading text-xl font-semibold text-ink">Tạo check-in</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Nhập mã booking trên điện thoại người chơi. Nếu booking chọn trả tiền mặt, ghi nhận số tiền đã thu tại quầy.
            </p>
          </div>

          <Field label="Phương thức xác thực">
            <select className={inputClassName} value={method} onChange={(event) => setMethod(event.target.value as "booking_code" | "qr")}>
              <option value="booking_code">Mã booking</option>
              <option value="qr">QR payload</option>
            </select>
          </Field>

          {method === "booking_code" ? (
            <Field label="Mã booking">
              <input className={`${inputClassName} font-heading text-lg tracking-wide`} value={bookingCode} onChange={(event) => setBookingCode(event.target.value.toUpperCase())} required />
            </Field>
          ) : (
            <Field label="QR payload">
              <input className={inputClassName} value={qrPayload} onChange={(event) => setQrPayload(event.target.value)} required />
            </Field>
          )}

          <Field label="Tiền mặt thu tại sân" helper="Có thể để trống để backend tự tính theo booking cash.">
            <input className={inputClassName} value={cashCollected} onChange={(event) => setCashCollected(event.target.value)} inputMode="numeric" placeholder="Ví dụ: 120000" />
          </Field>

          <Field label="Ghi chú">
            <textarea className={`${inputClassName} min-h-24`} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ví dụ: Đã thu đủ phần còn lại" />
          </Field>

          <Button className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Đang check-in..." : "Xác nhận check-in"}
          </Button>
        </form>

        <Card className="space-y-4">
          <h2 className="font-heading text-xl font-semibold text-ink">Lịch sử check-in</h2>
          {checkins.length === 0 ? (
            <p className="text-sm leading-6 text-slate-600">
              Khi quầy xác nhận mã booking, lịch sử sẽ xuất hiện tại đây.
            </p>
          ) : (
            <div className="grid gap-3">
              {checkins.map((item) => (
                <article key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-heading text-lg font-semibold text-ink">{item.booking_code}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {item.session_title} · {formatDateTime(item.session_starts_at)}
                      </p>
                    </div>
                    <Badge tone={statusTone(item.booking_status)}>{bookingStatusLabel(item.booking_status)}</Badge>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                    <p>{item.complex_name} · {item.court_name} - {item.sub_court_name}</p>
                    <p>{paymentMethodLabel(item.payment_method)}</p>
                    <p>Đã thu: {formatVnd(item.cash_collected_vnd)}</p>
                    <p>Còn phải thu: {formatVnd(item.remaining_due_vnd)}</p>
                    <p className="sm:col-span-2">Check-in lúc: {formatFullDateTime(item.checked_in_at)}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
