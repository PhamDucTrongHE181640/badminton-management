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

type BookingMatch = {
  id: string;
  booking_code: string;
  session_id: string;
  session_title: string | null;
  session_starts_at: string | null;
  status: string;
  mode: string;
  payment_method: string;
  seats_booked: number;
  total_price_vnd: number;
  deposit_required_vnd: number;
  remaining_due_vnd: number;
  checked_in_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  complex_name: string | null;
  district: string | null;
  court_name: string | null;
  sub_court_name: string | null;
  sport: string | null;
};

const inactiveStatuses = new Set(["cancelled", "expired"]);

function statusTone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (["confirmed", "checked_in", "completed", "deposit_paid"].includes(status)) return "success";
  if (["awaiting_deposit", "expired"].includes(status)) return "warning";
  if (status === "cancelled") return "danger";
  return "neutral";
}

function timestamp(value: string | null) {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

function locationText(booking: BookingMatch) {
  return [booking.complex_name, booking.district].filter(Boolean).join(" · ") || "Khu sân";
}

function courtText(booking: BookingMatch) {
  return [booking.court_name, booking.sub_court_name].filter(Boolean).join(" - ") || "Sân";
}

function BookingCard({ booking, variant }: { booking: BookingMatch; variant: "upcoming" | "past" }) {
  const isAwaitingDeposit = booking.status === "awaiting_deposit";

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-red-800">
            {variant === "upcoming" ? "Lịch sắp tới" : "Lịch đã qua"}
          </p>
          <h2 className="mt-1 font-heading text-xl font-semibold text-ink">
            {booking.session_title ?? "Phiên sân"}
          </h2>
          <p className="mt-1 text-sm text-slate-600">{locationText(booking)}</p>
        </div>
        <Badge tone={statusTone(booking.status)}>{bookingStatusLabel(booking.status)}</Badge>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="font-heading text-2xl font-semibold tracking-wide text-ink">
          {booking.booking_code}
        </p>
        <p className="mt-1 text-sm text-slate-600">
          {variant === "upcoming" ? "Mã check-in cho lịch chơi này." : "Mã booking đã ghi nhận."}
        </p>
      </div>

      <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
        <p>
          <span className="font-semibold text-slate-950">Thời gian:</span>{" "}
          {formatDateTime(booking.session_starts_at)}
        </p>
        <p>
          <span className="font-semibold text-slate-950">Môn:</span> {sportLabel(booking.sport)}
        </p>
        <p>
          <span className="font-semibold text-slate-950">Sân:</span> {courtText(booking)}
        </p>
        <p>
          <span className="font-semibold text-slate-950">Kiểu đặt:</span>{" "}
          {bookingModeLabel(booking.mode)} · {booking.seats_booked} slot
        </p>
        <p>
          <span className="font-semibold text-slate-950">Thanh toán:</span>{" "}
          {paymentMethodLabel(booking.payment_method)}
        </p>
        <p>
          <span className="font-semibold text-slate-950">Tổng tiền:</span>{" "}
          {formatVnd(booking.total_price_vnd)}
        </p>
      </div>

      {isAwaitingDeposit ? (
        <Notice tone="warning">
          Booking này đang chờ cọc. Vào trang Booking của tôi để tạo hoặc mở lại link thanh toán.
        </Notice>
      ) : null}

      {booking.checked_in_at || booking.completed_at || booking.cancelled_at ? (
        <div className="grid gap-2 border-t border-slate-100 pt-3 text-sm text-slate-600 sm:grid-cols-2">
          {booking.checked_in_at ? <p>Check-in: {formatDateTime(booking.checked_in_at)}</p> : null}
          {booking.completed_at ? <p>Hoàn tất: {formatDateTime(booking.completed_at)}</p> : null}
          {booking.cancelled_at ? <p>Đã hủy: {formatDateTime(booking.cancelled_at)}</p> : null}
          {booking.cancel_reason ? <p>Lý do: {booking.cancel_reason}</p> : null}
        </div>
      ) : null}

      {(booking.status === "checked_in" || booking.status === "completed") ? (
        <div className="border-t border-slate-100 pt-3 flex justify-end">
          <ButtonLink href={`/player/expenses/session/?id=${booking.session_id}`} variant="outline" size="sm">
            💸 Ghi chú & Chia tiền
          </ButtonLink>
        </div>
      ) : null}
    </Card>
  );
}

