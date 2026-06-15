"use client";

import React, { useEffect, useState, FormEvent } from "react";
import { Tournament } from "./TournamentDetailModal";
import { errorMessage, formatVnd } from "@/lib/format";

type Props = {
  tournament: Tournament | null;
  onClose: () => void;
  onSubmit: (tournamentId: string, teamData: { teamName: string; player1: string; player2: string; phone: string; email: string }) => Promise<TournamentRegistrationResult>;
  currentUserName: string;
  currentUserEmail: string;
};

type TournamentRegistrationResult = {
  id: string;
  tournamentId: string;
  status: "pending" | "registered" | "cancelled";
  teamName: string;
  registrationCode: string;
  fee: number;
  bankQrImageUrl: string | null;
  bankTransferCaption: string | null;
  paymentCaption: string;
  createdAt: string;
  tournament: Tournament;
};

export default function TournamentRegisterModal({ tournament, onClose, onSubmit, currentUserName, currentUserEmail }: Props) {
  const [teamName, setTeamName] = useState("");
  const [player1, setPlayer1] = useState(currentUserName);
  const [player2, setPlayer2] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(currentUserEmail);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState<TournamentRegistrationResult | null>(null);

  useEffect(() => {
    setPlayer1(currentUserName);
  }, [currentUserName]);

  useEffect(() => {
    setEmail(currentUserEmail);
  }, [currentUserEmail]);

  if (!tournament) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) {
      setError("Vui lòng nhập tên đội");
      return;
    }
    if (!player1.trim()) {
      setError("Vui lòng nhập tên thành viên 1");
      return;
    }
    if (!phone.trim()) {
      setError("Vui lòng nhập số điện thoại liên hệ");
      return;
    }
    if (!email.trim()) {
      setError("Vui lòng nhập email liên hệ");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      const created = await onSubmit(tournament.id, {
        teamName: teamName.trim(),
        player1: player1.trim(),
        player2: player2.trim(),
        phone: phone.trim(),
        email: email.trim(),
      });
      setPaymentInfo(created);
    } catch (caught) {
      setError(errorMessage(caught, "Không đăng ký được giải đấu"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-55 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" onClick={onClose} />

      {/* Modal Container */}
      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="bg-red-50/20 border-b border-slate-100 p-5 shrink-0 flex items-center justify-between">
          <div>
            <h3 className="font-heading font-extrabold text-slate-900 text-lg">Đăng ký tham gia</h3>
            <p className="text-xs text-slate-500 mt-1 truncate max-w-[320px]" title={tournament.title}>
              Giải đấu: {tournament.title}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {/* Form body */}
        <div className="p-5 space-y-4 flex-1 overflow-y-auto">
          {paymentInfo ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3.5">
                <p className="text-sm font-extrabold text-emerald-800">Đã gửi đơn đăng ký</p>
                <p className="mt-1 text-xs font-semibold leading-relaxed text-emerald-700">
                  Admin sẽ kiểm tra thanh toán thủ công trước khi xác nhận suất thi đấu.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold uppercase tracking-wider text-slate-500">Mã đơn</span>
                  <span className="rounded-lg bg-white px-3 py-1.5 font-mono text-sm font-black text-slate-950 ring-1 ring-slate-200">
                    {paymentInfo.registrationCode}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-3">
                  <span className="font-semibold text-slate-650">Lệ phí giải đấu:</span>
                  <span className="font-extrabold text-slate-900 text-sm">
                    {paymentInfo.fee === 0 ? "Miễn phí" : formatVnd(paymentInfo.fee)}
                  </span>
                </div>
              </div>

              {paymentInfo.bankQrImageUrl ? (
                <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
                  <img
                    src={paymentInfo.bankQrImageUrl}
                    alt="QR chuyển khoản"
                    className="mx-auto h-56 w-56 max-w-full rounded-xl object-contain"
                  />
                </div>
              ) : null}

              <div className="rounded-xl border border-red-100 bg-red-50 p-3.5">
                <p className="whitespace-pre-line text-sm font-semibold leading-relaxed text-red-900">
                  {paymentInfo.paymentCaption}
                </p>
              </div>
            </div>
          ) : (
            <>
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-100 p-3 text-xs text-red-700 font-semibold">
              ⚠️ {error}
            </div>
          )}

          {/* Tên Đội */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Tên đội thi đấu <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 transition focus:border-red-500 focus:outline-none placeholder:text-slate-400 placeholder:font-normal"
              placeholder="Ví dụ: Hòa Lạc Warriors"
              value={teamName}
              onChange={(e) => {
                setTeamName(e.target.value);
                setError("");
              }}
            />
          </div>

          {/* Thành viên 1 */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Thành viên 1 (Bạn) <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-bold text-slate-500 cursor-not-allowed focus:outline-none"
              value={player1}
              onChange={(e) => setPlayer1(e.target.value)}
              disabled={Boolean(currentUserName)}
            />
          </div>

          {/* Thành viên 2 (đánh đôi) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Thành viên 2 (Đồng đội) <span className="text-slate-400 font-normal">(Không bắt buộc nếu đấu đơn)</span>
            </label>
            <input
              type="text"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 transition focus:border-red-500 focus:outline-none placeholder:text-slate-400 placeholder:font-normal"
              placeholder="Nhập tên đồng đội..."
              value={player2}
              onChange={(e) => setPlayer2(e.target.value)}
            />
          </div>

          {/* Số điện thoại */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Số điện thoại liên hệ <span className="text-red-600">*</span>
            </label>
            <input
              type="tel"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 transition focus:border-red-500 focus:outline-none placeholder:text-slate-400 placeholder:font-normal"
              placeholder="Ví dụ: 0912345678"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setError("");
              }}
            />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Email liên hệ <span className="text-red-600">*</span>
            </label>
            <input
              type="email"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 transition focus:border-red-500 focus:outline-none placeholder:text-slate-400 placeholder:font-normal"
              placeholder="Ví dụ: netup@gmail.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
            />
          </div>

          {/* Fee Notice */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-xs space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-650">Lệ phí giải đấu:</span>
              <span className="font-extrabold text-slate-900 text-sm">
                {tournament.fee === 0 ? "Miễn phí" : formatVnd(tournament.fee)}
              </span>
            </div>
            <p className="font-semibold leading-relaxed text-slate-500">
              Sau khi gửi đơn, trạng thái sẽ là chờ admin kiểm tra thanh toán thủ công.
            </p>
          </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50 p-4 shrink-0 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-4.5 py-2 text-xs font-bold text-slate-750 hover:bg-slate-50 transition cursor-pointer"
          >
            {paymentInfo ? "Xong" : "Hủy"}
          </button>
          {!paymentInfo && (
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-[#b00c14] hover:bg-red-950 px-4.5 py-2 text-xs font-bold text-white transition shadow-xs cursor-pointer disabled:opacity-60"
            >
              {isSubmitting ? "Đang gửi đơn..." : "Gửi đơn đăng ký"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
