"use client";

import React, { useState, FormEvent } from "react";
import { Tournament } from "./TournamentDetailModal";
import { formatVnd } from "@/lib/format";

type Props = {
  onClose: () => void;
  onCreate: (newTournament: Tournament) => void;
};

// 4 high-quality banners for the sports
const bannerTemplates = [
  { id: "banner-badminton", sport: "Cầu lông", url: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=600&fit=crop&q=80" },
  { id: "banner-tennis", sport: "Tennis", url: "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=600&fit=crop&q=80" },
  { id: "banner-pickleball", sport: "Pickleball", url: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=600&fit=crop&q=80" }, // standard sport placeholder
  { id: "banner-football", sport: "Bóng đá", url: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=600&fit=crop&q=80" }
];

export default function TournamentCreateModal({ onClose, onCreate }: Props) {
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");

  // Step 1 states
  const [title, setTitle] = useState("");
  const [sport, setSport] = useState("Cầu lông");
  const [region, setRegion] = useState("Hòa Lạc, Hà Nội");
  const [location, setLocation] = useState("");
  const [prizeMoney, setPrizeMoney] = useState(10000000);

  // Step 2 states
  const [maxTeams, setMaxTeams] = useState(16);
  const [teamType, setTeamType] = useState("Đôi"); // Đơn / Đôi
  const [formatType, setFormatType] = useState("Loại trực tiếp"); // Loại trực tiếp / Vòng tròn
  const [level, setLevel] = useState<"movement" | "semi_pro" | "pro">("movement");
  const [fee, setFee] = useState(200000);
  const [startDate, setStartDate] = useState("15/06/2026");
  const [endDate, setEndDate] = useState("20/06/2026");

  // Step 3 states
  const [selectedBanner, setSelectedBanner] = useState(bannerTemplates[0].url);

  const handleNext = () => {
    if (step === 1) {
      if (!title.trim()) {
        setError("Vui lòng nhập tên giải đấu");
        return;
      }
      if (!location.trim()) {
        setError("Vui lòng nhập địa điểm tổ chức cụ thể");
        return;
      }
      if (prizeMoney <= 0) {
        setError("Giải thưởng phải lớn hơn 0");
        return;
      }
      setError("");
      // Cập nhật banner mặc định dựa trên môn thể thao được chọn
      const template = bannerTemplates.find(b => b.sport === sport);
      if (template) {
        setSelectedBanner(template.url);
      }
      setStep(2);
    } else if (step === 2) {
      if (!startDate.trim() || !endDate.trim()) {
        setError("Vui lòng điền ngày bắt đầu và ngày kết thúc");
        return;
      }
      setError("");
      setStep(3);
    }
  };

  const handleBack = () => {
    setError("");
    setStep(prev => Math.max(1, prev - 1));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    
    // Create new tournament item
    const newTourney: Tournament = {
      id: `tourney-custom-${Date.now()}`,
      title: title.trim(),
      sport: sport,
      status: "upcoming",
      startDate: startDate.trim(),
      endDate: endDate.trim(),
      location: `${location.trim()}, ${region}`,
      joinedTeams: 0,
      maxTeams: maxTeams,
      prizeMoney: prizeMoney,
      image: selectedBanner,
      level: level,
      fee: fee,
      description: `Giải đấu giao lưu môn ${sport} được tổ chức dành cho người chơi trình độ ${
        level === "movement" ? "Phong trào" : level === "semi_pro" ? "Bán chuyên" : "Chuyên nghiệp"
      }. Thể thức thi đấu ${teamType} - ${formatType}. Cam kết mang đến trải nghiệm giao lưu công bằng, kịch tính.`,
      bracket: [
        {
          roundName: "Bán kết",
          matches: [
            { id: "semi-1", teamA: "Chờ xác định", teamB: "Chờ xác định" },
            { id: "semi-2", teamA: "Chờ xác định", teamB: "Chờ xác định" }
          ]
        },
        {
          roundName: "Chung kết",
          matches: [
            { id: "final-1", teamA: "Thắng Bán kết 1", teamB: "Thắng Bán kết 2" }
          ]
        }
      ]
    };

    onCreate(newTourney);
  };

  return (
    <div className="fixed inset-0 z-55 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" onClick={onClose} />

      {/* Modal Container */}
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-red-50/20 border-b border-slate-100 p-5 shrink-0">
          <div className="flex items-center justify-between">
            <h3 className="font-heading font-extrabold text-slate-900 text-lg">Tạo giải đấu mới</h3>
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer text-sm font-bold"
            >
              ✕
            </button>
          </div>
          
          {/* Progress Indicator */}
          <div className="mt-4 flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <React.Fragment key={s}>
                <div className="flex items-center gap-1.5">
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold transition ${
                    step === s
                      ? "bg-red-800 text-white"
                      : step > s
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-200 text-slate-500"
                  }`}>
                    {step > s ? "✓" : s}
                  </div>
                  <span className={`text-xs font-bold transition ${
                    step === s ? "text-slate-800" : "text-slate-400"
                  }`}>
                    {s === 1 ? "Thông tin chung" : s === 2 ? "Thể thức & Phí" : "Chọn Banner"}
                  </span>
                </div>
                {s < 3 && <div className="flex-1 h-0.5 bg-slate-200" />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Content body - scrollable */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4 max-h-[55vh]">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-100 p-3 text-xs text-red-700 font-semibold">
              ⚠️ {error}
            </div>
          )}

          {/* STEP 1: General Info */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Tên giải đấu *</label>
                <input
                  type="text"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 transition focus:border-red-500 focus:outline-none placeholder:text-slate-400 placeholder:font-normal"
                  placeholder="Ví dụ: NetUP Hòa Lạc Badminton Cup 2026"
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); setError(""); }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Môn thể thao</label>
                  <select
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:border-red-500 focus:outline-none"
                    value={sport}
                    onChange={(e) => setSport(e.target.value)}
                  >
                    <option value="Cầu lông">Cầu lông</option>
                    <option value="Tennis">Tennis</option>
                    <option value="Pickleball">Pickleball</option>
                    <option value="Bóng đá">Bóng đá</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Khu vực</label>
                  <select
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:border-red-500 focus:outline-none"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                  >
                    <option value="Hòa Lạc, Hà Nội">Hòa Lạc, Hà Nội</option>
                    <option value="Cầu Giấy, Hà Nội">Cầu Giấy, Hà Nội</option>
                    <option value="Mỹ Đình, Hà Nội">Mỹ Đình, Hà Nội</option>
                    <option value="Thanh Xuân, Hà Nội">Thanh Xuân, Hà Nội</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Địa điểm tổ chức cụ thể *</label>
                <input
                  type="text"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 transition focus:border-red-500 focus:outline-none placeholder:text-slate-400 placeholder:font-normal"
                  placeholder="Ví dụ: Nhà thi đấu ĐH FPT Hòa Lạc"
                  value={location}
                  onChange={(e) => { setLocation(e.target.value); setError(""); }}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Tổng giải thưởng (VNĐ) *</label>
                <input
                  type="number"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-800 transition focus:border-red-500 focus:outline-none"
                  value={prizeMoney}
                  onChange={(e) => { setPrizeMoney(Number(e.target.value)); setError(""); }}
                />
              </div>
            </div>
          )}

          {/* STEP 2: Format & Fees */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Thể thức đội</label>
                  <select
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:border-red-500 focus:outline-none"
                    value={teamType}
                    onChange={(e) => setTeamType(e.target.value)}
                  >
                    <option value="Đôi">Đấu Đôi (2 người)</option>
                    <option value="Đơn">Đấu Đơn (1 người)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Hình thức vòng đấu</label>
                  <select
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:border-red-500 focus:outline-none"
                    value={formatType}
                    onChange={(e) => setFormatType(e.target.value)}
                  >
                    <option value="Loại trực tiếp">Loại trực tiếp (Knockout)</option>
                    <option value="Vòng tròn">Vòng tròn tính điểm</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Quy mô (Số đội tối đa)</label>
                  <select
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:border-red-500 focus:outline-none"
                    value={maxTeams}
                    onChange={(e) => setMaxTeams(Number(e.target.value))}
                  >
                    <option value={8}>8 đội</option>
                    <option value={16}>16 đội</option>
                    <option value={32}>32 đội</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Cấp độ giải</label>
                  <select
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:border-red-500 focus:outline-none"
                    value={level}
                    onChange={(e) => setLevel(e.target.value as "movement" | "semi_pro" | "pro")}
                  >
                    <option value="movement">Phong trào</option>
                    <option value="semi_pro">Bán chuyên</option>
                    <option value="pro">Chuyên nghiệp</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Ngày bắt đầu *</label>
                  <input
                    type="text"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:border-red-500 focus:outline-none"
                    placeholder="DD/MM/YYYY"
                    value={startDate}
                    onChange={(e) => { setStartDate(e.target.value); setError(""); }}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Ngày kết thúc *</label>
                  <input
                    type="text"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:border-red-500 focus:outline-none"
                    placeholder="DD/MM/YYYY"
                    value={endDate}
                    onChange={(e) => { setEndDate(e.target.value); setError(""); }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Lệ phí đăng ký (VNĐ) *</label>
                <input
                  type="number"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-800 transition focus:border-red-500 focus:outline-none"
                  value={fee}
                  onChange={(e) => setFee(Number(e.target.value))}
                />
              </div>
            </div>
          )}

          {/* STEP 3: Banner Template Selection & Review */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Chọn ảnh Banner giải đấu</label>
                <div className="grid grid-cols-2 gap-3">
                  {bannerTemplates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => setSelectedBanner(template.url)}
                      className={`relative rounded-xl overflow-hidden h-20 border-2 transition text-left cursor-pointer ${
                        selectedBanner === template.url ? "border-red-800 ring-2 ring-red-100" : "border-transparent"
                      }`}
                    >
                      <img
                        src={template.url}
                        alt={template.sport}
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 flex items-end p-1.5">
                        <span className="text-[10px] font-bold text-white uppercase">{template.sport}</span>
                      </div>
                      {selectedBanner === template.url && (
                        <div className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-red-800 flex items-center justify-center text-[10px] text-white font-bold">
                          ✓
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Review Panel */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs">
                <h4 className="font-bold text-slate-800 text-sm mb-2 border-b border-slate-200 pb-1">Xem lại thông tin giải đấu</h4>
                <div className="grid grid-cols-2 gap-y-1 text-slate-600">
                  <p><span className="font-semibold text-slate-800">Tên giải:</span> {title}</p>
                  <p><span className="font-semibold text-slate-800">Bộ môn:</span> {sport}</p>
                  <p><span className="font-semibold text-slate-800">Địa điểm:</span> {location}</p>
                  <p><span className="font-semibold text-slate-800">Cấp độ:</span> {level === "movement" ? "Phong trào" : level === "semi_pro" ? "Bán chuyên" : "Chuyên nghiệp"}</p>
                  <p><span className="font-semibold text-slate-800">Thời gian:</span> {startDate} - {endDate}</p>
                  <p><span className="font-semibold text-slate-800">Lệ phí:</span> {fee === 0 ? "Miễn phí" : formatVnd(fee)}</p>
                  <p className="col-span-2"><span className="font-semibold text-[#b00c14] text-sm font-heading">Giải thưởng: {formatVnd(prizeMoney)}</span></p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50 p-4 shrink-0 flex justify-between">
          <button
            type="button"
            onClick={step === 1 ? onClose : handleBack}
            className="rounded-xl border border-slate-300 bg-white px-4.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
          >
            {step === 1 ? "Hủy" : "Quay lại"}
          </button>
          
          <button
            type="button"
            onClick={step === 3 ? handleSubmit : handleNext}
            className="rounded-xl bg-[#b00c14] hover:bg-red-950 px-4.5 py-2 text-xs font-bold text-white transition shadow-xs cursor-pointer"
          >
            {step === 3 ? "Xác nhận tạo" : "Tiếp theo"}
          </button>
        </div>

      </div>
    </div>
  );
}
