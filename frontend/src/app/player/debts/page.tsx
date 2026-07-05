"use client";

import { useEffect, useState } from "react";
import { Card, PageHero, Notice, StatCard, EmptyState, ButtonLink } from "@/components/ui";
import { apiFetch } from "@/lib/http";
import { errorMessage } from "@/lib/format";

type UserExpenseHistoryItem = {
  id: string;
  session_id: string | null;
  session_title: string | null;
  complex_name: string | null;
  title: string;
  expense_date: string;
  total_amount_vnd: number;
  split_amount_vnd: number;
  my_paid_vnd: number;
  my_owed_vnd: number;
  my_balance_vnd: number;
  is_fully_settled: boolean;
  pending_payments_count: number;
};

type PendingPayment = {
  id: string;
  expense_id: string;
  amount_vnd: number;
  status: string;
  created_at: string;
  expense_title: string;
  expense_date: string;
  sender_name: string;
  sender_user_id: string | null;
  receiver_name: string;
  receiver_user_id: string | null;
};

export default function PlayerDebtsPage() {
  const [history, setHistory] = useState<UserExpenseHistoryItem[]>([]);
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedQrUrl, setSelectedQrUrl] = useState<string | null>(null);
  const [selectedPartnerName, setSelectedPartnerName] = useState<string | null>(null);

  async function loadData() {
    setIsLoading(true);
    setError("");
    try {
      const [historyRes, pendingRes, userRes] = await Promise.all([
        apiFetch<UserExpenseHistoryItem[]>("/api/v1/player/expenses/history", { credentials: "include" }),
        apiFetch<PendingPayment[]>("/api/v1/player/expenses/pending-payments", { credentials: "include" }),
        apiFetch<{ id: string }>("/api/v1/auth/me", { credentials: "include" }).catch(() => null)
      ]);
      setHistory(historyRes);
      setPendingPayments(pendingRes);
      setCurrentUser(userRes);
    } catch (caught) {
      setError(errorMessage(caught, "Không thể tải dữ liệu công nợ"));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  function formatVnd(amount: number) {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
  }

  async function handleTogglePayment(paymentId: string, currentStatus: string) {
    const nextStatus = currentStatus === "settled" ? "pending" : "settled";
    const confirmMsg = nextStatus === "settled"
      ? "Bạn xác nhận đã nhận được khoản tiền này?"
      : "Bạn muốn chuyển giao dịch này về trạng thái chưa thanh toán (chờ nhận)?";
    if (!confirm(confirmMsg)) return;

    try {
      await apiFetch(`/api/v1/player/expenses/payments/${paymentId}/toggle`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      void loadData();
    } catch (caught) {
      alert(errorMessage(caught, "Không thể cập nhật trạng thái thanh toán"));
    }
  }

  const totalOwed = history.reduce((sum, item) => {
    return item.my_balance_vnd < 0 ? sum + Math.abs(item.my_balance_vnd) : sum;
  }, 0);

  const totalReceivable = history.reduce((sum, item) => {
    return item.my_balance_vnd > 0 ? sum + item.my_balance_vnd : sum;
  }, 0);

  // Gom nhóm & cấn trừ nợ chéo lũy kế
  const nettingPartners: {
    [name: string]: {
      partnerName: string;
      netBalance: number;
      oweDetails: { title: string; date: string; amount: number; id: string; status: string }[];
      receiveDetails: { title: string; date: string; amount: number; id: string; status: string }[];
    }
  } = {};

  if (currentUser) {
    pendingPayments.forEach((p) => {
      const isOwedToPartner = p.sender_user_id === currentUser.id; // Mình nợ partner
      const isOwedByPartner = p.receiver_user_id === currentUser.id; // Partner nợ mình
      
      const partnerName = isOwedToPartner ? p.receiver_name : p.sender_name;
      
      if (!nettingPartners[partnerName]) {
        nettingPartners[partnerName] = {
          partnerName,
          netBalance: 0,
          oweDetails: [],
          receiveDetails: [],
        };
      }
      
      const info = nettingPartners[partnerName];
      if (isOwedToPartner) {
        if (p.status === "pending") {
          info.netBalance -= p.amount_vnd;
        }
        info.oweDetails.push({ title: p.expense_title, date: p.expense_date, amount: p.amount_vnd, id: p.id, status: p.status });
      } else if (isOwedByPartner) {
        if (p.status === "pending") {
          info.netBalance += p.amount_vnd;
        }
        info.receiveDetails.push({ title: p.expense_title, date: p.expense_date, amount: p.amount_vnd, id: p.id, status: p.status });
      }
    });
  }

  const partnersList = Object.values(nettingPartners)
    .filter((x) => x.oweDetails.length > 0 || x.receiveDetails.length > 0)
    .sort((a, b) => {
      // 1. Đẩy người đã hòa nợ (netBalance === 0) xuống cuối
      const aIsZero = a.netBalance === 0;
      const bIsZero = b.netBalance === 0;
      if (aIsZero && !bIsZero) return 1;
      if (!aIsZero && bIsZero) return -1;
      
      // 2. Sắp xếp cố định theo tên A-Z (sử dụng locale tiếng Việt)
      return a.partnerName.localeCompare(b.partnerName, "vi");
    });

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHero
        eyebrow="Quản lý công nợ"
        title="Công nợ tích lũy qua các buổi chơi"
        description="Theo dõi nợ nần, cấn trừ chéo tự động qua nhiều ngày và quét mã QR chuyển khoản nhanh."
        actions={
          <button
            onClick={() => void loadData()}
            disabled={isLoading}
            className="inline-flex items-center justify-center rounded-lg font-semibold transition border border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50 px-4 py-2 text-sm disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? "Đang tải..." : "Tải lại dữ liệu"}
          </button>
        }
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Tôi cần trả thêm (Tổng nợ)"
          value={formatVnd(totalOwed)}
          helper="Tổng cộng các khoản bạn cần thanh toán cho người khác"
          tone={totalOwed > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Tôi được nhận lại (Tổng dư)"
          value={formatVnd(totalReceivable)}
          helper="Tổng cộng số tiền mọi người cần gửi bạn"
          tone={totalReceivable > 0 ? "success" : "default"}
        />
      </div>

      <div className="space-y-4">
        <Notice tone="info">
          Hệ thống tự động cộng dồn và cấn trừ chéo (Netting) tất cả các khoản chi tiêu và nợ nần giữa bạn và từng người qua nhiều ngày để đưa ra số tiền thực tế cuối cùng cần thanh toán.
        </Notice>

        {partnersList.length === 0 && !isLoading ? (
          <EmptyState
            title="Không có nợ chéo lũy kế"
            description="Tuyệt vời! Tất cả các khoản nợ giữa mọi người đã được cấn trừ và thanh toán xong."
          />
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {partnersList.map((partner) => {
              const isOwePartner = partner.netBalance < 0;
              const absBalance = Math.abs(partner.netBalance);
              
              return (
                <Card key={partner.partnerName}>
                  {/* Tiêu đề đối tác & số dư cấn trừ */}
                  <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3 mb-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="font-bold text-slate-800 text-base">{partner.partnerName}</h3>
                        {partner.netBalance === 0 ? (
                          <span className="rounded bg-slate-100 text-[10px] px-1.5 py-0.5 text-slate-500 font-semibold border border-slate-200">
                            Hòa nợ
                          </span>
                        ) : isOwePartner ? (
                          <span className="rounded bg-rose-50 text-[10px] px-1.5 py-0.5 text-rose-600 font-bold border border-rose-100">
                            Bạn nợ họ
                          </span>
                        ) : (
                          <span className="rounded bg-emerald-50 text-[10px] px-1.5 py-0.5 text-emerald-600 font-bold border border-emerald-100">
                            Họ nợ bạn
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">Tích lũy qua tất cả các ngày</p>
                    </div>
                    <p className={`text-base font-black shrink-0 ${partner.netBalance === 0 ? "text-slate-500" : isOwePartner ? "text-rose-600" : "text-emerald-600"}`}>
                      {partner.netBalance === 0 ? "" : isOwePartner ? "-" : "+"} {formatVnd(absBalance)}
                    </p>
                  </div>

                  {/* Nút hành động thanh toán QR / Chờ nhận tiền */}
                  <div className="mb-4">
                    {partner.netBalance < 0 ? (
                      <button
                        onClick={() => {
                          const infoUrl = `https://img.vietqr.io/image/970415-1100010959-qr_only.png?amount=${absBalance}&addInfo=Tra%20tien%20badminton%20cho%20${partner.partnerName}`;
                          setSelectedQrUrl(infoUrl);
                          setSelectedPartnerName(partner.partnerName);
                        }}
                        className="w-full rounded-lg bg-red-800 hover:bg-red-900 text-white font-bold text-xs py-2 shadow transition cursor-pointer text-center"
                      >
                        💸 Quét QR Trả tiền
                      </button>
                    ) : partner.netBalance > 0 ? (
                      <div className="text-xs text-slate-500 font-semibold italic bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 text-center">
                        Đợi họ thanh toán
                      </div>
                    ) : (
                      <div className="text-xs text-emerald-600 font-bold bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 text-center">
                        ✓ Đã hòa tiền
                      </div>
                    )}
                  </div>

                  {/* Chi tiết các khoản cấu thành (Dạng dọc thu gọn) */}
                  <div className="border-t border-slate-100 pt-3 space-y-3">
                    <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Chi tiết các khoản:</h4>
                    
                    {/* Các khoản mình nợ họ */}
                    {partner.oweDetails.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-bold text-rose-500 uppercase">Bạn nợ họ:</p>
                        <div className="divide-y divide-slate-50 border border-slate-100 rounded-lg overflow-hidden bg-slate-50/50">
                          {partner.oweDetails.map((d) => (
                            <div key={d.id} className="flex justify-between items-center text-xs p-2 gap-1.5">
                              <div className="min-w-0 flex-1">
                                <span className={`font-semibold text-slate-700 block truncate ${d.status === "settled" ? "line-through text-slate-400" : ""}`} title={d.title}>{d.title}</span>
                                <span className="text-[9px] text-slate-400">({d.date})</span>
                                {d.status === "settled" && (
                                  <span className="ml-1 rounded bg-slate-200 text-[9px] px-1 text-slate-600 font-semibold shrink-0">Đã trả</span>
                                )}
                              </div>
                              <span className={`font-bold shrink-0 ${d.status === "settled" ? "text-slate-400 line-through" : "text-rose-600"}`}>
                                {formatVnd(d.amount)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Các khoản họ nợ mình */}
                    {partner.receiveDetails.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-bold text-emerald-600 uppercase">Họ nợ bạn:</p>
                        <div className="divide-y divide-slate-50 border border-slate-100 rounded-lg overflow-hidden bg-slate-50/50">
                          {partner.receiveDetails.map((d) => (
                            <div key={d.id} className="flex justify-between items-center text-xs p-2 gap-1.5">
                              <div className="min-w-0 flex-1">
                                <span className={`font-semibold text-slate-700 block truncate ${d.status === "settled" ? "line-through text-slate-400" : ""}`} title={d.title}>{d.title}</span>
                                <span className="text-[9px] text-slate-400">({d.date})</span>
                                {d.status === "settled" && (
                                  <span className="ml-1.5 rounded bg-emerald-50 text-[9px] px-1.5 py-0.5 text-emerald-600 font-bold border border-emerald-100 shrink-0">Đã nhận</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`font-bold ${d.status === "settled" ? "text-emerald-600" : "text-rose-600"}`}>
                                  {formatVnd(d.amount)}
                                </span>
                                <button
                                  onClick={() => void handleTogglePayment(d.id, d.status)}
                                  className={`rounded text-[10px] font-bold px-1.5 py-0.5 transition cursor-pointer border ${
                                    d.status === "settled"
                                      ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border-emerald-200"
                                      : "bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-200"
                                  }`}
                                  title={d.status === "settled" ? "Hoàn tác (Đánh dấu chưa trả)" : "Xác nhận đã nhận tiền"}
                                >
                                  {d.status === "settled" ? "✓" : "✕"}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL MÃ QR CHUYỂN KHOẢN PHÓNG TO */}
      {selectedQrUrl && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow-xl border border-slate-100">
            <h3 className="text-base font-bold text-slate-800 mb-1">Quét mã QR Chuyển tiền</h3>
            <p className="text-xs text-slate-500 mb-4">Gửi cho đối tác: <span className="font-bold text-slate-700">{selectedPartnerName}</span></p>
            
            <div className="bg-slate-50 rounded-xl p-4 flex justify-center border border-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedQrUrl}
                alt="VietQR code"
                className="max-h-[250px] object-contain shadow-sm rounded-lg"
              />
            </div>

            <p className="text-[11px] text-slate-400 mt-3 italic">
              * Sau khi chuyển khoản, hãy nhờ {selectedPartnerName} ấn nút "Đã nhận" trên máy của họ để cập nhật.
            </p>

            <button
              onClick={() => {
                setSelectedQrUrl(null);
                setSelectedPartnerName(null);
              }}
              className="mt-5 w-full rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2 text-sm transition cursor-pointer"
            >
              Đóng lại
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
