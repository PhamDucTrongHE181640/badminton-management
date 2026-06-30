"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHero, Notice } from "@/components/ui";
import { apiFetch } from "@/lib/http";
import { errorMessage } from "@/lib/format";
import { Lock, Unlock, Clock, CalendarDays, Check } from "lucide-react";

function shortDateLabel(startsAt: string) {
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return "Chưa có ngày";
  return date.toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" });
}

type Court = {
  id: string;
  name: string;
  complex_name?: string;
  sub_court_name?: string;
};
type Session = {
  id: string;
  starts_at: string;
  ends_at: string;
  open_slots: number;
  max_slots: number;
  status: string;
};

function generateDateOptions(days: number) {
  const options = [];
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(today.getTime() + i * 86400000);
    const offset = d.getTimezoneOffset();
    const localDate = new Date(d.getTime() - offset * 60 * 1000);
    const value = localDate.toISOString().split("T")[0]; // YYYY-MM-DD
    const label = shortDateLabel(d.toISOString());
    options.push({ value, label });
  }
  return options;
}

export default function OwnerSchedulePage() {
  const [courts, setCourts] = useState<Court[]>([]);
  const [selectedCourtId, setSelectedCourtId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const dateOptions = useMemo(() => generateDateOptions(30), []);

  useEffect(() => {
    async function loadCourts() {
      try {
        const data = await apiFetch<Court[]>("/api/v1/owner/courts", { credentials: "include" });
        setCourts(data);
        if (data.length > 0) {
          setSelectedCourtId(data[0].id);
        }
      } catch (err) {
        setError(errorMessage(err, "Không thể tải danh sách sân"));
      } finally {
        setLoading(false);
      }
    }
    void loadCourts();
  }, []);

  useEffect(() => {
    if (!selectedCourtId || !selectedDate) {
      setSessions([]);
      return;
    }
    async function loadSessions() {
      try {
        const query = new URLSearchParams();
        query.set("court_id", selectedCourtId);
        query.set("target_date", selectedDate);
        const data = await apiFetch<Session[]>(`/api/v1/owner/sessions?${query.toString()}`, { credentials: "include" });
        // Sort sessions by starts_at
        data.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
        setSessions(data);
      } catch (err) {
        setError(errorMessage(err, "Không thể tải danh sách ca"));
      }
    }
    void loadSessions();
    setSelectedIds(new Set());
  }, [selectedCourtId, selectedDate]);

  const toggleSelection = (sessionId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  };

  const selectAll = () => {
    const selectable = sessions.filter(s => {
      const isBooked = s.open_slots < s.max_slots && s.status !== "cancelled";
      const isPast = new Date(s.starts_at).getTime() < Date.now();
      return !isPast && !isBooked;
    }).map(s => s.id);
    setSelectedIds(new Set(selectable));
  };

  const bulkUpdate = async (newStatus: "scheduled" | "cancelled") => {
    if (isUpdating || selectedIds.size === 0) return;
    setIsUpdating(true);
    try {
      const promises = Array.from(selectedIds).map(id =>
        apiFetch<Session>(`/api/v1/owner/sessions/${id}`, {
          method: "PATCH",
          credentials: "include",
          body: JSON.stringify({ status: newStatus }),
        })
      );
      const results = await Promise.all(promises);
      setSessions((prev) =>
        prev.map((s) => {
          const updated = results.find((r) => r.id === s.id);
          return updated ? updated : s;
        })
      );
      setSelectedIds(new Set());
    } catch (err) {
      alert(errorMessage(err, "Cập nhật ca thất bại"));
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div>
      <PageHero
        eyebrow="Quản lý sân"
        title="Quản lý Lịch sân"
        description="Chủ động thiết lập đóng/mở các khung giờ trong ngày cho từng sân."
      />

      <div className="mt-6 flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <label className="block text-sm font-semibold text-slate-700 mb-1">Chọn Sân</label>
          <select
            className="w-full h-11 px-3 border border-slate-200 rounded-xl bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#b00c14]"
            value={selectedCourtId}
            onChange={(e) => setSelectedCourtId(e.target.value)}
            disabled={loading}
          >
            {loading && <option>Đang tải...</option>}
            {courts.map((court) => (
              <option key={court.id} value={court.id}>
                {court.complex_name ? `${court.complex_name} - ` : ""}{court.name} {court.sub_court_name ? `(${court.sub_court_name})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-sm font-semibold text-slate-700 mb-1">Chọn Ngày</label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <CalendarDays className="w-4 h-4" />
            </div>
            <select
              className="w-full h-11 pl-9 pr-3 border border-slate-200 rounded-xl bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#b00c14]"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            >
              {dateOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && <Notice tone="danger">{error}</Notice>}

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
            <Clock className="w-5 h-5 text-slate-400" /> Các khung giờ ({sessions.length})
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={selectAll}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition"
            >
              Chọn tất cả khả dụng
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition"
            >
              Bỏ chọn
            </button>
          </div>
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-4 text-xs font-medium">
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-green-50 border border-green-200"></span> Trống</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-50 border border-blue-200"></span> Đã có khách đặt</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-slate-200 border border-slate-300"></span> Đã qua giờ</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-slate-100 border-dashed border border-slate-300"></span> Khóa</div>
          </div>

        {sessions.length === 0 ? (
          <div className="text-center py-10 text-slate-500">
            {loading ? "Đang tải dữ liệu..." : "Không có lịch cho ngày này."}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {sessions.map((session) => {
              const isLocked = session.status === "cancelled";
              const isBooked = session.open_slots < session.max_slots && !isLocked;
              const dateObj = new Date(session.starts_at);
              const isPast = dateObj.getTime() < Date.now();
              const timeLabel = dateObj.toLocaleTimeString("vi-VN", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Asia/Ho_Chi_Minh",
              });
              const isSelected = selectedIds.has(session.id);

              let styleClass = "bg-green-50 border-green-200 text-green-700 hover:bg-green-100";
              let title = "Còn trống, nhấn để khóa";
              
              if (isPast) {
                styleClass = "bg-slate-200 border-slate-300 text-slate-500 cursor-not-allowed";
                title = "Đã qua giờ";
              } else if (isLocked) {
                styleClass = "bg-slate-100 border-slate-300 border-dashed text-slate-400 hover:bg-slate-200";
                title = "Đang khóa, nhấn để mở";
              } else if (isBooked) {
                styleClass = "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 cursor-not-allowed";
                title = `Đã có ${session.max_slots - session.open_slots}/${session.max_slots} khách đặt`;
              }

              return (
                <button
                  key={session.id}
                  title={title}
                  onClick={() => {
                    if (isPast || isBooked) return;
                    toggleSelection(session.id);
                  }}
                  disabled={isUpdating || isPast || isBooked}
                  className={`
                    relative flex flex-col items-center justify-center py-3 px-2 rounded-xl border-2 transition font-bold text-sm
                    ${styleClass}
                    ${isSelected ? "ring-2 ring-offset-2 ring-blue-500 border-blue-500 scale-[0.98]" : ""}
                    ${isUpdating ? "opacity-50 cursor-wait" : ""}
                  `}
                >
                  <span className="mb-1">{timeLabel}</span>
                  {isSelected ? (
                    <Check className="w-4 h-4 text-blue-600" />
                  ) : (
                    isLocked ? <Lock className="w-3 h-3" /> : (isBooked || isPast ? null : <Unlock className="w-3 h-3" />)
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-6 animate-in slide-in-from-bottom-5 z-50">
          <div className="font-semibold">
            Đã chọn <span className="text-blue-400 text-lg mx-1">{selectedIds.size}</span> ca
          </div>
          <div className="w-px h-6 bg-slate-700"></div>
          <div className="flex gap-3">
            <button
              onClick={() => bulkUpdate("scheduled")}
              disabled={isUpdating}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-xl font-bold transition disabled:opacity-50"
            >
              <Unlock className="w-4 h-4" /> Mở khóa
            </button>
            <button
              onClick={() => bulkUpdate("cancelled")}
              disabled={isUpdating}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 rounded-xl font-bold transition disabled:opacity-50"
            >
              <Lock className="w-4 h-4" /> Khóa
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
