"use client";

import React, { useState, useMemo, useEffect } from "react";
import TournamentDetailModal, { Tournament } from "./TournamentDetailModal";
import TournamentRegisterModal from "./TournamentRegisterModal";
import TournamentCreateModal from "./TournamentCreateModal";
import { formatVnd } from "@/lib/format";

// Initial mockup data matching the screenshot exactly
const initialTournaments: Tournament[] = [
  {
    id: "tourney-1",
    title: "NetUP Hòa Lạc Open 2024",
    sport: "Cầu lông",
    status: "upcoming",
    startDate: "25/05/2024",
    endDate: "02/06/2024",
    location: "Nhà thi đấu ĐH FPT Hòa Lạc",
    joinedTeams: 12,
    maxTeams: 16,
    prizeMoney: 20000000,
    image: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=600&fit=crop&q=80",
    level: "movement",
    fee: 150000,
    description: "Giải đấu cầu lông phong trào lớn nhất năm dành cho sinh viên và cư dân công nghệ khu vực Hòa Lạc. Cơ hội để cọ xát nâng cao trình độ ELO và giao lưu kết nối.",
    bracket: [
      {
        roundName: "Bán kết",
        matches: [
          { id: "m-1", teamA: "Minh Tuấn & Hoàng Đức", scoreA: 21, teamB: "Quang Huy & Đức Anh", scoreB: 15, time: "16/05 - 19:00", court: "Sân 3", winner: "A" },
          { id: "m-2", teamA: "Quốc Anh & Tiến Đạt", scoreA: 18, teamB: "Thành Long & Sơn Hải", scoreB: 21, time: "16/05 - 20:00", court: "Sân 4", winner: "B" }
        ]
      },
      {
        roundName: "Chung kết",
        matches: [
          { id: "m-3", teamA: "Minh Tuấn & Hoàng Đức", teamB: "Thành Long & Sơn Hải", time: "18/05 - 16:00", court: "Sân 1" }
        ]
      }
    ]
  },
  {
    id: "tourney-2",
    title: "Hòa Lạc Badminton Cup",
    sport: "Cầu lông",
    status: "ongoing",
    startDate: "10/05/2024",
    endDate: "19/05/2024",
    location: "Trung tâm TDTT Hòa Lạc",
    joinedTeams: 16,
    maxTeams: 16,
    prizeMoney: 15000000,
    image: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=600&fit=crop&q=80",
    level: "movement",
    fee: 200000,
    description: "Giải đấu quy tụ những vợt thủ phong trào xuất sắc nhất Thạch Thất. Giải đấu đang diễn ra vô cùng kịch tính ở các vòng bảng loại trực tiếp.",
    bracket: [
      {
        roundName: "Tứ kết",
        matches: [
          { id: "tk-1", teamA: "Minh Tuấn & Hoàng Đức", scoreA: 2, teamB: "Duy Khánh & Anh Tú", scoreB: 1, winner: "A" },
          { id: "tk-2", teamA: "Bảo Lâm & Trường Giang", scoreA: 0, teamB: "Tiến Dũng & Văn Nam", scoreB: 2, winner: "B" }
        ]
      },
      {
        roundName: "Bán kết",
        matches: [
          { id: "bk-1", teamA: "Minh Tuấn & Hoàng Đức", teamB: "Tiến Dũng & Văn Nam", time: "16/05 - 15:00", court: "Sân 1" }
        ]
      }
    ]
  },
  {
    id: "tourney-3",
    title: "Spring Challenge 2024",
    sport: "Cầu lông",
    status: "completed",
    startDate: "01/04/2024",
    endDate: "07/04/2024",
    location: "Nhà thi đấu Hòa Lạc",
    joinedTeams: 32,
    maxTeams: 32,
    prizeMoney: 10000000,
    image: "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=600&fit=crop&q=80",
    level: "movement",
    fee: 100000,
    description: "Giải đấu chào xuân đầy kịch tính với hơn 32 đội tham gia tranh tài. Giải đấu đã kết thúc thành công tốt đẹp.",
    bracket: [
      {
        roundName: "Chung kết",
        matches: [
          { id: "ck-1", teamA: "Gia Huy & Minh Nhượng", scoreA: 21, teamB: "Minh Tuấn & Hoàng Đức", scoreB: 19, winner: "A" }
        ]
      }
    ]
  },
  {
    id: "tourney-4",
    title: "Hòa Lạc Double League",
    sport: "Cầu lông",
    status: "upcoming",
    startDate: "05/06/2024",
    endDate: "15/06/2024",
    location: "Nhà thi đấu ĐH FPT Hòa Lạc",
    joinedTeams: 8,
    maxTeams: 16,
    prizeMoney: 8000000,
    image: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=600&fit=crop&q=80",
    level: "semi_pro",
    fee: 250000,
    description: "Giải đấu đôi nam/đôi nam nữ nâng cao dành cho các tuyển thủ trình độ Bán chuyên. Quy tụ nhiều tay vợt ELO cao trong khu vực Hà Nội.",
    bracket: []
  },
  {
    id: "tourney-5",
    title: "NetUP Amateur Series",
    sport: "Cầu lông",
    status: "upcoming",
    startDate: "18/06/2024",
    endDate: "23/06/2024",
    location: "Trung tâm TDTT Hòa Lạc",
    joinedTeams: 4,
    maxTeams: 16,
    prizeMoney: 12000000,
    image: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=600&fit=crop&q=80",
    level: "movement",
    fee: 120000,
    description: "Chuỗi giải đấu phong trào NetUP dành riêng cho người mới chơi hoặc trình độ trung bình yếu nhằm tạo sân chơi rèn luyện sức khỏe.",
    bracket: []
  },
  {
    id: "tourney-6",
    title: "New Year Championship 2024",
    sport: "Cầu lông",
    status: "completed",
    startDate: "05/01/2024",
    endDate: "14/01/2024",
    location: "Nhà thi đấu Hòa Lạc",
    joinedTeams: 16,
    maxTeams: 16,
    prizeMoney: 18000000,
    image: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=600&fit=crop&q=80",
    level: "pro",
    fee: 300000,
    description: "Giải đấu chuyên nghiệp đỉnh cao mở màn năm 2024 với sự góp mặt của các tay vợt đẳng cấp ELO từ 1600+.",
    bracket: [
      {
        roundName: "Chung kết",
        matches: [
          { id: "ck-new-1", teamA: "Tuấn Đức & Hồng Nam", scoreA: 21, teamB: "Quang Huy & Quốc Khánh", scoreB: 17, winner: "A" }
        ]
      }
    ]
  }
];

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>(initialTournaments);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [joinedTourneyIds, setJoinedTourneyIds] = useState<string[]>(["tourney-1", "tourney-2", "tourney-3"]); // Mock default joined

  // Modal control states
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Filters state
  const [sportFilter, setSportFilter] = useState("Cầu lông");
  const [locationFilter, setLocationFilter] = useState("Hòa Lạc, Hà Nội");
  const [timeFilter, setTimeFilter] = useState("all"); // all, 7days, 30days
  const [levelsFilter, setLevelsFilter] = useState({
    all: true,
    movement: false,
    semi_pro: false,
    pro: false
  });
  const [maxPrize, setMaxPrize] = useState(50000000);
  const [activeTab, setActiveTab] = useState<"all" | "upcoming" | "ongoing" | "completed" | "my">("all");
  const [sortOption, setSortOption] = useState("newest");

  // Counter calculations for headers card
  const upcomingCount = useMemo(() => tournaments.filter(t => t.status === "upcoming").length, [tournaments]);
  const completedCount = useMemo(() => tournaments.filter(t => t.status === "completed").length, [tournaments]);
  const totalPrizePool = useMemo(() => tournaments.reduce((acc, t) => acc + t.prizeMoney, 0), [tournaments]);

  // Handle Join Tournament Submit
  const handleRegisterSubmit = (
    tournamentId: string,
    teamData: { teamName: string; player1: string; player2: string; phone: string; email: string }
  ) => {
    // Thêm vào danh sách ID đã tham gia
    setJoinedTourneyIds(prev => [...prev, tournamentId]);
    
    // Tăng số đội tham gia của giải đấu lên 1
    setTournaments(prev =>
      prev.map(t => (t.id === tournamentId ? { ...t, joinedTeams: Math.min(t.maxTeams, t.joinedTeams + 1) } : t))
    );

    setIsRegisterOpen(false);
    
    // Mở lại detail với trạng thái đã cập nhật
    const updated = tournaments.find(t => t.id === tournamentId);
    if (updated) {
      setSelectedTournament({ ...updated, joinedTeams: Math.min(updated.maxTeams, updated.joinedTeams + 1) });
    }
  };

  // Handle Create Tournament Submit
  const handleCreateSubmit = (newTournament: Tournament) => {
    setTournaments(prev => [newTournament, ...prev]);
    setIsCreateOpen(false);
  };

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(prev =>
      prev.includes(id) ? prev.filter(favId => favId !== id) : [...prev, id]
    );
  };

  // Level filter checkbox change handler
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
        // If all are false, check "all" back
        if (!next.movement && !next.semi_pro && !next.pro) {
          next.all = true;
        }
        return next;
      });
    }
  };

  // Clear filters
  const handleClearFilters = () => {
    setSportFilter("Cầu lông");
    setLocationFilter("Hòa Lạc, Hà Nội");
    setTimeFilter("all");
    setLevelsFilter({
      all: true,
      movement: false,
      semi_pro: false,
      pro: false
    });
    setMaxPrize(50000000);
  };

  // Filtered tournaments computed value
  const filteredTournaments = useMemo(() => {
    let items = tournaments;

    // Filter by sport
    if (sportFilter) {
      items = items.filter(t => t.sport === sportFilter);
    }

    // Filter by location
    if (locationFilter) {
      const city = locationFilter.split(",")[0].trim().toLowerCase();
      items = items.filter(t => t.location.toLowerCase().includes(city));
    }

    // Filter by levels
    if (!levelsFilter.all) {
      items = items.filter(t => {
        if (levelsFilter.movement && t.level === "movement") return true;
        if (levelsFilter.semi_pro && t.level === "semi_pro") return true;
        if (levelsFilter.pro && t.level === "pro") return true;
        return false;
      });
    }

    // Filter by prize money
    items = items.filter(t => t.prizeMoney <= maxPrize);

    // Filter by tabs
    if (activeTab === "upcoming") {
      items = items.filter(t => t.status === "upcoming");
    } else if (activeTab === "ongoing") {
      items = items.filter(t => t.status === "ongoing");
    } else if (activeTab === "completed") {
      items = items.filter(t => t.status === "completed");
    } else if (activeTab === "my") {
      items = items.filter(t => joinedTourneyIds.includes(t.id));
    }

    // Sorting
    return [...items].sort((a, b) => {
      if (sortOption === "newest") {
        return b.id.localeCompare(a.id); // custom id prefix based sort
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
          
          {/* Mock stats numbers */}
          <div className="pt-2 grid grid-cols-2 sm:grid-cols-4 gap-4 sm:min-w-[500px]">
            <div className="rounded-xl bg-slate-50 border border-slate-200/60 p-3 shadow-3xs">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Giải sắp diễn ra</p>
              <p className="mt-1 font-heading text-xl font-extrabold text-slate-900">{upcomingCount}</p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200/60 p-3 shadow-3xs">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Người tham gia</p>
              <p className="mt-1 font-heading text-xl font-extrabold text-slate-900">1.240+</p>
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
                <option value="Cầu lông">Cầu lông</option>
                <option value="Tennis">Tennis</option>
                <option value="Pickleball">Pickleball</option>
                <option value="Bóng đá">Bóng đá</option>
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
                <option value="Hòa Lạc, Hà Nội">Hòa Lạc, Hà Nội</option>
                <option value="Cầu Giấy, Hà Nội">Cầu Giấy, Hà Nội</option>
                <option value="Mỹ Đình, Hà Nội">Mỹ Đình, Hà Nội</option>
                <option value="Thanh Xuân, Hà Nội">Thanh Xuân, Hà Nội</option>
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
              onClick={() => {}}
              className="w-full bg-[#b00c14] hover:bg-red-950 text-white font-bold text-xs py-2.5 rounded-xl transition shadow-xs cursor-pointer text-center"
            >
              🔍 Tìm kiếm ({filteredTournaments.length})
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

          {/* Grid of tournament cards */}
          {filteredTournaments.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-3xs">
              <p className="text-base font-semibold">Chưa tìm thấy giải đấu phù hợp</p>
              <p className="text-xs text-slate-400 mt-1">Vui lòng điều chỉnh lại bộ lọc hoặc thay đổi tab trạng thái.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredTournaments.map((tourney) => {
                const isJoined = joinedTourneyIds.includes(tourney.id);
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
                          <span className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[10px] font-bold text-emerald-700 border border-emerald-100">
                            ✓ Đã đăng ký
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

          {/* Load more */}
          {filteredTournaments.length > 0 && (
            <div className="pt-4 flex justify-center">
              <button className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4.5 py-2 text-xs font-bold text-slate-650 transition cursor-pointer">
                Xem thêm giải đấu
                <span>↓</span>
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
              {/* Cup 1 - NetUP Hòa Lạc Open 2024 */}
              <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/40 p-2.5 hover:bg-slate-50 transition cursor-pointer">
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
                  <p className="font-bold text-slate-900 text-xs truncate">NetUP Hòa Lạc Open 2024</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Đôi nam · Đăng ký 18/05/2024</p>
                  <span className="inline-block rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[9px] font-bold text-slate-600 mt-1.5">
                    Sắp diễn ra
                  </span>
                </div>
              </div>

              {/* Cup 2 - Hòa Lạc Badminton Cup */}
              <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/40 p-2.5 hover:bg-slate-50 transition cursor-pointer">
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
                  <p className="font-bold text-slate-900 text-xs truncate">Hòa Lạc Badminton Cup</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Đôi nam · Vòng bảng - 16/05/2024</p>
                  <span className="inline-block rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[9px] font-bold text-slate-600 mt-1.5">
                    Đang diễn ra
                  </span>
                </div>
              </div>

              {/* Cup 3 - Spring Challenge 2024 */}
              <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/40 p-2.5 hover:bg-slate-50 transition cursor-pointer">
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
                  <p className="font-bold text-slate-900 text-xs truncate">Spring Challenge 2024</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Đôi nam · Kết quả: Top 8</p>
                  <span className="inline-block rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[9px] font-bold text-slate-600 mt-1.5">
                    Đã kết thúc
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Trận đấu sắp tới */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="font-heading font-bold text-slate-900 text-sm sm:text-base">Trận đấu sắp tới</h3>
              <a href="#" className="text-[10px] font-bold text-[#b00c14] hover:underline">Xem lịch thi đấu</a>
            </div>

            <div className="space-y-4">
              {/* Trận 1 */}
              <div className="rounded-xl border border-slate-100 p-3 bg-slate-50/20 text-xs space-y-2">
                <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  <span>Vòng bảng - Bảng A</span>
                  <span className="text-slate-800 font-black">16/05 - 19:00</span>
                </div>
                
                {/* Match Team A vs Team B */}
                <div className="flex items-center justify-around gap-2 text-center py-1">
                  <div>
                    <p className="font-bold text-slate-900 truncate max-w-[80px]">Minh Tuấn</p>
                    <p className="text-[9px] text-slate-400">Hoàng Đức</p>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 rounded-full px-1.5 py-0.5">VS</span>
                  <div>
                    <p className="font-bold text-slate-950 truncate max-w-[80px]">Quang Huy</p>
                    <p className="text-[9px] text-slate-400">Đức Anh</p>
                  </div>
                </div>

                <p className="text-[10px] text-slate-500 text-center font-medium flex items-center justify-center gap-1">
                  <svg viewBox="0 0 24 24" className="h-3 w-3 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  Sân 3 · Nhà thi đấu Hòa Lạc
                </p>
              </div>

              {/* Trận 2 */}
              <div className="rounded-xl border border-slate-100 p-3 bg-slate-50/20 text-xs space-y-2">
                <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  <span>Tứ kết</span>
                  <span className="text-slate-800 font-black">18/05 - 15:00</span>
                </div>
                
                {/* Match Team A vs Team B */}
                <div className="flex items-center justify-around gap-2 text-center py-1">
                  <div>
                    <p className="font-bold text-slate-900 truncate max-w-[80px]">Minh Tuấn</p>
                    <p className="text-[9px] text-slate-400">Hoàng Đức</p>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 rounded-full px-1.5 py-0.5">VS</span>
                  <div>
                    <p className="font-bold text-slate-500 truncate max-w-[80px]">TBD</p>
                    <p className="text-[9px] text-slate-400">TBD</p>
                  </div>
                </div>

                <p className="text-[10px] text-slate-500 text-center font-medium flex items-center justify-center gap-1">
                  <svg viewBox="0 0 24 24" className="h-3 w-3 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  Sân 1 · Nhà thi đấu Hòa Lạc
                </p>
              </div>
            </div>
          </div>

          {/* Section: Banner Tạo giải đấu riêng */}
          <div className="rounded-2xl border border-[#b00c14]/10 bg-gradient-to-br from-[#b00c14]/5 to-[#b00c14]/20 p-5 shadow-2xs relative overflow-hidden flex flex-col justify-center gap-4 h-48">
            <div className="z-10 space-y-1.5 max-w-[160px]">
              <h3 className="font-heading font-black text-slate-900 text-sm sm:text-base leading-tight">
                Tạo giải đấu của riêng bạn
              </h3>
              <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                Dễ dàng tạo và quản lý giải đấu theo ý muốn của bạn.
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

            <button
              onClick={() => setIsCreateOpen(true)}
              className="z-10 w-fit bg-[#b00c14] hover:bg-red-950 text-white font-bold text-xs px-4.5 py-2.5 rounded-xl transition shadow-xs cursor-pointer text-center"
            >
              Tạo giải đấu ngay
            </button>
          </div>

        </aside>

      </div>

      {/* RENDER TOURNAMENT DETAIL MODAL */}
      {isDetailOpen && selectedTournament && (
        <TournamentDetailModal
          tournament={selectedTournament}
          isJoined={joinedTourneyIds.includes(selectedTournament.id)}
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
        />
      )}

      {/* RENDER TOURNAMENT CREATE WIZARD MODAL */}
      {isCreateOpen && (
        <TournamentCreateModal
          onClose={() => setIsCreateOpen(false)}
          onCreate={handleCreateSubmit}
        />
      )}

    </div>
  );
}
