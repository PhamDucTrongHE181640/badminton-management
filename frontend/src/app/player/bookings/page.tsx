"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge, Button, ButtonLink, Notice, PageHero, EmptyState } from "@/components/ui";
import { apiFetch } from "@/lib/http";
import {
  bookingModeLabel,
  bookingStatusLabel,
  errorMessage,
  formatVnd,
  paymentMethodLabel,
  sportLabel,
} from "@/lib/format";
import { PublishPoolModal } from "./PublishPoolModal";

type Booking = {
  id: string;
  booking_code: string;
  session_id: string;
  session_title: string | null;
  session_starts_at: string | null;
  session_allows_solo_join?: boolean;
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

function courtImageForSport(sport: string | null | undefined): string {
  const map: Record<string, string> = {
    Tennis: "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&q=80&w=800",
    Badminton: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&q=80&w=800",
    Pickleball: "https://images.unsplash.com/photo-1613588718956-c2e80305bf61?auto=format&fit=crop&q=80&w=800",
  };
  return map[sport || ""] || "https://images.unsplash.com/photo-1544365558-35aa4afcf11f?auto=format&fit=crop&q=80&w=800";
}

export default function PlayerBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [message, setMessage] = useState("Đang tải lịch đặt sân của bạn...");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const [activeTab, setActiveTab] = useState<"upcoming" | "history">("upcoming");

  const [payingBookingId, setPayingBookingId] = useState<string | null>(null);
  const [depositIntents, setDepositIntents] = useState<Record<string, DepositIntent>>({});

  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [selectedBookingForPool, setSelectedBookingForPool] = useState<Booking | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

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
    } catch (caught) {
      setError(errorMessage(caught, "Không tạo được link thanh toán VNPay"));
    } finally {
      setPayingBookingId(null);
    }
  }

  const handlePublishPool = async (openSlots: number) => {
    if (!selectedBookingForPool) return;
    setIsPublishing(true);
    try {
      await apiFetch(`/api/v1/player/bookings/${selectedBookingForPool.id}/publish-pool`, {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ open_slots: openSlots })
      });
      alert("Đã mở ghép đội thành công! Lịch chơi của bạn sẽ hiển thị ở trang Xếp đối vãng lai.");
      setPublishModalOpen(false);
      await loadBookings();
    } catch (caught) {
      alert(errorMessage(caught, "Không thể mở slot vãng lai. Vui lòng thử lại."));
    } finally {
      setIsPublishing(false);
    }
  };

  const handleUnpublishPool = async (booking: Booking) => {
    if (!confirm("Bạn có chắc chắn muốn hủy ghép vãng lai? Những slot còn trống sẽ không thể ghép thêm người.")) return;
    setIsPublishing(true);
    try {
      await apiFetch(`/api/v1/player/bookings/${booking.id}/unpublish-pool`, {
        method: "POST",
        credentials: "include"
      });
      alert("Đã hủy ghép vãng lai thành công.");
      await loadBookings();
    } catch (caught) {
      alert(errorMessage(caught, "Không thể hủy ghép vãng lai. Vui lòng thử lại."));
    } finally {
      setIsPublishing(false);
    }
  };

  const { upcoming, history } = useMemo(() => {
    const now = new Date();
    const up: Booking[] = [];
    const hist: Booking[] = [];
    
    bookings.forEach(b => {
      if (b.status === "cancelled" || b.status === "completed" || b.status === "expired") {
        hist.push(b);
      } else if (b.session_starts_at && new Date(b.session_starts_at) < now && b.status === "checked_in") {
        hist.push(b);
      } else {
        up.push(b);
      }
    });
    
    up.sort((a, b) => new Date(a.session_starts_at || 0).getTime() - new Date(b.session_starts_at || 0).getTime());
    hist.sort((a, b) => new Date(b.session_starts_at || 0).getTime() - new Date(a.session_starts_at || 0).getTime());
    
    return { upcoming: up, history: hist };
  }, [bookings]);

  const displayedBookings = activeTab === "upcoming" ? upcoming : history;

  return (
    <div className="space-y-6 pb-20">
      <PageHero
        eyebrow="Quản lý"
        title="Lịch đặt sân của bạn"
        description="Theo dõi lịch chơi, tiền cọc, và lấy mã Check-in tại quầy."
        actions={
          <ButtonLink href="/player/discovery/?mode=booking" className="bg-[#b00c14] hover:bg-red-900 border-none text-white font-bold rounded-xl shadow-md">
            + Đặt sân mới
          </ButtonLink>
        }
      />

      {error ? <Notice tone="danger" className="rounded-2xl">{error}</Notice> : null}

      <div className="flex gap-2 border-b border-slate-200">
        <button
          className={`pb-3 px-2 text-sm font-bold border-b-2 transition ${activeTab === "upcoming" ? "border-[#b00c14] text-[#b00c14]" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          onClick={() => setActiveTab("upcoming")}
        >
          Sắp tới ({upcoming.length})
        </button>
        <button
          className={`pb-3 px-2 text-sm font-bold border-b-2 transition ${activeTab === "history" ? "border-[#b00c14] text-[#b00c14]" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          onClick={() => setActiveTab("history")}
        >
          Lịch sử ({history.length})
        </button>
      </div>

      {isLoading ? (
        <div className="py-20 text-center animate-pulse text-slate-400 font-bold text-sm">Đang tải lịch đặt sân...</div>
      ) : displayedBookings.length === 0 ? (
        <EmptyState
          title={activeTab === "upcoming" ? "Bạn chưa có lịch chơi sắp tới" : "Lịch sử đặt sân trống"}
          description={activeTab === "upcoming" ? "Hãy tìm sân trống và lên kèo ngay hôm nay." : "Bạn chưa từng đặt sân trên hệ thống."}
          action={<ButtonLink href="/player/discovery/?mode=booking">Khám phá sân ngay</ButtonLink>}
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {displayedBookings.map((item) => {
            const depositIntent = depositIntents[item.id];
            const canPayDeposit = item.status === "awaiting_deposit";
            const dateObj = item.session_starts_at ? new Date(item.session_starts_at) : null;
            
            const isFullCourt = item.mode === "full_court";
            const isConfirmed = ["confirmed", "deposit_paid", "checked_in"].includes(item.status);
            const canPublishPool = isFullCourt && isConfirmed;

            return (
              <div key={item.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition duration-300">
                {/* Header / Image */}
                <div className="h-32 relative bg-slate-100 shrink-0">
                  <img src={courtImageForSport(item.sport)} className="w-full h-full object-cover" alt="Court" />
                  <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute top-3 left-3 flex gap-2">
                    <Badge tone={statusTone(item.status)} className="shadow-xs font-black uppercase text-[9px] tracking-wider border-none backdrop-blur-md">
                      {bookingStatusLabel(item.status)}
                    </Badge>
                  </div>
                  <div className="absolute bottom-3 left-4 right-4 text-white">
                    <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">{item.district}</p>
                    <h3 className="font-heading text-lg font-black leading-tight drop-shadow-md truncate">
                      {item.complex_name}
                    </h3>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-4">
                    {/* Time Box */}
                    {dateObj && !isNaN(dateObj.getTime()) && (
                      <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="text-center shrink-0 w-12 border-r border-slate-200 pr-4">
                          <p className="text-[10px] font-bold text-red-600 uppercase">Th{dateObj.getMonth() + 1}</p>
                          <p className="font-heading text-xl font-black text-slate-900 leading-none mt-0.5">{String(dateObj.getDate()).padStart(2, '0')}</p>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">{dateObj.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                          <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                            ⏰ {dateObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} • {item.court_name}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs border-b border-slate-50 pb-2">
                        <span className="text-slate-500 font-medium">Loại hình</span>
                        <span className="font-bold text-slate-800">{bookingModeLabel(item.mode)} • {item.seats_booked} slots</span>
                      </div>
                      <div className="flex justify-between text-xs border-b border-slate-50 pb-2">
                        <span className="text-slate-500 font-medium">Tổng tiền</span>
                        <span className="font-bold text-emerald-600">{formatVnd(item.total_price_vnd)}</span>
                      </div>
                      <div className="flex justify-between text-xs pb-1">
                        <span className="text-slate-500 font-medium">Còn phải thu</span>
                        <span className="font-bold text-red-600">{formatVnd(item.remaining_due_vnd)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    {/* Checkin Code Box */}
                    {["confirmed", "deposit_paid", "checked_in"].includes(item.status) && (
                      <div className="bg-[#b00c14]/5 border border-[#b00c14]/10 rounded-2xl p-3 flex justify-between items-center">
                        <div>
                          <p className="text-[10px] font-bold text-[#b00c14] uppercase">Mã Check-in</p>
                          <p className="font-heading text-xl font-black tracking-widest text-slate-900 leading-none mt-1">
                            {item.booking_code}
                          </p>
                        </div>
                        <div className="h-10 w-10 bg-white rounded-xl shadow-xs flex items-center justify-center text-[#b00c14]">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                          </svg>
                        </div>
                      </div>
                    )}

                    {/* Deposit Actions */}
                    {canPayDeposit && (
                      <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl flex flex-col gap-3">
                        <p className="text-[11px] font-semibold text-amber-900 leading-snug">
                          Bạn chưa thanh toán cọc. VNPay sẽ tự động hủy nếu quá hạn.
                        </p>
                        {!depositIntent ? (
                          <button
                            type="button"
                            onClick={() => void createDepositIntent(item)}
                            disabled={payingBookingId === item.id}
                            className="h-9 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition shadow-xs"
                          >
                            {payingBookingId === item.id ? "Đang tạo..." : "Thanh toán lại"}
                          </button>
                        ) : (
                          <a
                            href={depositIntent.payment_url}
                            target="_blank"
                            rel="noreferrer"
                            className="h-9 flex items-center justify-center rounded-xl bg-red-700 hover:bg-red-800 text-white text-xs font-bold transition shadow-xs"
                          >
                            Mở VNPay thanh toán ngay
                          </a>
                        )}
                      </div>
                    )}

                    {canPublishPool && !item.session_allows_solo_join && (
                      <button
                        onClick={() => {
                          setSelectedBookingForPool(item);
                          setPublishModalOpen(true);
                        }}
                        disabled={isPublishing}
                        className="w-full h-10 flex items-center justify-center gap-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-xs font-bold transition shadow-xs"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        Cho phép vãng lai tham gia
                      </button>
                    )}

                    {canPublishPool && item.session_allows_solo_join && (
                      <button
                        onClick={() => handleUnpublishPool(item)}
                        disabled={isPublishing}
                        className="w-full h-10 flex items-center justify-center gap-2 rounded-xl bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 text-xs font-bold transition shadow-xs"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Chọn để hủy cho phép khách vãng lai
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedBookingForPool && (
        <PublishPoolModal
          isOpen={publishModalOpen}
          onClose={() => setPublishModalOpen(false)}
          onConfirm={handlePublishPool}
          maxSlots={selectedBookingForPool.seats_booked}
          isLoading={isPublishing}
        />
      )}
    </div>
  );
}