export default function PlayerMatchesPage() {
  const [bookings, setBookings] = useState<BookingMatch[]>([]);
  const [message, setMessage] = useState("Đang tải lịch thi đấu của bạn...");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function loadBookings() {
    setIsLoading(true);
    setError("");
    try {
      const items = await apiFetch<BookingMatch[]>("/api/v1/player/bookings", {
        credentials: "include",
      });
      setBookings(items);
      setMessage(items.length ? `Bạn đang có ${items.length} lịch đã đặt.` : "Bạn chưa có lịch đấu nào.");
    } catch (caught) {
      setBookings([]);
      setError(errorMessage(caught, "Không tải được lịch đấu"));
      setMessage("Vui lòng đăng nhập để xem lịch thi đấu.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadBookings();
  }, []);

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const upcomingItems: BookingMatch[] = [];
    const pastItems: BookingMatch[] = [];

    bookings.forEach((booking) => {
      const startsAt = timestamp(booking.session_starts_at);
      const isUpcoming = startsAt >= now && !inactiveStatuses.has(booking.status);
      if (isUpcoming) {
        upcomingItems.push(booking);
      } else {
        pastItems.push(booking);
      }
    });

    upcomingItems.sort((left, right) => timestamp(left.session_starts_at) - timestamp(right.session_starts_at));
    pastItems.sort((left, right) => timestamp(right.session_starts_at) - timestamp(left.session_starts_at));
    return { upcoming: upcomingItems, past: pastItems };
  }, [bookings]);

  const stats = useMemo(() => {
    const awaitingDeposit = bookings.filter((item) => item.status === "awaiting_deposit").length;
    const completed = bookings.filter((item) => item.status === "completed").length;
    const checkedIn = bookings.filter((item) => item.status === "checked_in").length;
    return { awaitingDeposit, completed, checkedIn };
  }, [bookings]);

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Lịch đấu"
        title="Theo dõi các trận đã đặt, sắp tới và đã qua."
        description={message}
        actions={
          <>
            <ButtonLink href="/player/discovery?mode=booking">Đặt sân tiếp</ButtonLink>
            <ButtonLink href="/player/bookings" variant="outline">
              Booking của tôi
            </ButtonLink>
          </>
        }
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Tổng lịch" value={bookings.length} helper={isLoading ? "Đang đồng bộ..." : "Booking của bạn"} />
        <StatCard label="Sắp tới" value={upcoming.length} helper="Chưa tới giờ chơi" tone="accent" />
        <StatCard label="Đã qua" value={past.length} helper={`${stats.completed} đã hoàn tất`} />
        <StatCard label="Cần chú ý" value={stats.awaitingDeposit} helper={`${stats.checkedIn} đã check-in`} tone="warning" />
      </section>

      {bookings.length === 0 && !isLoading ? (
        <EmptyState
          title="Bạn chưa có lịch đấu nào"
          description="Đặt sân hoặc tham gia kèo ghép để lịch thi đấu xuất hiện tại đây."
          action={<ButtonLink href="/player/discovery?mode=booking">Tìm sân ngay</ButtonLink>}
        />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-heading text-xl font-semibold text-ink">Sắp tới</h2>
                <p className="mt-1 text-sm text-slate-600">Các lịch đặt sân chưa diễn ra.</p>
              </div>
              <Button type="button" variant="outline" onClick={() => void loadBookings()} disabled={isLoading}>
                {isLoading ? "Đang tải..." : "Tải lại"}
              </Button>
            </div>

            {upcoming.length === 0 ? (
              <Card>
                <p className="text-sm font-semibold text-slate-600">Không có lịch sắp tới.</p>
              </Card>
            ) : (
              <div className="grid gap-4">
                {upcoming.map((booking) => (
                  <BookingCard key={booking.id} booking={booking} variant="upcoming" />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="font-heading text-xl font-semibold text-ink">Quá khứ</h2>
              <p className="mt-1 text-sm text-slate-600">Các lịch đã qua, đã hủy hoặc hết hạn.</p>
            </div>

            {past.length === 0 ? (
              <Card>
                <p className="text-sm font-semibold text-slate-600">Chưa có lịch quá khứ.</p>
              </Card>
            ) : (
              <div className="grid gap-4">
                {past.map((booking) => (
                  <BookingCard key={booking.id} booking={booking} variant="past" />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
