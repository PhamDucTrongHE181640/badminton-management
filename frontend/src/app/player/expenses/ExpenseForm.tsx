"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, PageHero, Notice, StatCard, ButtonLink } from "@/components/ui";
import { apiFetch } from "@/lib/http";
import { errorMessage } from "@/lib/format";

type Participant = {
  id: string;
  user_id: string | null;
  display_name: string;
  is_guest: boolean;
  amount_paid_vnd: number;
  amount_owed_vnd: number;
  balance_vnd: number;
};

type ExpenseItem = {
  id: string;
  name: string;
  amount_vnd: number;
  paid_by_participant_id: string;
  split_between_display_names?: string[] | null;
};

type Payment = {
  id: string;
  expense_id: string;
  sender_participant_id: string;
  sender_name: string;
  receiver_participant_id: string;
  receiver_name: string;
  receiver_user_id: string | null;
  amount_vnd: number;
  status: "pending" | "settled";
  settled_at: string | null;
};

type SessionExpenseResponse = {
  exists: boolean;
  expense: {
    id: string | null;
    session_id: string | null;
    title: string;
    expense_date: string;
    created_by_user_id: string | null;
    total_amount_vnd: number;
    split_amount_vnd: number;
    notes: string | null;
  };
  participants: Participant[];
  items: ExpenseItem[];
  payments: Payment[];
  breakdown: Array<{
    item_name: string;
    share_amount: number;
    reason: string;
  }>;
};

