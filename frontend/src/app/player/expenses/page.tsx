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
  my_pending_amount_vnd: number;
  is_fully_settled: boolean;
  pending_payments_count: number;
};

export default function PlayerExpensesHistoryPage() {
  const [history, setHistory] = useState<UserExpenseHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("all");

  async function loadHistory() {
    setIsLoading(true);
    setError("");
    try {
      const res = await apiFetch<UserExpenseHistoryItem[]>("/api/v1/player/expenses/history", {
        credentials: "include",
      });
      setHistory(res);
    } catch (caught) {
      setError(errorMessage(caught, "Không thể tải lịch sử chia tiền"));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadHistory();
  }, []);

  function formatVnd(amount: number) {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
  }

  const filteredHistory = history.filter((item) => {
    if (filter === "pending") return !item.is_fully_settled;
    if (filter === "completed") return item.is_fully_settled;
    return true;
  });

  const totalOwed = history.reduce((sum, item) => {
    return item.my_balance_vnd < 0 ? sum + Math.abs(item.my_balance_vnd) : sum;
  }, 0);

  const totalReceivable = history.reduce((sum, item) => {
    return item.my_balance_vnd > 0 ? sum + item.my_balance_vnd : sum;
  }, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHero
        eyebrow="Chi phí & Ghi chú"
        title="Quản lý chi phí sau mỗi buổi chơi"
        description="Theo dõi các khoản tiền sân, tiền nước, quả cầu lông và việc chia tiền giữa mọi người sau trận đấu."
        actions={
          <>
            <ButtonLink href="/player/expenses/new">
              ➕ Tính chia tiền nhanh
            </ButtonLink>
            <button
              onClick={() => void loadHistory()}
              disabled={isLoading}
              className="inline-flex items-center justify-center rounded-lg font-semibold transition border border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50 px-4 py-2 text-sm disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? "Đang tải..." : "Tải lại dữ liệu"}
            </button>
          </>
        }
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Tổng buổi đã chia"
          value={history.length}
          helper={isLoading ? "Đang đồng bộ..." : "Tổng số hóa đơn ghi nhận"}
        />
        <StatCard
          label="Tôi cần trả thêm"
          value={formatVnd(totalOwed)}
          helper="Các khoản bạn đang nợ người khác"
          tone={totalOwed > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Tôi được nhận lại"
          value={formatVnd(totalReceivable)}
          helper="Số tiền mọi người cần gửi bạn"
          tone={totalReceivable > 0 ? "success" : "default"}
        />
      </div>

      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex gap-2">
          {(["all", "pending", "completed"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition cursor-pointer ${
                filter === t
                  ? "bg-red-800 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {t === "all" ? "Tất cả" : t === "pending" ? "Chưa xong" : "Đã hoàn tất"}
            </button>
          ))}
        </div>
      </div>

      {filteredHistory.length === 0 && !isLoading ? (
        <EmptyState
          title="Không tìm thấy lịch sử chia tiền"
          description={
            filter === "all"
              ? "Bạn chưa tham gia buổi chia tiền nào. Hãy chọn một buổi chơi cũ trong Lịch thi đấu hoặc nhấn Tính chia tiền nhanh."
              : filter === "pending"
              ? "Tuyệt vời! Bạn không còn buổi chia tiền nào chưa hoàn tất."
              : "Bạn chưa hoàn tất buổi chia tiền nào."
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filteredHistory.map((item) => {
            const isDebtor = item.my_balance_vnd < 0;
            const isCreditor = item.my_balance_vnd > 0;
            return (
              <Card key={item.id}>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500 font-semibold">{item.expense_date}</p>
                    <h3 className="font-bold text-slate-800 text-base">{item.title}</h3>
                    {item.complex_name && (
                      <p className="text-xs text-slate-500">
                        📍 {item.complex_name}
                      </p>
                    )}
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      item.is_fully_settled
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {item.is_fully_settled ? "Đã xong" : `${item.pending_payments_count} GD chưa trả`}
                  </span>
                </div>

                <div className="border-t border-slate-100 my-3 pt-3">
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                    <p>
                      <span className="font-semibold">Tổng tiền chi:</span>{" "}
                      {formatVnd(item.total_amount_vnd)}
                    </p>
                    <p>
                      <span className="font-semibold">Chia đều mỗi người:</span>{" "}
                      {formatVnd(item.split_amount_vnd)}
                    </p>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500 font-semibold uppercase">Trạng thái của bạn</p>
                    <p
                      className={`text-sm font-bold mt-0.5 ${
                        item.my_balance_vnd === 0
                          ? "text-slate-600"
                          : item.my_pending_amount_vnd > 0
                          ? "text-rose-600"
                          : "text-emerald-600"
                      }`}
                    >
                      {item.my_balance_vnd === 0 ? (
                        <>Đã hòa tiền (Chi {formatVnd(item.my_paid_vnd)})</>
                      ) : item.my_pending_amount_vnd > 0 ? (
                        <>Còn {formatVnd(item.my_pending_amount_vnd)} chưa được thanh toán.</>
                      ) : (
                        <>Đã hoàn tất thanh toán.</>
                      )}
                    </p>
                  </div>
                  {item.session_id ? (
                    <ButtonLink
                      href={`/player/expenses/session/?id=${item.session_id}`}
                      variant="outline"
                      size="sm"
                    >
                      Chi tiết & Tick nợ
                    </ButtonLink>
                  ) : (
                    <ButtonLink
                      href={`/player/expenses/detail/?id=${item.id}`}
                      variant="outline"
                      size="sm"
                    >
                      Chi tiết & Tick nợ
                    </ButtonLink>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
