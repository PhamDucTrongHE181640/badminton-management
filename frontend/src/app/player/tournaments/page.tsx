"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import TournamentDetailModal, { Tournament } from "./TournamentDetailModal";
import TournamentRegisterModal from "./TournamentRegisterModal";
import { apiFetch } from "@/lib/http";
import { errorMessage, formatNumber, formatVnd } from "@/lib/format";

type UserProfile = {
  id: string;
  full_name: string;
  email: string;
  roles: string[];
};

type RegistrationInput = {
  teamName: string;
  player1: string;
  player2: string;
  phone: string;
  email: string;
};

type MyTournamentRegistration = {
  id: string;
  tournamentId: string;
  status: "pending" | "registered" | "cancelled";
  teamName: string;
  registrationCode?: string | null;
  fee?: number | null;
  bankQrImageUrl?: string | null;
  bankTransferCaption?: string | null;
  paymentCaption?: string | null;
  createdAt: string;
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

function parseDisplayDate(value: string) {
  const [day, month, year] = value.split("/").map(Number);
  if (!day || !month || !year) return 0;
  return new Date(year, month - 1, day).getTime();
}

function upsertTournament(items: Tournament[], next: Tournament) {
  const exists = items.some((item) => item.id === next.id);
  if (!exists) return [next, ...items];
  return items.map((item) => (item.id === next.id ? next : item));
}

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [myRegistrations, setMyRegistrations] = useState<MyTournamentRegistration[]>([]);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  // Modal control states
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);

  const [sportFilter, setSportFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [timeFilter, setTimeFilter] = useState("all");
  const [levelsFilter, setLevelsFilter] = useState({
    all: true,
    movement: false,
    semi_pro: false,
    pro: false
  });
  const [maxPrize, setMaxPrize] = useState(50000000);
  const [activeTab, setActiveTab] = useState<"all" | "upcoming" | "ongoing" | "completed" | "my">("all");
  const [sortOption, setSortOption] = useState("newest");

  const upcomingCount = useMemo(() => tournaments.filter(t => t.status === "upcoming").length, [tournaments]);
  const completedCount = useMemo(() => tournaments.filter(t => t.status === "completed").length, [tournaments]);
  const totalPrizePool = useMemo(() => tournaments.reduce((acc, t) => acc + t.prizeMoney, 0), [tournaments]);
  const totalJoinedTeams = useMemo(() => tournaments.reduce((acc, t) => acc + t.joinedTeams, 0), [tournaments]);
  const joinedTourneyIds = useMemo(
    () => myRegistrations.map((item) => item.tournamentId),
    [myRegistrations],
  );
  const registrationStatusByTournament = useMemo(() => {
    const result: Record<string, MyTournamentRegistration["status"]> = {};
    myRegistrations.forEach((item) => {
      result[item.tournamentId] = item.status;
    });
    return result;
  }, [myRegistrations]);
  const registrationByTournament = useMemo(() => {
    const result: Record<string, MyTournamentRegistration> = {};
    myRegistrations.forEach((item) => {
      result[item.tournamentId] = item;
    });
    return result;
  }, [myRegistrations]);
  const joinedTournaments = useMemo(
    () => tournaments.filter((item) => joinedTourneyIds.includes(item.id)),
    [joinedTourneyIds, tournaments],
  );

  const sportOptions = useMemo(() => {
    const sports = Array.from(new Set(tournaments.map((item) => item.sport))).sort();
    return ["", ...sports];
  }, [tournaments]);

  const locationOptions = useMemo(() => {
    const locations = Array.from(new Set(tournaments.map((item) => item.location))).sort();
    return ["", ...locations];
  }, [tournaments]);

  const upcomingMatches = useMemo(() => {
    return joinedTournaments
      .flatMap((tournament) =>
        (tournament.bracket ?? []).flatMap((round) =>
          round.matches
            .filter((match) => match.time || match.court)
            .map((match) => ({ tournament, roundName: round.roundName, match })),
        ),
      )
      .slice(0, 2);
  }, [joinedTournaments]);

  const loadTournaments = useCallback(async () => {
    setIsLoading(true);
    setPageError("");
    try {
      const [nextTournaments, nextUser] = await Promise.all([
        apiFetch<Tournament[]>("/api/v1/public/tournaments"),
        apiFetch<UserProfile>("/api/v1/auth/me", { credentials: "include" }).catch(() => null),
      ]);

      let nextRegistrations: MyTournamentRegistration[] = [];
      if (nextUser) {
        nextRegistrations = await apiFetch<MyTournamentRegistration[]>("/api/v1/player/tournaments/registrations/me/details", {
          credentials: "include",
        }).catch(() => []);
      }

      setTournaments(nextTournaments);
      setUser(nextUser);
      setMyRegistrations(nextRegistrations);
    } catch (caught) {
      setPageError(errorMessage(caught, "Không tải được danh sách giải đấu"));
      setTournaments([]);
      setMyRegistrations([]);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTournaments();
  }, [loadTournaments]);

  const handleRegisterSubmit = async (tournamentId: string, teamData: RegistrationInput) => {
    const created = await apiFetch<TournamentRegistrationResult>(
      `/api/v1/player/tournaments/${tournamentId}/registrations`,
      {
        method: "POST",
        credentials: "include",
        body: JSON.stringify(teamData),
      },
    );
    setMyRegistrations(prev => {
      const exists = prev.some((item) => item.tournamentId === tournamentId);
      if (exists) {
        return prev.map((item) =>
          item.tournamentId === tournamentId
            ? {
                ...item,
                id: created.id,
                status: created.status,
                teamName: created.teamName,
                registrationCode: created.registrationCode,
                fee: created.fee,
                bankQrImageUrl: created.bankQrImageUrl,
                bankTransferCaption: created.bankTransferCaption,
                paymentCaption: created.paymentCaption,
                createdAt: created.createdAt,
              }
            : item,
        );
      }
      return [
        {
          id: created.id,
          tournamentId,
          status: created.status,
          teamName: created.teamName,
          registrationCode: created.registrationCode,
          fee: created.fee,
          bankQrImageUrl: created.bankQrImageUrl,
          bankTransferCaption: created.bankTransferCaption,
          paymentCaption: created.paymentCaption,
          createdAt: created.createdAt,
        },
        ...prev,
      ];
    });
    setTournaments(prev => upsertTournament(prev, created.tournament));
    setSelectedTournament(created.tournament);
    return created;
  };

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(prev =>
      prev.includes(id) ? prev.filter(favId => favId !== id) : [...prev, id]
    );
  };

  const handleLevelChange = (key: "all" | "movement" | "semi_pro" | "pro") => {
    if (key === "all") {
      setLevelsFilter({
        all: true,
        movement: false,
        semi_pro: false,
        pro: false
      });
    } else {
      setLevelsFilter(prev => {
        const next = { ...prev, all: false, [key]: !prev[key] };
        if (!next.movement && !next.semi_pro && !next.pro) {
          next.all = true;
        }
        return next;
      });
    }
  };

  const handleClearFilters = () => {
    setSportFilter("");
    setLocationFilter("");
    setTimeFilter("all");
    setLevelsFilter({
      all: true,
      movement: false,
      semi_pro: false,
      pro: false
    });
    setMaxPrize(50000000);
  };

  const filteredTournaments = useMemo(() => {
    let items = tournaments;

    if (sportFilter) {
      items = items.filter(t => t.sport === sportFilter);
    }

    if (locationFilter) {
      items = items.filter(t => t.location === locationFilter);
    }

    if (timeFilter !== "all") {
      const days = timeFilter === "7days" ? 7 : 30;
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const deadline = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      items = items.filter(t => {
        const start = parseDisplayDate(t.startDate);
        return start >= now.getTime() && start <= deadline.getTime();
      });
    }

    if (!levelsFilter.all) {
      items = items.filter(t => {
        if (levelsFilter.movement && t.level === "movement") return true;
        if (levelsFilter.semi_pro && t.level === "semi_pro") return true;
        if (levelsFilter.pro && t.level === "pro") return true;
        return false;
      });
    }

    items = items.filter(t => t.prizeMoney <= maxPrize);

    if (activeTab === "upcoming") {
      items = items.filter(t => t.status === "upcoming");
    } else if (activeTab === "ongoing") {
      items = items.filter(t => t.status === "ongoing");
    } else if (activeTab === "completed") {
      items = items.filter(t => t.status === "completed");
    } else if (activeTab === "my") {
      items = items.filter(t => joinedTourneyIds.includes(t.id));
    }

    return [...items].sort((a, b) => {
      if (sortOption === "newest") {
        return parseDisplayDate(b.startDate) - parseDisplayDate(a.startDate);
      } else if (sortOption === "prize_high") {
        return b.prizeMoney - a.prizeMoney;
      } else if (sortOption === "prize_low") {
        return a.prizeMoney - b.prizeMoney;
      }
      return 0;
    });

  }, [tournaments, sportFilter, locationFilter, levelsFilter, maxPrize, activeTab, sortOption, joinedTourneyIds]);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "upcoming": return "Sắp diễn ra";
      case "ongoing": return "Đang diễn ra";
      case "completed": return "Đã kết thúc";
      default: return "";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "upcoming": return "bg-red-600 text-white";
      case "ongoing": return "bg-orange-500 text-white";
      case "completed": return "bg-slate-500 text-white";
      default: return "bg-slate-200 text-slate-700";
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto px-4 sm:px-6 py-6">
      
      {/* Title & Banner Statistics */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-white p-6 shadow-xs flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-3 z-10">
          <h1 className="font-heading text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Giải đấu
          </h1>
          <p className="text-sm text-slate-500 sm:text-base max-w-xl">
            Tham gia các giải đấu hấp dẫn, thử thách bản thân và khẳng định đẳng cấp.
          </p>
          
          <div className="pt-2 grid grid-cols-2 sm:grid-cols-4 gap-4 sm:min-w-[500px]">
            <div className="rounded-xl bg-slate-50 border border-slate-200/60 p-3 shadow-3xs">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Giải sắp diễn ra</p>
              <p className="mt-1 font-heading text-xl font-extrabold text-slate-900">{upcomingCount}</p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200/60 p-3 shadow-3xs">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Đội đã đăng ký</p>
              <p className="mt-1 font-heading text-xl font-extrabold text-slate-900">{formatNumber(totalJoinedTeams)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200/60 p-3 shadow-3xs col-span-2 sm:col-span-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tổng giải thưởng</p>
              <p className="mt-1 font-heading text-xl font-extrabold text-red-800">{formatVnd(totalPrizePool)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200/60 p-3 shadow-3xs">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Giải đã kết thúc</p>
              <p className="mt-1 font-heading text-xl font-extrabold text-slate-900">{completedCount}</p>
            </div>
          </div>
        </div>

        {/* Banner Badminton graphic in background */}
        <div className="hidden md:block w-72 h-44 shrink-0 relative">
          <img
            src="https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=400&fit=crop&q=80"
            alt="Badminton racket"
            className="w-full h-full object-cover rounded-xl opacity-90 shadow-xs"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-white via-transparent to-transparent" />
        </div>
      </div>

      {/* Main Grid Layout: 3 Columns */}
      <div className="grid gap-6 lg:grid-cols-[240px_1fr_300px]">
        
        {/* LEFT COLUMN: Search Filters */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4.5 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-heading font-bold text-slate-900 text-sm sm:text-base">Bộ lọc tìm kiếm</h3>
              <button
                onClick={handleClearFilters}
                className="text-[11px] font-bold text-red-800 hover:text-red-950 transition cursor-pointer"
              >
                ✕ Xóa bộ lọc
              </button>
            </div>

            {/* Sport Dropdown */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Môn thể thao</label>
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none"
                value={sportFilter}
                onChange={(e) => setSportFilter(e.target.value)}
              >
                {sportOptions.map((item) => (
                  <option key={item || "all"} value={item}>
                    {item || "Tất cả môn"}
                  </option>
                ))}
              </select>
            </div>

            {/* Location Dropdown */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Khu vực</label>
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none"
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
              >
                {locationOptions.map((item) => (
                  <option key={item || "all"} value={item}>
                    {item || "Tất cả khu vực"}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Thời gian</label>
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none"
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
              >
                <option value="all">Tất cả thời gian</option>
                <option value="7days">Trong 7 ngày tới</option>
                <option value="30days">Trong 30 ngày tới</option>
              </select>
            </div>

            {/* Level Checkboxes */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Cấp độ</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs text-slate-700 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={levelsFilter.all}
                    onChange={() => handleLevelChange("all")}
                    className="rounded text-red-800 focus:ring-red-500 h-4 w-4"
                  />
                  Tất cả cấp độ
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={levelsFilter.movement}
                    onChange={() => handleLevelChange("movement")}
                    className="rounded text-red-800 focus:ring-red-500 h-4 w-4"
                  />
                  Phong trào
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={levelsFilter.semi_pro}
                    onChange={() => handleLevelChange("semi_pro")}
                    className="rounded text-red-800 focus:ring-red-500 h-4 w-4"
                  />
                  Bán chuyên
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={levelsFilter.pro}
                    onChange={() => handleLevelChange("pro")}
                    className="rounded text-red-800 focus:ring-red-500 h-4 w-4"
                  />
                  Chuyên nghiệp
                </label>
              </div>
            </div>

            {/* Prize slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-bold text-slate-700 uppercase tracking-wider">
                <span>Giải thưởng max</span>
                <span className="text-red-800 font-extrabold">{formatVnd(maxPrize)}</span>
              </div>
              <input
                type="range"
                min={5000000}
                max={50000000}
                step={5000000}
                value={maxPrize}
                onChange={(e) => setMaxPrize(Number(e.target.value))}
                className="w-full accent-red-800 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                <span>5M</span>
                <span>50M</span>
              </div>
            </div>

            <button
              onClick={() => void loadTournaments()}
              className="w-full bg-[#b00c14] hover:bg-red-950 text-white font-bold text-xs py-2.5 rounded-xl transition shadow-xs cursor-pointer text-center"
            >
              {isLoading ? "Đang tải..." : `Tìm kiếm (${filteredTournaments.length})`}
            </button>
          </div>
        </aside>

        {/* MIDDLE COLUMN: List of tournaments */}
        <main className="space-y-4">
          
          {/* Header navigation tabs & Sorting */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2">
            <div className="flex flex-wrap gap-1">
              {[
                { key: "all", label: "Tất cả giải đấu" },
                { key: "upcoming", label: "Sắp diễn ra" },
                { key: "ongoing", label: "Đang diễn ra" },
                { key: "completed", label: "Đã kết thúc" },
                { key: "my", label: "Giải của tôi" }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`px-3 py-1.5 text-xs font-bold transition rounded-lg cursor-pointer ${
                    activeTab === tab.key
                      ? "bg-red-50 text-red-800"
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Sorting Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-450 font-semibold">Sắp xếp:</span>
              <select
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 focus:outline-none"
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
              >
                <option value="newest">Mới nhất</option>
                <option value="prize_high">Giải thưởng lớn nhất</option>
                <option value="prize_low">Giải thưởng nhỏ nhất</option>
              </select>
            </div>
          </div>

          {pageError && (
            <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-800">
              {pageError}
            </div>
          )}

          {isLoading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-3xs">
              <p className="text-base font-semibold">Đang tải giải đấu từ backend...</p>
            </div>
          ) : filteredTournaments.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-3xs">
              <p className="text-base font-semibold">Chưa tìm thấy giải đấu phù hợp</p>
              <p className="text-xs text-slate-400 mt-1">Vui lòng điều chỉnh lại bộ lọc hoặc thay đổi tab trạng thái.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredTournaments.map((tourney) => {
                const isJoined = joinedTourneyIds.includes(tourney.id);
                const registrationStatus = registrationStatusByTournament[tourney.id];
                return (
                  <article
                    key={tourney.id}
                    onClick={() => { setSelectedTournament(tourney); setIsDetailOpen(true); }}
                    className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-3xs hover:shadow-md transition duration-200 cursor-pointer flex flex-col justify-between"
                  >
                    {/* Banner Image & Icons overlay */}
                    <div className="relative h-36 w-full rounded-xl overflow-hidden bg-slate-100 shrink-0">
                      <img
                        src={tourney.image}
                        alt={tourney.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      
                      {/* Top left status badge */}
                      <div className={`absolute top-3.5 left-3.5 rounded-lg px-2 py-0.5 text-[10px] font-bold shadow-xs ${getStatusColor(tourney.status)}`}>
                        {getStatusLabel(tourney.status)}
                      </div>

                      {/* Top right favorite button */}
                      <button
                        onClick={(e) => toggleFavorite(tourney.id, e)}
                        className={`absolute top-3 right-3 flex h-7.5 w-7.5 items-center justify-center rounded-xl bg-white/95 shadow-xs transition hover:bg-rose-50 ${
                          favorites.includes(tourney.id) ? "text-rose-600" : "text-slate-400"
                        }`}
                      >
                        ♥
                      </button>
                    </div>

                    {/* Content */}
                    <div className="pt-3 pb-2 space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-heading text-sm font-bold text-slate-900 group-hover:text-red-800 transition line-clamp-1 leading-tight flex-1">
                          {tourney.title}
                        </h3>
                        <span className="shrink-0 bg-slate-100 rounded-md px-2 py-0.5 text-[9px] font-semibold text-slate-600">
                          {tourney.sport}
                        </span>
                      </div>

                      {/* Details */}
                      <div className="space-y-1.5 text-[11px] text-slate-500 font-semibold">
                        <p className="flex items-center gap-2">
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                          </svg>
                          <span>{tourney.startDate} - {tourney.endDate}</span>
                        </p>
                        <p className="flex items-center gap-2">
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                          <span className="truncate">{tourney.location}</span>
                        </p>
                        <p className="flex items-center gap-2">
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                          </svg>
                          <span>{tourney.joinedTeams} / {tourney.maxTeams} đội đã tham gia</span>
                        </p>
                      </div>
                    </div>

                    {/* Bottom Prize and details button */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Tổng giải thưởng</p>
                        <p className="font-heading font-black text-red-850 text-sm mt-0.5">
                          {formatVnd(tourney.prizeMoney)}
                        </p>
                      </div>
                      
                      <div className="flex gap-2">
                        {isJoined && tourney.status === "upcoming" && (
                          <span className={`rounded-lg px-2.5 py-1.5 text-[10px] font-bold border ${
                            registrationStatus === "pending"
                              ? "bg-amber-50 text-amber-700 border-amber-100"
                              : "bg-emerald-50 text-emerald-700 border-emerald-100"
                          }`}>
                            {registrationStatus === "pending" ? "Chờ duyệt" : "✓ Đã đăng ký"}
                          </span>
                        )}
                        <span className="rounded-lg border border-red-800/80 bg-white px-2.5 py-1.5 text-[10px] font-bold text-[#b00c14] hover:bg-red-50 transition">
                          Xem chi tiết
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {filteredTournaments.length > 0 && (
            <div className="pt-4 flex justify-center">
              <button
                onClick={() => void loadTournaments()}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4.5 py-2 text-xs font-bold text-slate-650 transition cursor-pointer"
              >
                Tải lại từ backend
              </button>
            </div>
          )}
        </main>

        {/* RIGHT COLUMN: Sidebar (Joined Tourneys & Upcoming Match) */}
        <aside className="space-y-6">
          
          {/* Section: Giải đấu của tôi */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="font-heading font-bold text-slate-900 text-sm sm:text-base">Giải đấu của tôi</h3>
              <button
                onClick={() => setActiveTab("my")}
                className="text-[10px] font-bold text-[#b00c14] hover:underline"
              >
                Xem tất cả
              </button>
            </div>

            <div className="space-y-3">
              {joinedTournaments.length === 0 ? (
                <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-3 text-xs font-semibold text-slate-500">
                  {user ? "Bạn chưa đăng ký giải đấu nào." : "Đăng nhập để xem các giải đấu đã đăng ký."}
                </div>
              ) : (
                joinedTournaments.slice(0, 3).map((tournament) => {
                  const registrationStatus = registrationStatusByTournament[tournament.id];
                  const registration = registrationByTournament[tournament.id];
                  return (
                    <button
                      key={tournament.id}
                      type="button"
                      onClick={() => { setSelectedTournament(tournament); setIsDetailOpen(true); }}
                      className="flex w-full items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/40 p-2.5 text-left transition hover:bg-slate-50"
                    >
                      <div className="h-8.5 w-8.5 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                          <path d="M4 22h16" />
                          <path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34" />
                          <path d="M12 2a5 5 0 0 0-5 5v5a5 5 0 0 0 10 0V7a5 5 0 0 0-5-5z" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 text-xs truncate">{tournament.title}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {tournament.sport} · {tournament.startDate} - {tournament.endDate}
                        </p>
                        <span className={`inline-block rounded-full border px-2 py-0.5 text-[9px] font-bold mt-1.5 ${
                          registrationStatus === "pending"
                            ? "bg-amber-50 border-amber-100 text-amber-700"
                            : "bg-slate-100 border-slate-200 text-slate-600"
                        }`}>
                          {registrationStatus === "pending" ? "Chờ duyệt thanh toán" : getStatusLabel(tournament.status)}
                        </span>
                        {registrationStatus === "pending" && registration?.registrationCode ? (
                          <p className="mt-1 text-[10px] font-mono font-bold text-slate-600">
                            {registration.registrationCode}
                          </p>
                        ) : null}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Section: Trận đấu sắp tới */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="font-heading font-bold text-slate-900 text-sm sm:text-base">Trận đấu sắp tới</h3>
              <button type="button" onClick={() => setActiveTab("my")} className="text-[10px] font-bold text-[#b00c14] hover:underline">Xem lịch thi đấu</button>
            </div>

            <div className="space-y-4">
              {upcomingMatches.length === 0 ? (
                <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-3 text-xs font-semibold text-slate-500">
                  Chưa có lịch đấu trong các giải bạn đã đăng ký.
                </div>
              ) : (
                upcomingMatches.map(({ tournament, roundName, match }) => (
                  <div key={`${tournament.id}-${match.id}`} className="rounded-xl border border-slate-100 p-3 bg-slate-50/20 text-xs space-y-2">
                    <div className="flex justify-between items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      <span className="truncate">{roundName}</span>
                      {match.time && <span className="text-slate-800 font-black">{match.time}</span>}
                    </div>
                    <div className="flex items-center justify-around gap-2 text-center py-1">
                      <p className="font-bold text-slate-900 truncate max-w-[90px]">{match.teamA}</p>
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 rounded-full px-1.5 py-0.5">VS</span>
                      <p className="font-bold text-slate-950 truncate max-w-[90px]">{match.teamB}</p>
                    </div>
                    <p className="text-[10px] text-slate-500 text-center font-medium flex items-center justify-center gap-1">
                      <svg viewBox="0 0 24 24" className="h-3 w-3 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      {[match.court, tournament.location].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Section: Admin tournament notice */}
          <div className="rounded-2xl border border-[#b00c14]/10 bg-gradient-to-br from-[#b00c14]/5 to-[#b00c14]/20 p-5 shadow-2xs relative overflow-hidden flex flex-col justify-center gap-4 min-h-48">
            <div className="z-10 space-y-1.5 max-w-[190px]">
              <h3 className="font-heading font-black text-slate-900 text-sm sm:text-base leading-tight">
                Đăng giải đấu qua admin
              </h3>
              <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                Người chơi gửi đơn tham gia tại đây. Admin sẽ tạo giải và duyệt thanh toán thủ công.
              </p>
            </div>

            {/* Cup image overlay at bottom-right */}
            <div className="absolute bottom-4 right-2 w-28 h-28 opacity-90 select-none pointer-events-none">
              <img
                src="/courts/anhNenTaoGiai.png"
                alt="Gold Cup"
                className="w-full h-full object-contain"
              />
            </div>

            <span className="z-10 w-fit rounded-xl border border-[#b00c14]/20 bg-white px-4.5 py-2.5 text-center text-xs font-bold text-[#b00c14] shadow-xs">
              Chờ duyệt sau đăng ký
            </span>
          </div>

        </aside>

      </div>

      {/* RENDER TOURNAMENT DETAIL MODAL */}
      {isDetailOpen && selectedTournament && (
        <TournamentDetailModal
          tournament={selectedTournament}
          isJoined={joinedTourneyIds.includes(selectedTournament.id)}
          registrationStatus={registrationStatusByTournament[selectedTournament.id] ?? null}
          onClose={() => { setIsDetailOpen(false); setSelectedTournament(null); }}
          onRegister={(t) => { setIsDetailOpen(false); setIsRegisterOpen(true); }}
        />
      )}

      {/* RENDER TOURNAMENT REGISTER FORM MODAL */}
      {isRegisterOpen && selectedTournament && (
        <TournamentRegisterModal
          tournament={selectedTournament}
          onClose={() => { setIsRegisterOpen(false); setIsDetailOpen(true); }}
          onSubmit={handleRegisterSubmit}
          currentUserName={user?.full_name ?? ""}
          currentUserEmail={user?.email ?? ""}
        />
      )}

    </div>
  );
}