export default function ExpenseForm({
  sessionId,
  expenseId,
  isNew = false
}: {
  sessionId?: string;
  expenseId?: string;
  isNew?: boolean;
}) {
  const router = useRouter();
  const [data, setData] = useState<SessionExpenseResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [isEditing, setIsEditing] = useState(isNew);
  const [title, setTitle] = useState("");
  const [expenseDate, setExpenseDate] = useState("");
  const [notes, setNotes] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [items, setItems] = useState<ExpenseItem[]>([]);

  const [newParticipantName, setNewParticipantName] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [newItemAmount, setNewItemAmount] = useState("");
  const [newItemPayerId, setNewItemPayerId] = useState("");

  const [currentUser, setCurrentUser] = useState<{ id: string; full_name?: string } | null>(null);
  const [frequentPlayers, setFrequentPlayers] = useState<string[]>([]);
  const [newItemSplitType, setNewItemSplitType] = useState<"all" | "custom">("all");
  const [newItemSplitBetween, setNewItemSplitBetween] = useState<string[]>([]);

  useEffect(() => {
    async function loadCurrentUser() {
      try {
        const res = await apiFetch<{ id: string; full_name?: string }>("/api/v1/auth/me", { credentials: "include" });
        setCurrentUser(res);
      } catch {
        // Ignore
      }
    }
    void loadCurrentUser();
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("netup_frequent_participants");
    if (saved) {
      try {
        setFrequentPlayers(JSON.parse(saved));
      } catch {
        // Ignore
      }
    }
  }, []);

  useEffect(() => {
    async function loadExpenseData() {
      setIsLoading(true);
      setError("");
      try {
        let res: SessionExpenseResponse;
        if (expenseId) {
          res = await apiFetch<SessionExpenseResponse>(`/api/v1/player/expenses/detail/${expenseId}`, {
            credentials: "include"
          });
        } else if (sessionId) {
          res = await apiFetch<SessionExpenseResponse>(`/api/v1/player/expenses/session/${sessionId}`, {
            credentials: "include"
          });
        } else if (isNew) {
          const today = new Date().toISOString().split("T")[0];
          res = {
            exists: false,
            expense: {
              id: null,
              session_id: null,
              title: "Chia tiền tự do",
              expense_date: today,
              created_by_user_id: null,
              total_amount_vnd: 0,
              split_amount_vnd: 0,
              notes: ""
            },
            participants: [],
            items: [],
            payments: [],
            breakdown: []
          };
          if (currentUser) {
            res.participants.push({
              id: "me",
              user_id: currentUser.id,
              display_name: currentUser.full_name || "Tôi",
              is_guest: false,
              amount_paid_vnd: 0,
              amount_owed_vnd: 0,
              balance_vnd: 0
            });
          }
        } else {
          throw new Error("Không có đủ thông tin để tải trang");
        }

        setData(res);
        setTitle(res.expense.title);
        setExpenseDate(res.expense.expense_date);
        setNotes(res.expense.notes || "");
        setParticipants(res.participants);
        setItems(res.items);

        if (res.exists) {
          setIsEditing(false);
        } else {
          setIsEditing(true);
        }
      } catch (caught) {
        setError(errorMessage(caught, "Không thể tải thông tin chia tiền"));
      } finally {
        setIsLoading(false);
      }
    }
    if (!isNew || (isNew && currentUser)) {
      void loadExpenseData();
    }
  }, [sessionId, expenseId, isNew, currentUser]);

  function formatVnd(amount: number) {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
  }

  // Handler: Thêm người chơi mới
  function handleAddParticipant() {
    const name = newParticipantName.trim();
    if (!name) return;
    if (participants.some((p) => p.display_name.toLowerCase() === name.toLowerCase())) {
      setError("Tên người chơi này đã tồn tại");
      return;
    }
    setError("");

    const newP: Participant = {
      id: `p-${Date.now()}`,
      user_id: null,
      display_name: name,
      is_guest: true,
      amount_paid_vnd: 0,
      amount_owed_vnd: 0,
      balance_vnd: 0
    };

    setParticipants([...participants, newP]);
    setNewParticipantName("");
  }

  // Handler: Xóa người chơi
  function handleRemoveParticipant(id: string) {
    setError("");
    setParticipants(participants.filter((p) => p.id !== id));
    // Xóa các khoản chi liên quan của người này
    setItems(items.filter((item) => item.paid_by_participant_id !== id));
  }

  // Handler: Thêm khoản chi mới
  function handleAddItem() {
    const name = newItemName.trim();
    const amount = parseInt(newItemAmount);
    const payerId = newItemPayerId;

    if (!name) {
      setError("Vui lòng nhập tên khoản chi (nước uống, quả cầu, tiền sân...)");
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      setError("Số tiền chi phải là số dương lớn hơn 0");
      return;
    }
    if (!payerId) {
      setError("Vui lòng chọn người đã chi trả cho khoản này");
      return;
    }
    setError("");

    const payer = participants.find((p) => p.id === payerId);
    if (!payer) return;

    const newItem: ExpenseItem = {
      id: `i-${Date.now()}`,
      name,
      amount_vnd: amount,
      paid_by_participant_id: payerId,
      split_between_display_names: newItemSplitType === "custom" ? [...newItemSplitBetween] : null
    };

    setItems([...items, newItem]);
    setNewItemName("");
    setNewItemAmount("");
    setNewItemSplitType("all");
    setNewItemSplitBetween([]);
  }

  // Handler: Xóa khoản chi
  function handleRemoveItem(id: string) {
    setItems(items.filter((i) => i.id !== id));
  }

  // Handler: Lưu toàn bộ hóa đơn lên backend
  async function handleSaveExpense(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");

    if (!title.trim()) {
      setError("Vui lòng nhập tiêu đề ghi chú");
      return;
    }
    if (participants.length === 0) {
      setError("Hóa đơn phải có ít nhất 1 người tham gia");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        session_id: sessionId || null,
        title: title.trim(),
        expense_date: expenseDate,
        notes: notes.trim(),
        participants: participants.map((p) => ({
          display_name: p.display_name,
          user_id: p.user_id,
          is_guest: p.is_guest
        })),
        items: items.map((item) => {
          const payer = participants.find((p) => p.id === item.paid_by_participant_id);
          return {
            name: item.name,
            amount_vnd: item.amount_vnd,
            paid_by_display_name: payer ? payer.display_name : "",
            split_between_display_names: item.split_between_display_names || null
          };
        })
      };

      const res = await apiFetch<SessionExpenseResponse>(`/api/v1/player/expenses` + (data?.expense.id ? `?expense_id=${data.expense.id}` : ""), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setData(res);
      setTitle(res.expense.title);
      setExpenseDate(res.expense.expense_date);
      setNotes(res.expense.notes || "");
      setParticipants(res.participants);
      setItems(res.items);

      // Lưu những người chơi khách vào danh sách quen thuộc
      const guestNames = participants
        .filter((p) => p.is_guest || p.id !== "me")
        .map((p) => p.display_name.trim());
      
      let updatedFrequent = [...frequentPlayers];
      guestNames.forEach((name) => {
        if (!updatedFrequent.includes(name)) {
          updatedFrequent.push(name);
        }
      });
      if (updatedFrequent.length > 20) {
        updatedFrequent = updatedFrequent.slice(updatedFrequent.length - 20);
      }
      localStorage.setItem("netup_frequent_participants", JSON.stringify(updatedFrequent));
      setFrequentPlayers(updatedFrequent);
      
      setIsEditing(false);
      setNotice("Lưu hóa đơn chia tiền thành công!");

      // Nếu là tạo mới độc lập, sau khi lưu thành công ta chuyển hướng về trang chi tiết hóa đơn vừa tạo
      if (isNew && res.expense.id) {
        router.push(`/player/expenses/detail/?id=${res.expense.id}`);
      }
    } catch (caught) {
      setError(errorMessage(caught, "Không lưu được hóa đơn chia tiền"));
    } finally {
      setIsSaving(false);
    }
  }

  // Handler: Toggle payment status
  async function togglePayment(paymentId: string, currentStatus: "pending" | "settled") {
    setError("");
    setNotice("");
    const action = currentStatus === "pending" ? "settle" : "unsettle";
    try {
      const res = await apiFetch<SessionExpenseResponse>(`/api/v1/player/expenses/payments/${paymentId}/toggle`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: currentStatus === "pending" ? "settled" : "pending" })
      });
      setData(res);
      setNotice(action === "settle" ? "Đã xác nhận đã trả tiền!" : "Đã chuyển về chưa trả.");
    } catch (caught) {
      setError(errorMessage(caught, "Không cập nhật được trạng thái thanh toán"));
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-red-800 border-t-transparent"></div>
      </div>
    );
  }

  const isCreator = data?.expense.created_by_user_id === currentUser?.id;
  const totalAmountSum = items.reduce((sum, i) => sum + i.amount_vnd, 0);
  const perPersonAmount = participants.length > 0 ? totalAmountSum / participants.length : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHero
        eyebrow="Ghi chú & Chia sẻ Chi phí"
        title={isEditing ? (isNew ? "Tính chia tiền nhanh" : "Thiết lập chi phí") : title}
        description={isEditing ? "Thêm người chơi, nhập các khoản chi của từng người để tự động chia đều hóa đơn." : "Bảng thống kê ai nợ ai, chi tiết các khoản chi và trạng thái trả tiền."}
        actions={
          <div className="flex gap-2">
            <ButtonLink href="/player/expenses/" variant="outline">
              ← Lịch sử
            </ButtonLink>
            {!isEditing && isCreator && (
              <button
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center justify-center rounded-lg font-semibold transition bg-red-800 text-white hover:bg-red-900 px-4 py-2 text-sm cursor-pointer shadow-sm"
              >
                Chỉnh sửa hóa đơn
              </button>
            )}
          </div>
        }
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}
      {notice ? <Notice tone="success">{notice}</Notice> : null}

      {isEditing ? (
        <form onSubmit={(e) => void handleSaveExpense(e)} className="grid gap-6 lg:grid-cols-3">
          {/* Cấu hình chung */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <h2 className="text-base font-bold text-slate-800 mb-4">1. Thông tin hóa đơn</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Tiêu đề hóa đơn *</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ví dụ: Tiền sân + Nước uống ngày 05/07"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-red-800 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Ngày chơi *</label>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-red-800 focus:outline-none"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Ghi chú thêm</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Mô tả thêm chi tiết nếu cần..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-red-800 focus:outline-none"
                  />
                </div>
              </div>
            </Card>

            {/* Danh sách khoản chi */}
            <Card>
              <h2 className="text-base font-bold text-slate-800 mb-4">3. Các khoản đã chi tiêu</h2>
              {items.length === 0 ? (
                <p className="text-sm text-slate-500 italic mb-4">Chưa có khoản chi nào được thêm. Hãy nhập ở dưới.</p>
              ) : (
                <div className="mb-4 divide-y divide-slate-100 border-b border-slate-100 pb-2">
                  {items.map((item) => {
                    const payer = participants.find((p) => p.id === item.paid_by_participant_id);
                    return (
                      <div key={item.id} className="flex items-center justify-between py-2 text-sm">
                        <div>
                          <p className="font-semibold text-slate-800">{item.name}</p>
                          <p className="text-xs text-slate-500">
                            Người trả: <span className="font-semibold text-slate-700">{payer ? payer.display_name : "Không rõ"}</span>
                            {item.split_between_display_names && item.split_between_display_names.length > 0 && (
                              <span className="ml-2 bg-rose-50 text-[10px] text-rose-600 px-1.5 py-0.5 rounded font-bold border border-rose-100">
                                Chia riêng cho: {item.split_between_display_names.join(", ")}
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-slate-900">{formatVnd(item.amount_vnd)}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="text-xs font-semibold text-rose-600 hover:underline cursor-pointer"
                          >
                            Xóa
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex justify-between py-2 font-bold text-slate-900 text-base">
                    <span>Tổng cộng:</span>
                    <span>{formatVnd(totalAmountSum)}</span>
                  </div>
                </div>
              )}

              {/* Form thêm khoản chi */}
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                <p className="text-xs font-bold text-slate-500 uppercase mb-3">Thêm khoản chi mới</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Tên khoản chi</label>
                    <input
                      type="text"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      placeholder="Tiền sân, nước, cầu..."
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs focus:border-red-800 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Số tiền (VNĐ)</label>
                    <input
                      type="number"
                      value={newItemAmount}
                      onChange={(e) => setNewItemAmount(e.target.value)}
                      placeholder="Ví dụ: 300000"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs focus:border-red-800 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Ai đã trả tiền?</label>
                    <select
                      value={newItemPayerId}
                      onChange={(e) => setNewItemPayerId(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs focus:border-red-800 focus:outline-none"
                    >
                      <option value="">-- Chọn người chơi --</option>
                      {participants.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.display_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Phân chia chi phí riêng (Custom Splitting) */}
                  <div className="sm:col-span-3 border-t border-slate-200/60 pt-3">
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Cách phân chia chi phí này:</label>
                    <div className="flex gap-4 mb-2">
                      <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="radio"
                          name="split_type"
                          checked={newItemSplitType === "all"}
                          onChange={() => setNewItemSplitType("all")}
                        />
                        Chia đều cho tất cả mọi người
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="radio"
                          name="split_type"
                          checked={newItemSplitType === "custom"}
                          onChange={() => {
                            setNewItemSplitType("custom");
                            if (newItemSplitBetween.length === 0) {
                              setNewItemSplitBetween(participants.map((p) => p.display_name));
                            }
                          }}
                        />
                        Chỉ chia cho những người được chọn (Nợ riêng)
                      </label>
                    </div>

                    {newItemSplitType === "custom" && (
                      <div className="rounded-lg bg-white border border-slate-200 p-2.5 max-h-[120px] overflow-y-auto grid grid-cols-2 gap-2">
                        {participants.map((p) => {
                          const isChecked = newItemSplitBetween.includes(p.display_name);
                          return (
                            <label key={p.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  if (isChecked) {
                                    setNewItemSplitBetween(newItemSplitBetween.filter((x) => x !== p.display_name));
                                  } else {
                                    setNewItemSplitBetween([...newItemSplitBetween, p.display_name]);
                                  }
                                }}
                              />
                              {p.display_name}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="sm:col-span-3 flex justify-end">
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-semibold px-3 py-1.5 text-xs transition cursor-pointer"
                    >
                      ➕ Thêm khoản chi
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Cấu hình người chơi tham gia */}
          <div className="space-y-6">
            <Card>
              <h2 className="text-base font-bold text-slate-800 mb-4">2. Ai chơi hôm nay? (Đang có {participants.length} người)</h2>
              <div className="mb-4 space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {participants.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-2.5 text-sm bg-white">
                    <div className="flex items-center gap-2 flex-1 mr-2">
                      <input
                        type="text"
                        value={p.display_name}
                        onChange={(e) => {
                          const newName = e.target.value;
                          setParticipants(participants.map((x) => x.id === p.id ? { ...x, display_name: newName } : x));
                          setItems(items.map((item) => item.paid_by_participant_id === p.id ? { ...item, paid_by_display_name: newName } : item));
                        }}
                        placeholder="Nhập tên người chơi..."
                        className="font-semibold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-red-800 focus:bg-slate-50 focus:outline-none px-1 rounded text-sm w-full transition"
                      />
                      {p.is_guest ? (
                        <span className="rounded bg-slate-100 text-[10px] px-1 text-slate-500 font-semibold shrink-0">Khách</span>
                      ) : (
                        <span className="rounded bg-emerald-50 text-[10px] px-1 text-emerald-600 font-semibold shrink-0">Thành viên</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveParticipant(p.id)}
                      className="text-xs font-semibold text-rose-600 hover:underline cursor-pointer"
                    >
                      Xóa
                    </button>
                  </div>
                ))}
              </div>

              {/* Form thêm khách vãng lai */}
              <div className="border-t border-slate-100 pt-3">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Thêm người chơi ngoài (Khách)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newParticipantName}
                    onChange={(e) => setNewParticipantName(e.target.value)}
                    placeholder="Nhập tên khách..."
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-red-800 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddParticipant}
                    className="rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold px-3 py-1.5 text-xs transition cursor-pointer"
                  >
                    Thêm
                  </button>
                </div>
              </div>

              {/* Gợi ý người chơi cũ */}
              {frequentPlayers.length > 0 && (
                <div className="border-t border-slate-100 pt-3">
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Gợi ý người chơi cũ (Click để thêm):</label>
                  <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto pr-1">
                    {frequentPlayers
                      .filter((name) => !participants.some((p) => p.display_name.toLowerCase() === name.toLowerCase()))
                      .map((name) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => {
                            const newP: Participant = {
                              id: `p-${Date.now()}-${Math.random()}`,
                              user_id: null,
                              display_name: name,
                              is_guest: true,
                              amount_paid_vnd: 0,
                              amount_owed_vnd: 0,
                              balance_vnd: 0
                            };
                            setParticipants([...participants, newP]);
                          }}
                          className="rounded bg-slate-100 text-[11px] px-2 py-0.5 text-slate-600 hover:bg-slate-200 transition font-semibold cursor-pointer border border-slate-200"
                        >
                          +{name}
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="border-t border-slate-100 pt-4 flex gap-2">
                {data?.exists && (
                  <button
                    type="button"
                    onClick={() => {
                      setError("");
                      setIsEditing(false);
                      // Restore
                      setTitle(data.expense.title);
                      setExpenseDate(data.expense.expense_date);
                      setNotes(data.expense.notes || "");
                      setParticipants(data.participants);
                      setItems(data.items);
                    }}
                    className="flex-1 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold py-2 text-sm transition cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 rounded-lg bg-red-800 hover:bg-red-900 text-white font-semibold py-2 text-sm transition cursor-pointer disabled:opacity-50 shadow-sm"
                >
                  {isSaving ? "Đang lưu..." : "Lưu & Tính chia tiền"}
                </button>
              </div>
            </Card>
          </div>
        </form>
      ) : (
        /* MÀN HÌNH XEM THỐNG KÊ CHI TIẾT & TICK NỢ */
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Breakdown / Stat cards */}
          <div className="lg:col-span-2 space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard label="Tổng hóa đơn" value={formatVnd(data?.expense.total_amount_vnd || 0)} helper="Tổng cộng tất cả các khoản chi" />
              <StatCard label="Số người chơi" value={`${participants.length} người`} helper="Số lượng tham gia chia đều" />
              <StatCard label="Chia đều mỗi người" value={formatVnd(data?.expense.split_amount_vnd || 0)} helper="Mỗi người phải trả" tone="default" />
            </div>

            {/* Danh sách các khoản chi */}
            <Card>
              <h2 className="text-base font-bold text-slate-800 mb-4">Chi tiết các khoản chi tiêu</h2>
              <div className="divide-y divide-slate-100">
                {items.map((item) => {
                  const payer = participants.find((p) => p.id === item.paid_by_participant_id);
                  return (
                    <div key={item.id} className="flex justify-between py-3 text-sm">
                      <div>
                        <p className="font-semibold text-slate-800">{item.name}</p>
                        <p className="text-xs text-slate-500">
                          Người trả trước: <span className="font-semibold text-slate-700">{payer ? payer.display_name : "Không rõ"}</span>
                        </p>
                      </div>
                      <span className="font-bold text-slate-900">{formatVnd(item.amount_vnd)}</span>
                    </div>
                  );
                })}
              </div>
              {data?.expense.notes && (
                <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm border-l-4 border-slate-400">
                  <p className="font-bold text-slate-700">Mô tả thêm:</p>
                  <p className="text-slate-600 mt-1">{data.expense.notes}</p>
                </div>
              )}
            </Card>

            {/* Danh sách người tham gia & số tiền chênh lệch */}
            <Card>
              <h2 className="text-base font-bold text-slate-800 mb-4">Thành viên tham gia & Cân đối thu chi</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                      <th className="py-2">Người chơi</th>
                      <th className="py-2 text-right">Đã trả trước</th>
                      <th className="py-2 text-right">Phải trả</th>
                      <th className="py-2 text-right">Cân đối (Dư/Thiếu)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {participants.map((p) => {
                      const isMinus = p.balance_vnd < 0;
                      const isPlus = p.balance_vnd > 0;
                      return (
                        <tr key={p.id}>
                          <td className="py-3">
                            <span className="font-semibold text-slate-900">{p.display_name}</span>
                            {p.user_id === currentUser?.id ? <span className="ml-1 text-xs text-slate-400">(Bạn)</span> : null}
                          </td>
                          <td className="py-3 text-right">{formatVnd(p.amount_paid_vnd)}</td>
                          <td className="py-3 text-right">{formatVnd(p.amount_owed_vnd)}</td>
                          <td className={`py-3 text-right font-bold ${isMinus ? "text-rose-600" : isPlus ? "text-emerald-600" : "text-slate-500"}`}>
                            {isPlus ? "+" : ""}
                            {formatVnd(p.balance_vnd)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Giao dịch đề xuất chuyển tiền / mã QR */}
          <div className="space-y-6">
            <Card>
              <h2 className="text-base font-bold text-slate-800 mb-4">Đề xuất chuyển tiền</h2>
              {data?.payments.length === 0 ? (
                <p className="text-sm text-slate-500 italic">Mọi người đã đóng đủ và hòa tiền. Không cần chuyển thêm!</p>
              ) : (
                <div className="space-y-4">
                  {data?.payments.map((p) => {
                    const isSenderMe = p.sender_participant_id === participants.find((x) => x.user_id === currentUser?.id)?.id;
                    const isReceiverMe = p.receiver_participant_id === participants.find((x) => x.user_id === currentUser?.id)?.id;
                    
                    const isSettleEnabled = isCreator || isReceiverMe;
                    const qrUrl = `https://img.vietqr.io/image/970415-1100010959-qr_only.png?amount=${p.amount_vnd}&addInfo=Chuyen%20tien%20${p.sender_name}%20nho%20san`;

                    return (
                      <div key={p.id} className={`rounded-xl border p-4 text-sm ${p.status === "settled" ? "bg-slate-50 border-slate-200 opacity-60" : "bg-white border-slate-200"}`}>
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2 font-semibold">
                          <span className={`${isSenderMe ? "text-rose-600 font-bold" : "text-slate-700"}`}>{p.sender_name}</span>
                          <span className="text-slate-400">→</span>
                          <span className={`${isReceiverMe ? "text-emerald-600 font-bold" : "text-slate-700"}`}>{p.receiver_name}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <p className="text-base font-bold text-slate-900">{formatVnd(p.amount_vnd)}</p>
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${p.status === "settled" ? "bg-slate-200 text-slate-600" : "bg-amber-100 text-amber-800"}`}>
                            {p.status === "settled" ? "Đã xong" : "Chưa trả"}
                          </span>
                        </div>

                        {/* QR Code hiển thị cho người chuyển */}
                        {p.status === "pending" && isSenderMe && (
                          <div className="mt-3 border-t border-slate-100 pt-3 text-center">
                            <p className="text-xs text-slate-500 font-semibold mb-2">Quét mã VietQR để gửi tiền cho {p.receiver_name}</p>
                            <div className="flex justify-center">
                              <img
                                src={qrUrl}
                                alt={`QR chuyển khoản ${p.amount_vnd}đ`}
                                className="h-36 w-36 rounded-lg border border-slate-200 shadow-sm"
                              />
                            </div>
                          </div>
                        )}

                        {/* Tick nợ Button */}
                        {isSettleEnabled && (
                          <div className="mt-3 flex justify-end">
                            <button
                              onClick={() => void togglePayment(p.id, p.status)}
                              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer shadow-sm ${
                                p.status === "settled"
                                  ? "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300"
                                  : "bg-red-800 hover:bg-red-900 text-white"
                              }`}
                            >
                              {p.status === "settled" ? "↩ Đánh dấu chưa trả" : "✓ Xác nhận đã nhận tiền"}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
