"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

interface PublishPoolModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (openSlots: number) => void;
  maxSlots: number;
  isLoading: boolean;
}

export function PublishPoolModal({ isOpen, onClose, onConfirm, maxSlots, isLoading }: PublishPoolModalProps) {
  const [openSlots, setOpenSlots] = useState(maxSlots - 1);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-xl overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-800">Tìm thêm đồng đội</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-600">
            Sân bạn đã đặt có sức chứa <strong>{maxSlots}</strong> người. Bạn muốn mở thêm bao nhiêu slot để người khác tham gia ghép đội?
          </p>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-800">Số slot cần tìm thêm</label>
            <select
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 font-semibold text-slate-700 outline-none focus:border-blue-300"
              value={openSlots}
              onChange={(e) => setOpenSlots(Number(e.target.value))}
            >
              {Array.from({ length: maxSlots - 1 }).map((_, i) => {
                const count = i + 1;
                return (
                  <option key={count} value={count}>
                    {count} người
                  </option>
                );
              })}
            </select>
          </div>

          <div className="bg-blue-50 border border-blue-100 p-3.5 rounded-xl text-[11px] text-blue-800 space-y-1.5 font-medium leading-relaxed">
            <p className="font-bold text-blue-900">Lưu ý khi mở ghép đội:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Thông tin sân của bạn sẽ xuất hiện bên trang <strong>Xếp đối vãng lai</strong>.</li>
              <li>Sẽ có những người lạ đăng ký tham gia vào sân của bạn.</li>
            </ul>
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isLoading} className="rounded-xl border-slate-200">
            Hủy
          </Button>
          <Button
            onClick={() => onConfirm(openSlots)}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white border-none rounded-xl font-bold px-6 shadow-sm shadow-blue-200"
          >
            {isLoading ? "Đang xử lý..." : "Xác nhận mở đăng ký"}
          </Button>
        </div>
      </div>
    </div>
  );
}
