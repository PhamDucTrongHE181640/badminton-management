"use client";

import React, { useState, FormEvent } from "react";
import { Tournament } from "./TournamentDetailModal";
import { formatVnd } from "@/lib/format";

type Props = {
  tournament: Tournament | null;
  onClose: () => void;
  onSubmit: (tournamentId: string, teamData: { teamName: string; player1: string; player2: string; phone: string; email: string }) => void;
};

export default function TournamentRegisterModal({ tournament, onClose, onSubmit }: Props) {
  const [teamName, setTeamName] = useState("");
  const [player1, setPlayer1] = useState("Minh Tuấn"); // Mặc định là user đang đăng nhập
  const [player2, setPlayer2] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  if (!tournament) return null;

  const handleSubmit = (e: FormEvent) => {
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

    onSubmit(tournament.id, {
      teamName: teamName.trim(),
      player1: player1.trim(),
      player2: player2.trim(),
      phone: phone.trim(),
      email: email.trim(),
    });
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
              disabled
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
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 flex justify-between items-center text-xs">
            <span className="font-semibold text-slate-650">Lệ phí giải đấu:</span>
            <span className="font-extrabold text-slate-900 text-sm">
              {tournament.fee === 0 ? "Miễn phí" : formatVnd(tournament.fee)}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50 p-4 shrink-0 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-4.5 py-2 text-xs font-bold text-slate-750 hover:bg-slate-50 transition cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="submit"
            className="rounded-xl bg-[#b00c14] hover:bg-red-950 px-4.5 py-2 text-xs font-bold text-white transition shadow-xs cursor-pointer"
          >
            Xác nhận đăng ký
          </button>
        </div>
      </form>
    </div>
  );
}
