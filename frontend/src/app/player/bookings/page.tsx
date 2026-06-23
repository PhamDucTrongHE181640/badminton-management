"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge, Button, ButtonLink, Card, EmptyState, Notice, PageHero, StatCard } from "@/components/ui";
import { apiFetch } from "@/lib/http";
import {
  bookingModeLabel,
  bookingStatusLabel,
  errorMessage,
  formatDateTime,
  formatVnd,
  paymentMethodLabel,
  sportLabel,
} from "@/lib/format";

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
  district: string | null;
  court_name: string | null;
  sub_court_name: string | null;
  sport: string | null;
  qr_payload?: string;
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

function statusTone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (["confirmed", "checked_in", "completed", "deposit_paid"].includes(status)) return "success";
  if (["awaiting_deposit", "expired"].includes(status)) return "warning";
  if (status === "cancelled") return "danger";
  return "neutral";
}

export default function PlayerBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [message, setMessage] = useState("Đang tải lịch đặt sân của bạn...");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [payingBookingId, setPayingBookingId] = useState<string | null>(null);
  const [depositIntents, setDepositIntents] = useState<Record<string, DepositIntent>>({});

  async function loadBookings() {
    setIsLoading(true);
    setError("");
    try {
      const items = await apiFetch<Booking[]>("/api/v1/player/bookings", {
        credentials: "include",
      });
      setBookings(items);
      setMessage(items.length ? `Bạn đang có ${items.length} booking.` : "Bạn chưa có booking nào.");
    } catch (caught) {
      setBookings([]);
      setError(errorMessage(caught, "Không tải được booking"));
      setMessage("Vui lòng đăng nhập để xem booking.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadBookings();
  }, []);

  async function createDepositIntent(booking: Booking) {
    setPayingBookingId(booking.id);
    setError("");
    try {
      const intent = await apiFetch<DepositIntent>(`/api/v1/player/bookings/${booking.id}/deposit-payment`, {
        method: "POST",
        credentials: "include",
      });
      setDepositIntents((current) => ({ ...current, [booking.id]: intent }));
      setMessage(`Đã tạo link thanh toán cho booking ${booking.booking_code}.`);
    } catch (caught) {
      setError(errorMessage(caught, "Không tạo được link thanh toán VNPay"));
    } finally {
      setPayingBookingId(null);
    }
  }

  const stats = useMemo(() => {
    const upcoming = bookings.filter((item) => item.session_starts_at && new Date(item.session_starts_at) > new Date()).length;
    const needsDeposit = bookings.filter((item) => item.status === "awaiting_deposit").length;
    const checkedIn = bookings.filter((item) => item.status === "checked_in").length;
    const totalValue = bookings.reduce((total, item) => total + item.total_price_vnd, 0);
    return { upcoming, needsDeposit, checkedIn, totalValue };
  }, [bookings]);

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Booking của tôi"
        title="Theo dõi lịch chơi, tiền cọc và mã check-in."
        description={message}
        actions={
          <>
            <ButtonLink href="/player/discovery/?mode=booking">Đặt sân tiếp</ButtonLink>
            <ButtonLink href="/player/matches" variant="outline">
              Lịch đấu
            </ButtonLink>
          </>
        }
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Booking" value={bookings.length} helper={isLoading ? "Đang đồng bộ..." : "Tổng lịch đặt"} />
        <StatCard label="Sắp tới" value={stats.upcoming} helper="Khung giờ chưa diễn ra" tone="accent" />
        <StatCard label="Chờ cọc" value={stats.needsDeposit} helper="Cần hoàn tất thanh toán" tone="warning" />
        <StatCard label="Tổng giá trị" value={formatVnd(stats.totalValue)} helper={`${stats.checkedIn} đã check-in`} />
      </section>

      {bookings.length === 0 && !isLoading ? (
        <EmptyState
          title="Bạn chưa có booking nào"
          description="Chọn kèo chờ ghép hoặc thuê nguyên sân để tạo booking đầu tiên."
          action={<ButtonLink href="/player/discovery/?mode=booking">Tìm sân ngay</ButtonLink>}
        />
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {bookings.map((item) => {
            const depositIntent = depositIntents[item.id];
            const canPayDeposit = item.status === "awaiting_deposit";

            return (
              <Card key={item.id} className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-heading text-xl font-semibold text-ink">
                      {item.session_title ?? "Phiên sân"}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {item.complex_name ?? "Khu sân"} · {item.court_name ?? "Sân"} -{" "}
                      {item.sub_court_name ?? ""}
                    </p>
                  </div>
                  <Badge tone={statusTone(item.status)}>{bookingStatusLabel(item.status)}</Badge>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="font-heading text-2xl font-semibold tracking-wide text-ink">{item.booking_code}</p>
                  <p className="mt-1 text-sm text-slate-600">Đưa mã này cho quầy để check-in.</p>
                </div>

                <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                  <p>
                    <span className="font-semibold text-slate-950">Thời gian:</span>{" "}
                    {formatDateTime(item.session_starts_at)}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-950">Môn:</span> {sportLabel(item.sport)}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-950">Kiểu đặt:</span>{" "}
                    {bookingModeLabel(item.mode)} · {item.seats_booked} slot
                  </p>
                  <p>
                    <span className="font-semibold text-slate-950">Thanh toán:</span>{" "}
                    {paymentMethodLabel(item.payment_method)}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-950">Tổng tiền:</span>{" "}
                    {formatVnd(item.total_price_vnd)}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-950">Cọc / còn lại:</span>{" "}
                    {formatVnd(item.deposit_required_vnd)} / {formatVnd(item.remaining_due_vnd)}
                  </p>
                </div>

                {canPayDeposit ? (
                  <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-amber-950">Booking này đang chờ cọc</p>
                        <p className="mt-1 text-sm text-amber-800">
                          Bạn có thể tạo lại link VNPay cho booking hiện có, không cần đặt lại cùng phiên.
                        </p>
                      </div>
                      <Button
                        type="button"
                        onClick={() => void createDepositIntent(item)}
                        disabled={payingBookingId === item.id}
                        variant="secondary"
                      >
                        {payingBookingId === item.id ? "Đang tạo link..." : "Thanh toán cọc VNPay"}
                      </Button>
                    </div>

                    {depositIntent ? (
                      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-amber-200 pt-3">
                        <div className="text-sm text-amber-900">
                          <p>
                            Mã giao dịch: <span className="font-semibold">{depositIntent.external_ref}</span>
                          </p>
                          <p>
                            Số tiền: <span className="font-semibold">{formatVnd(depositIntent.amount_vnd)}</span>
                          </p>
                        </div>
                        <a
                          className="inline-flex items-center justify-center rounded-lg bg-red-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-900"
                          href={depositIntent.payment_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Mở VNPay sandbox
                        </a>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </Card>
            );
          })}
        </section>
      )}

      {isLoading ? (
        <div className="flex justify-center">
          <Button variant="outline" disabled>
            Đang tải booking...
          </Button>
        </div>
      ) : null}
    </div>
  );
}
