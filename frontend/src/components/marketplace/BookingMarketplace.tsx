"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

import { Badge, Button, ButtonLink, Card, EmptyState, Field, Notice, inputClassName } from "@/components/ui";
import { API_BASE_URL, apiFetch } from "@/lib/http";
import {
  courtImageForSport,
  errorMessage,
  formatTimeRange,
  formatVnd,
  postTypeLabel,
  recommendationLabel,
  sportLabel,
} from "@/lib/format";

type Variant = "player" | "owner";
type SportFilter = "" | "Badminton" | "Football" | "Tennis";
type PostTypeFilter = "" | "pool" | "rental";
type DiscoveryTab = "map" | "booked" | "favorites";

type UserProfile = {
  id: string;
  full_name: string;
  email: string;
  roles: string[];
};

type SkillTierSummary = {
  visible_skill_tier: string;
  has_assessment: boolean;
};

type Session = {
  id: string;
  title: string;
  post_type: string;
  status: string;
  starts_at: string;
  duration_minutes: number;
  ends_at: string;
  open_slots: number;
  max_slots: number;
  required_skill_min: string;
  required_skill_max: string;
  slot_price_vnd: number;
  full_court_price_vnd: number;
  is_peak_hour: boolean;
  allows_solo_join: boolean;
  court_name: string;
  sub_court_name: string;
  sport: string;
  amenities: string[];
  complex_name: string;
  district: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  pool_post_id?: string | null;
  player_skill_tier?: string | null;
  recommendation_score?: number | null;
  recommendation_label?: string | null;
  distance_bucket?: string | null;
  slot_fit_score?: number | null;
};

// Mock matchmaking data matching the mockup screenshot
const matchmakingSessionsData = [
  {
    id: "match-1",
    index: 1,
    courtName: "Sân 1",
    complexName: "CNC Sports Complex",
    address: "Khu CNC Hòa Lạc, Thạch Thất, Hà Nội",
    distance: "2.1 km",
    sport: "Pickleball",
    time: "19:00 - 21:00",
    slotsJoined: 6,
    slotsMax: 8,
    price: 120000,
    isMostSuitable: true,
    levelStatus: "suitable",
    levelText: "Trình độ phù hợp với bạn",
    players: [
      { name: "Minh Tuấn", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&fit=crop&auto=format&q=80" },
      { name: "Khánh Duy", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&fit=crop&auto=format&q=80" },
      { name: "An Nhiên", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&fit=crop&auto=format&q=80" },
    ],
    joinedCountText: "+3 người đã tham gia",
    hasParking: true,
    district: "Thạch Thất",
  },
  {
    id: "match-2",
    index: 2,
    courtName: "Sân 2",
    complexName: "Hòa Lạc Pickleball Club",
    address: "Khu CNC Hòa Lạc, Thạch Thất, Hà Nội",
    distance: "1.8 km",
    sport: "Pickleball",
    time: "18:00 - 20:00",
    slotsJoined: 7,
    slotsMax: 8,
    price: 100000,
    isMostSuitable: false,
    levelStatus: "suitable",
    levelText: "Trình độ phù hợp với bạn",
    players: [
      { name: "Hải Đăng", avatar: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=80&fit=crop&auto=format&q=80" },
      { name: "Bảo Phong", avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=80&fit=crop&auto=format&q=80" },
      { name: "Thảo Chi", avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=80&fit=crop&auto=format&q=80" },
      { name: "Vân Hải", avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=80&fit=crop&auto=format&q=80" },
    ],
    joinedCountText: "+4 người đã tham gia",
    hasParking: true,
    district: "Thạch Thất",
  },
  {
    id: "match-3",
    index: 3,
    courtName: "Sân 3",
    complexName: "Green Park Pickleball",
    address: "Khu CNC Hòa Lạc, Thạch Thất, Hà Nội",
    distance: "2.6 km",
    sport: "Pickleball",
    time: "20:00 - 22:00",
    slotsJoined: 8,
    slotsMax: 8,
    price: 90000,
    isMostSuitable: false,
    levelStatus: "warning",
    levelText: "Bạn có thể chọn sân khác",
    players: [
      { name: "Quốc Khánh", avatar: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=80&fit=crop&auto=format&q=80" },
      { name: "Thanh Nam", avatar: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=80&fit=crop&auto=format&q=80" },
      { name: "Lan My", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&fit=crop&auto=format&q=80" },
    ],
    joinedCountText: "+7 người đã tham gia",
    hasParking: true,
    district: "Thạch Thất",
  },
  {
    id: "match-4",
    index: 4,
    courtName: "Sân 1",
    complexName: "Cầu Giấy Badminton Arena",
    address: "Đường Nguyễn Phong Sắc, Dịch Vọng, Cầu Giấy, Hà Nội",
    distance: "1.2 km",
    sport: "Badminton",
    time: "17:00 - 19:00",
    slotsJoined: 3,
    slotsMax: 4,
    price: 80000,
    isMostSuitable: true,
    levelStatus: "suitable",
    levelText: "Trình độ phù hợp với bạn",
    players: [
      { name: "Hoàng Phong", avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=80&fit=crop&auto=format&q=80" },
      { name: "Quỳnh Dao", avatar: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=80&fit=crop&auto=format&q=80" },
    ],
    joinedCountText: "+2 người đã tham gia",
    hasParking: true,
    district: "Cầu Giấy",
  },
  {
    id: "match-5",
    index: 5,
    courtName: "Sân 3",
    complexName: "Mỹ Đình Tennis Center",
    address: "Đường Lê Đức Thọ, Mỹ Đình, Nam Từ Liêm, Hà Nội",
    distance: "3.5 km",
    sport: "Tennis",
    time: "19:00 - 21:00",
    slotsJoined: 2,
    slotsMax: 4,
    price: 250000,
    isMostSuitable: false,
    levelStatus: "suitable",
    levelText: "Trình độ phù hợp với bạn",
    players: [
      { name: "Thanh Xuân", avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=80&fit=crop&auto=format&q=80" },
    ],
    joinedCountText: "+1 người đã tham gia",
    hasParking: true,
    district: "Nam Từ Liêm",
  },
];

const sportOptions: Array<{ value: SportFilter; label: string }> = [
  { value: "", label: "Tất cả môn" },
  { value: "Badminton", label: "Cầu lông" },
  { value: "Football", label: "Bóng đá" },
  { value: "Tennis", label: "Tennis" },
];

const postTypeOptions: Array<{ value: PostTypeFilter; label: string }> = [
  { value: "", label: "Tất cả kiểu đặt" },
  { value: "pool", label: "Kèo chờ ghép" },
  { value: "rental", label: "Thuê nguyên sân" },
];

const discoveryTabs: Array<{ value: DiscoveryTab; label: string; icon: string }> = [
  { value: "map", label: "Bản đồ", icon: "⌖" },
  { value: "booked", label: "Sân đã đặt", icon: "✓" },
  { value: "favorites", label: "Yêu thích", icon: "♡" },
];

const skillRanks: Record<string, number> = {
  Beginner: 1,
  Intermediate: 2,
  Advanced: 3,
};

const tierLabels: Record<string, string> = {
  Beginner: "Người mới",
  Intermediate: "Trung bình",
  Advanced: "Nâng cao",
};

function getSportIcon(sport: string) {
  const s = sport.toLowerCase();
  if (s.includes("pickleball")) return "🏓";
  if (s.includes("badminton") || s.includes("cầu lông")) return "🏸";
  if (s.includes("tennis")) return "🎾";
  if (s.includes("football") || s.includes("bóng đá")) return "⚽";
  return "🏆";
}

function loginUrl() {
  return `${API_BASE_URL}/api/v1/auth/google/start`;
}

function recommendationTone(label: string | null | undefined): "success" | "info" | "neutral" {
  if (label === "high") return "success";
  if (label === "medium") return "info";
  return "neutral";
}

function hasOpenSlots(session: Session) {
  return session.open_slots > 0;
}

function sessionMatchesSearch(session: Session, search: string) {
  const keyword = search.trim().toLowerCase();
  if (!keyword) return true;
  return [
    session.title,
    session.court_name,
    session.sub_court_name,
    session.complex_name,
    session.district,
    session.address,
    sportLabel(session.sport),
  ]
    .join(" ")
    .toLowerCase()
    .includes(keyword);
}

function tierFitsSession(session: Session, tier: string) {
  const playerRank = skillRanks[tier] ?? 1;
  const minRank = skillRanks[session.required_skill_min] ?? 1;
  const maxRank = skillRanks[session.required_skill_max] ?? 3;
  return playerRank >= minRank && playerRank <= maxRank;
}

function distanceLabel(session: Session, index: number) {
  if (session.distance_bucket === "same_district") return "2.4km";
  if (session.distance_bucket === "different_district") return "6.7km";
  const seed = session.id.charCodeAt(0) + index * 7;
  return `${((seed % 72) / 10 + 1.2).toFixed(1)}km`;
}

function ratingLabel(session: Session, index: number) {
  const score = session.recommendation_score ?? 70 + index;
  return (4.3 + Math.min(score, 100) / 400).toFixed(1);
}

function mapUrl(session: Session) {
  const query =
    session.latitude && session.longitude
      ? `${session.latitude},${session.longitude}`
      : `${session.complex_name} ${session.address}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function BookingMarketplace({ variant }: { variant: Variant }) {
  const searchParams = useSearchParams();
  const isMatchmaking = searchParams.get("mode") === "matchmaking";

  const [user, setUser] = useState<UserProfile | null>(null);
  const [skillTier, setSkillTier] = useState<SkillTierSummary | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [message, setMessage] = useState("Đang tìm các khung giờ phù hợp cho bạn...");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [sport, setSport] = useState<SportFilter>("");
  const [district, setDistrict] = useState("");
  const [postType, setPostType] = useState<PostTypeFilter>("");
  const [openOnly, setOpenOnly] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeTab, setActiveTab] = useState<DiscoveryTab>("map");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [playAll, setPlayAll] = useState(false);

  // Custom Matchmaking states
  const [location, setLocation] = useState("Hòa Lạc, Hà Nội");
  const [matchDate, setMatchDate] = useState("Hôm nay, 20/05");
  const [matchTime, setMatchTime] = useState("18:00 - 22:00");
  const [courtType, setCourtType] = useState("Tất cả sân");
  const [activeFilterDropdown, setActiveFilterDropdown] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const selectedSession = useMemo(() => {
    return matchmakingSessionsData.find((s) => s.id === selectedSessionId) || null;
  }, [selectedSessionId]);

  const effectivePostType: PostTypeFilter = isMatchmaking ? "pool" : postType;

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (sport) params.set("sport", sport);
    if (district.trim()) params.set("district", district.trim());
    if (effectivePostType) params.set("post_type", effectivePostType);
    if (openOnly) params.set("has_open_slots", "true");
    return params.toString();
  }, [district, effectivePostType, openOnly, sport]);

  async function loadDiscovery() {
    setIsLoading(true);
    setError("");
    try {
      let nextUser: UserProfile | null = null;
      let nextTier: SkillTierSummary | null = null;
      let endpoint = "/api/v1/public/discovery/sessions";

      try {
        nextUser = await apiFetch<UserProfile>("/api/v1/auth/me", { credentials: "include" });
        nextTier = await apiFetch<SkillTierSummary>("/api/v1/player/skill-tier", { credentials: "include" });
        endpoint = "/api/v1/player/discovery/sessions";
      } catch {
        nextUser = null;
        nextTier = null;
      }

      const nextSessions = await apiFetch<Session[]>(`${endpoint}${query ? `?${query}` : ""}`, {
        credentials: "include",
      });
      setUser(nextUser);
      setSkillTier(nextTier);
      setSessions(nextSessions);
      setMessage(
        nextUser
          ? `Có ${nextSessions.length} khung giờ đang được xếp theo độ phù hợp.`
          : `Có ${nextSessions.length} khung giờ công khai. Đăng nhập để đặt sân và cá nhân hóa level.`,
      );
    } catch (caught) {
      setUser(null);
      setSkillTier(null);
      setSessions([]);
      setError(errorMessage(caught, "Không tải được danh sách sân"));
      setMessage("Chưa tải được dữ liệu sân.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadDiscovery();
  }, [query]);

  function onFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadDiscovery();
  }

  const activeTier = skillTier?.visible_skill_tier ?? "Intermediate";

  const visibleSessions = useMemo(() => {
    let items = sessions.filter((item) => sessionMatchesSearch(item, search));
    if (activeTab === "favorites") {
      items = items.filter((item) => favorites.includes(item.id));
    }
    if (activeTab === "booked") {
      return [];
    }
    if (isMatchmaking && !playAll) {
      items = items.filter((item) => item.post_type === "pool" && tierFitsSession(item, activeTier));
    }
    return items;
  }, [activeTab, activeTier, favorites, isMatchmaking, playAll, search, sessions]);

  const stats = useMemo(() => {
    const poolCount = visibleSessions.filter((item) => item.post_type === "pool").length;
    const rentalCount = visibleSessions.filter((item) => item.post_type === "rental").length;
    const openSlotCount = visibleSessions.reduce((total, item) => total + item.open_slots, 0);
    return { poolCount, rentalCount, openSlotCount };
  }, [visibleSessions]);

  function toggleFavorite(sessionId: string) {
    setFavorites((current) =>
      current.includes(sessionId) ? current.filter((item) => item !== sessionId) : [...current, sessionId],
    );
  }

  // Dynamic filter for mock matchmaking sessions based on location and playAll toggle
  const visibleMatchmakingSessions = useMemo(() => {
    let items = matchmakingSessionsData;
    
    // Filter by selected location
    if (location && location !== "Tất cả khu vực") {
      const selectedLocWord = location.split(",")[0].toLowerCase().trim(); // "hòa lạc" or "cầu giấy"
      items = items.filter((item) => 
        item.address.toLowerCase().includes(selectedLocWord) || 
        item.complexName.toLowerCase().includes(selectedLocWord)
      );
    }

    // Filter by Play All (if playAll is false, show only suitable ones)
    if (!playAll) {
      items = items.filter((item) => item.levelStatus === "suitable");
    }

    return items;
  }, [playAll, location]);

  // Tự động điều chỉnh trận đấu được chọn khi danh sách lọc thay đổi
  useEffect(() => {
    if (isMatchmaking) {
      if (visibleMatchmakingSessions.length > 0) {
        // Nếu trận đấu được chọn hiện tại không nằm trong danh sách hiển thị mới, tự động chọn trận đầu tiên
        const exists = visibleMatchmakingSessions.some((s) => s.id === selectedSessionId);
        if (!exists && selectedSessionId !== null) {
          setSelectedSessionId(visibleMatchmakingSessions[0].id);
        }
      } else {
        setSelectedSessionId(null);
      }
    }
  }, [visibleMatchmakingSessions, isMatchmaking, selectedSessionId]);

  const userElo = skillTier?.visible_skill_tier === "Beginner"
    ? 800
    : skillTier?.visible_skill_tier === "Advanced"
    ? 1800
    : 1250;

  const userTierLabel = skillTier?.visible_skill_tier === "Beginner"
    ? "Người mới"
    : skillTier?.visible_skill_tier === "Advanced"
    ? "Nâng cao"
    : "Trung cấp";

  const locations = [
    "Hòa Lạc, Hà Nội",
    "Cầu Giấy, Hà Nội",
    "Mỹ Đình, Hà Nội",
    "Thanh Xuân, Hà Nội",
  ];

  // RENDER MATCHMAKING LAYOUT
  if (isMatchmaking) {
    return (
      <div className="space-y-6">
        {/* Main Title Section */}
        <div>
          <h1 className="font-heading text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Ghép đối thủ <span className="text-[#b00c14]">phù hợp</span>
          </h1>
          <p className="mt-2 text-sm text-slate-500 sm:text-base max-w-3xl">
            Hệ thống đã phân tích trình độ, thói quen chơi và thời gian của bạn để đề xuất những trận đấu phù hợp nhất.
          </p>
        </div>

        {/* Filters Bar */}
        <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          
          {/* Location Selector */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setActiveFilterDropdown(activeFilterDropdown === "location" ? null : "location")}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-800 transition cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 text-red-600 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2a8 8 0 00-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 00-8-8z" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="10" r="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="text-left leading-tight">
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Khu vực</p>
                <p className="text-slate-800 text-xs">{location}</p>
              </div>
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-400 shrink-0 ml-1" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {activeFilterDropdown === "location" && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setActiveFilterDropdown(null)} />
                <div className="absolute left-0 mt-2 z-40 w-[200px] rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                  {locations.map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => {
                        setLocation(loc);
                        setActiveFilterDropdown(null);
                      }}
                      className={`w-full block rounded-lg px-3 py-2 text-left text-xs transition cursor-pointer ${
                        location === loc ? "bg-red-50 text-red-800 font-semibold" : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {loc}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Date Selector */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setActiveFilterDropdown(activeFilterDropdown === "date" ? null : "date")}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-800 transition cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <div className="text-left leading-tight">
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Ngày</p>
                <p className="text-slate-800 text-xs">{matchDate}</p>
              </div>
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-400 shrink-0 ml-1" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {activeFilterDropdown === "date" && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setActiveFilterDropdown(null)} />
                <div className="absolute left-0 mt-2 z-40 w-[200px] rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                  {["Hôm nay, 20/05", "Ngày mai, 21/05", "Thứ Năm, 22/05"].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        setMatchDate(d);
                        setActiveFilterDropdown(null);
                      }}
                      className={`w-full block rounded-lg px-3 py-2 text-left text-xs transition cursor-pointer ${
                        matchDate === d ? "bg-red-50 text-red-800 font-semibold" : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Time Selector */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setActiveFilterDropdown(activeFilterDropdown === "time" ? null : "time")}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-800 transition cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 text-blue-600 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <div className="text-left leading-tight">
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Thời gian</p>
                <p className="text-slate-800 text-xs">{matchTime}</p>
              </div>
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-400 shrink-0 ml-1" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {activeFilterDropdown === "time" && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setActiveFilterDropdown(null)} />
                <div className="absolute left-0 mt-2 z-40 w-[200px] rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                  {["18:00 - 22:00", "06:00 - 10:00", "14:00 - 18:00"].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setMatchTime(t);
                        setActiveFilterDropdown(null);
                      }}
                      className={`w-full block rounded-lg px-3 py-2 text-left text-xs transition cursor-pointer ${
                        matchTime === t ? "bg-red-50 text-red-800 font-semibold" : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Court Selector */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setActiveFilterDropdown(activeFilterDropdown === "court" ? null : "court")}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-800 transition cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 text-orange-600 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="18" rx="2" ry="2" />
                <line x1="12" y1="3" x2="12" y2="21" />
                <line x1="2" y1="12" x2="22" y2="12" />
              </svg>
              <div className="text-left leading-tight">
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Số sân</p>
                <p className="text-slate-800 text-xs">{courtType}</p>
              </div>
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-400 shrink-0 ml-1" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {activeFilterDropdown === "court" && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setActiveFilterDropdown(null)} />
                <div className="absolute left-0 mt-2 z-40 w-[200px] rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                  {["Tất cả sân", "Sân trong nhà", "Sân ngoài trời"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        setCourtType(c);
                        setActiveFilterDropdown(null);
                      }}
                      className={`w-full block rounded-lg px-3 py-2 text-left text-xs transition cursor-pointer ${
                        courtType === c ? "bg-red-50 text-red-800 font-semibold" : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Toggle Switch + Filter Button */}
          <div className="ml-auto flex items-center gap-3 flex-wrap">
            <label className="flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-slate-50 p-1.5 pr-3 transition hover:border-slate-300">
              <input
                type="checkbox"
                checked={playAll}
                onChange={(event) => setPlayAll(event.target.checked)}
                className="sr-only"
              />
              <span className={`relative h-6 w-11 rounded-full transition duration-200 ${playAll ? "bg-red-800" : "bg-slate-300"}`}>
                <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${playAll ? "translate-x-5" : ""}`} />
              </span>
              <span className="text-xs font-semibold text-slate-700">Ghép mọi trình độ</span>
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-500 cursor-help" title="Bật chế độ này để xem các phòng ghép ở tất cả các cấp độ ELO khác nhau">
                i
              </span>
            </label>

            <button
              type="button"
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-700 transition cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-600 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              Bộ lọc
            </button>
          </div>
        </div>

        {/* 2-Column Main Content Section */}
        <div className="grid gap-6 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_340px]">
          
          {/* LEFT COLUMN: Suggested Rooms */}
          <div className="space-y-4">
            
            {/* Header List */}
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-amber-500 shrink-0" fill="currentColor">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                <h2 className="font-heading text-lg font-bold text-slate-900">Đề xuất dành cho bạn</h2>
                <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-[10px] font-bold text-red-700 ring-1 ring-red-200">
                  Dựa trên AI
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 animate-pulse text-red-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 11-.57-8.38l5.67-5.67" />
                </svg>
                <span>Cập nhật lúc 11:20</span>
              </div>
            </div>

            {/* Empty check */}
            {visibleMatchmakingSessions.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
                <p className="text-base font-semibold">Không tìm thấy trận đấu nào phù hợp</p>
                <p className="text-xs text-slate-400 mt-1">Hãy đổi bộ lọc khu vực hoặc bật toggle "Ghép mọi trình độ" để xem thêm.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {visibleMatchmakingSessions.map((session) => {
                  const isFull = session.slotsJoined === session.slotsMax;
                  const isNearFull = session.slotsJoined === session.slotsMax - 1;
                  
                  let badgeColor = "bg-green-50 text-green-700 border-green-200";
                  let badgeText = `Thiếu ${session.slotsMax - session.slotsJoined} người`;
                  if (isFull) {
                    badgeColor = "bg-red-50 text-red-700 border-red-200";
                    badgeText = "Đã đủ người";
                  } else if (isNearFull) {
                    badgeColor = "bg-orange-50 text-orange-700 border-orange-200";
                    badgeText = "Chỉ còn 1 chỗ";
                  }

                  return (
                    <article
                      key={session.id}
                      onClick={() => setSelectedSessionId(session.id)}
                      className={`group relative overflow-hidden rounded-2xl border p-4 shadow-2xs hover:shadow-md transition duration-200 flex flex-col md:flex-row gap-4 lg:gap-5 items-stretch cursor-pointer ${
                        selectedSessionId === session.id ? "border-[#b00c14] bg-slate-50/30" : "border-slate-200 bg-white"
                      }`}
                    >
                      {/* Div 1: Sân Image */}
                      <div className="relative h-40 w-full md:w-52 shrink-0 rounded-xl overflow-hidden bg-slate-100">
                        <img
                          src={courtImageForSport(session.sport)}
                          alt={session.courtName}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        {/* Index tag */}
                        <div className="absolute top-3 left-3 flex h-7 w-7 items-center justify-center rounded-lg bg-black/60 font-extrabold text-white text-sm backdrop-blur-xs">
                          {session.index}
                        </div>
                        {/* Best fit badge */}
                        {session.isMostSuitable && (
                          <div className="absolute bottom-3 left-3 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-xs">
                            Phù hợp nhất
                          </div>
                        )}
                      </div>

                      {/* Div 2: Sân Info */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between py-1 gap-2">
                        <div>
                          <h3 className="font-heading text-xl font-bold text-slate-900 leading-tight">
                            {session.courtName}
                          </h3>
                          <p className="font-bold text-slate-800 text-sm mt-0.5">{session.complexName}</p>
                          
                          <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 2a8 8 0 00-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 00-8-8z" />
                              <circle cx="12" cy="10" r="3" />
                            </svg>
                            <span className="truncate">{session.address}</span>
                          </p>
                        </div>

                        {/* Tags row */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-semibold text-slate-600 mt-2">
                          <span className="flex items-center gap-1.5">
                            <span>{getSportIcon(session.sport)}</span>
                            {session.sport}
                          </span>
                          <span className="flex items-center gap-1.5">
                            {/* Abstract route map icon for distance */}
                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
                              <line x1="9" y1="3" x2="9" y2="18" />
                              <line x1="15" y1="6" x2="15" y2="21" />
                            </svg>
                            {session.distance}
                          </span>
                          {session.hasParking && (
                            <span className="flex items-center gap-1.5">
                              {/* Abstract steering wheel parking icon */}
                              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="2" x2="12" y2="12" />
                                <line x1="12" y1="12" x2="8" y2="18" />
                                <line x1="12" y1="12" x2="16" y2="18" />
                              </svg>
                              Có chỗ gửi xe
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Div 3: Match Details */}
                      <div className="w-full md:w-52 shrink-0 border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-5 flex flex-col gap-2.5 justify-center py-1">
                        {/* Time */}
                        <div className="flex items-center gap-2 text-slate-700">
                          {/* Abstract Hourglass for Time */}
                          <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 2h14M5 22h14M19 2v4a7 7 0 01-7 7v0a7 7 0 01-7-7V2M5 22v-4a7 7 0 017-7v0a7 7 0 017 7v4" />
                            <path d="M12 7v0M12 17v0" />
                          </svg>
                          <span className="font-bold text-slate-800 text-sm">{session.time}</span>
                        </div>

                        {/* Slots */}
                        <div className="flex items-center gap-2 text-slate-700">
                          {/* Abstract Capacity Connected Nodes Icon */}
                          <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="3" />
                            <circle cx="6" cy="6" r="2" />
                            <circle cx="18" cy="6" r="2" />
                            <circle cx="18" cy="18" r="2" />
                            <circle cx="6" cy="18" r="2" />
                            <line x1="6" y1="6" x2="9.5" y2="9.5" />
                            <line x1="18" y1="6" x2="14.5" y2="9.5" />
                            <line x1="18" y1="18" x2="14.5" y2="14.5" />
                            <line x1="6" y1="18" x2="9.5" y2="14.5" />
                          </svg>
                          <span className="font-bold text-emerald-700 text-sm">
                            {session.slotsJoined} / {session.slotsMax} người
                          </span>
                        </div>

                        {/* Badge slots left */}
                        <div>
                          <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-bold ${badgeColor}`}>
                            {badgeText}
                          </span>
                        </div>

                        {/* Suitability */}
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                          {session.levelStatus === "suitable" ? (
                            <>
                              {/* Abstract suit radar chart symbol */}
                              <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 2L2 12l10 10 10-10L12 2z" />
                                <path d="M12 6l-6 6 6 6 6-6-6-6z" />
                                <circle cx="12" cy="12" r="2" fill="currentColor" />
                              </svg>
                              <span className="text-emerald-700 font-bold">{session.levelText}</span>
                            </>
                          ) : (
                            <>
                              <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 text-amber-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 2L2 12l10 10 10-10L12 2z" />
                                <path d="M12 6l-6 6 6 6 6-6-6-6z" fill="#fef3c7" />
                              </svg>
                              <span className="text-amber-700 font-bold">{session.levelText}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Div 4: Pricing & Actions */}
                      <div className="w-full md:w-44 shrink-0 flex flex-col justify-between items-end py-1 pl-2">
                        {/* Heart Icon at top right */}
                        <div className="w-full flex justify-end">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(session.id);
                            }}
                            className={`flex h-8.5 w-8.5 items-center justify-center rounded-xl border transition ${
                              favorites.includes(session.id)
                                ? "border-rose-200 bg-rose-50 text-rose-600"
                                : "border-slate-200 bg-white text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                            } cursor-pointer`}
                          >
                            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill={favorites.includes(session.id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                            </svg>
                          </button>
                        </div>

                        {/* Price & Join Button */}
                        <div className="w-full flex flex-col items-end gap-2.5">
                          <span className="font-heading text-xl font-extrabold text-slate-900 leading-none">
                            {formatVnd(session.price)}
                          </span>
                          {isFull ? (
                            <button
                              type="button"
                              onClick={(e) => e.stopPropagation()}
                              className="w-full inline-flex h-9.5 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 cursor-pointer text-center"
                            >
                              Xem sân khác
                            </button>
                          ) : (
                            <Link
                              href={user ? `/player/booking?sessionId=${session.id}&mode=solo` : loginUrl()}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full inline-flex h-9.5 items-center justify-center rounded-xl bg-red-800 hover:bg-red-950 px-5 text-xs font-bold text-white transition shadow-xs cursor-pointer text-center whitespace-nowrap"
                            >
                              Tham gia ngay
                            </Link>
                          )}
                        </div>

                        {/* Avatars stack with Unsplash images */}
                        <div className="flex items-center gap-2">
                          <div className="flex -space-x-1.5 overflow-hidden">
                            {session.players.map((p, pIdx) => (
                              <img
                                key={pIdx}
                                src={p.avatar}
                                alt={p.name}
                                title={p.name}
                                className="inline-block h-6.5 w-6.5 rounded-full ring-2 ring-white object-cover"
                              />
                            ))}
                          </div>
                          <span className="text-[10px] font-semibold text-slate-500 whitespace-nowrap">
                            {session.joinedCountText}
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Sidebar stats and advice OR Match details */}
          <div className="space-y-6">
            {selectedSessionId && selectedSession ? (
              /* Panel Chi tiết trận đấu */
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col gap-4">
                {/* Header: Title & Close Button */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="font-heading font-bold text-slate-900 text-sm sm:text-base">Chi tiết trận đấu</h3>
                  <button
                    type="button"
                    onClick={() => setSelectedSessionId(null)}
                    className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer text-sm font-bold"
                    aria-label="Đóng chi tiết"
                  >
                    ✕
                  </button>
                </div>

                {/* Court Image with Index and Badge */}
                <div className="relative h-44 w-full rounded-xl overflow-hidden bg-slate-100 shrink-0">
                  <img
                    src={courtImageForSport(selectedSession.sport)}
                    alt={selectedSession.courtName}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute top-3 left-3 flex h-7 w-7 items-center justify-center rounded-lg bg-black/60 font-extrabold text-white text-sm backdrop-blur-xs">
                    {selectedSession.index}
                  </div>
                  {selectedSession.isMostSuitable && (
                    <div className="absolute bottom-3 left-3 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-xs">
                      Phù hợp nhất
                    </div>
                  )}
                </div>

                {/* Name & Complex */}
                <div>
                  <h4 className="font-heading text-xl font-bold text-slate-900 leading-tight">
                    {selectedSession.courtName}
                  </h4>
                  <p className="font-bold text-slate-800 text-sm mt-0.5">{selectedSession.complexName}</p>
                  
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2a8 8 0 00-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 00-8-8z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    <span>{selectedSession.address}</span>
                  </p>
                </div>

                {/* Tags: Sport, Distance, Parking */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-slate-600 border-b border-slate-100 pb-3">
                  <span className="flex items-center gap-1.5">
                    <span>{getSportIcon(selectedSession.sport)}</span>
                    {selectedSession.sport}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
                      <line x1="9" y1="3" x2="9" y2="18" />
                      <line x1="15" y1="6" x2="15" y2="21" />
                    </svg>
                    {selectedSession.distance}
                  </span>
                  {selectedSession.hasParking && (
                    <span className="flex items-center gap-1.5">
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="2" x2="12" y2="12" />
                        <line x1="12" y1="12" x2="8" y2="18" />
                        <line x1="12" y1="12" x2="16" y2="18" />
                      </svg>
                      Có chỗ gửi xe
                    </span>
                  )}
                </div>

                {/* Detailed Information Grid */}
                <div className="space-y-3.5 py-1">
                  {/* Row 1: Thời gian */}
                  <div className="flex items-start gap-3 text-xs">
                    <div className="mt-0.5 text-slate-400 shrink-0">
                      {/* Hourglass */}
                      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 2h14M5 22h14M19 2v4a7 7 0 01-7 7v0a7 7 0 01-7-7V2M5 22v-4a7 7 0 017-7v0a7 7 0 017 7v4" />
                        <path d="M12 7v0M12 17v0" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-slate-500">Thời gian</p>
                      <p className="font-bold text-slate-800 text-sm mt-0.5">
                        {selectedSession.time} <span className="font-normal text-slate-400 mx-1">|</span> {matchDate}
                      </p>
                    </div>
                  </div>

                  {/* Row 2: Số lượng */}
                  <div className="flex items-start gap-3 text-xs">
                    <div className="mt-0.5 text-slate-400 shrink-0">
                      {/* Connected Nodes */}
                      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3" />
                        <circle cx="6" cy="6" r="2" />
                        <circle cx="18" cy="6" r="2" />
                        <circle cx="18" cy="18" r="2" />
                        <circle cx="6" cy="18" r="2" />
                        <line x1="6" y1="6" x2="9.5" y2="9.5" />
                        <line x1="18" y1="6" x2="14.5" y2="9.5" />
                        <line x1="18" y1="18" x2="14.5" y2="14.5" />
                        <line x1="6" y1="18" x2="9.5" y2="14.5" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-slate-500">Số lượng</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-bold text-slate-800 text-sm">
                          {selectedSession.slotsJoined} / {selectedSession.slotsMax} người
                        </span>
                        {(() => {
                          const isFull = selectedSession.slotsJoined === selectedSession.slotsMax;
                          const isNearFull = selectedSession.slotsJoined === selectedSession.slotsMax - 1;
                          let badgeColor = "bg-green-50 text-green-700 border-green-200";
                          let badgeText = `Thiếu ${selectedSession.slotsMax - selectedSession.slotsJoined} người`;
                          if (isFull) {
                            badgeColor = "bg-red-50 text-red-700 border-red-200";
                            badgeText = "Đã đủ người";
                          } else if (isNearFull) {
                            badgeColor = "bg-orange-50 text-orange-700 border-orange-200";
                            badgeText = "Chỉ còn 1 chỗ";
                          }
                          return (
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${badgeColor}`}>
                              {badgeText}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Row 3: Trình độ */}
                  <div className="flex items-start gap-3 text-xs">
                    <div className="mt-0.5 text-slate-400 shrink-0">
                      {/* Diamond Radar Chart */}
                      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2L2 12l10 10 10-10L12 2z" />
                        <path d="M12 6l-6 6 6 6 6-6-6-6z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-slate-500">Trình độ</p>
                      <p className={`font-bold text-sm mt-0.5 ${
                        selectedSession.levelStatus === "suitable" ? "text-emerald-700" : "text-amber-700"
                      }`}>
                        {selectedSession.levelText}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Hệ thống AI đã cân bằng trình độ trong trận</p>
                    </div>
                  </div>

                  {/* Row 4: Phí tham gia */}
                  <div className="flex items-start gap-3 text-xs border-b border-slate-100 pb-4">
                    <div className="mt-0.5 text-slate-400 shrink-0">
                      {/* Price Tag */}
                      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                        <line x1="7" y1="7" x2="7.01" y2="7" strokeWidth="3" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-slate-500">Phí tham gia</p>
                      <p className="font-extrabold text-[#b00c14] text-base mt-0.5">
                        {formatVnd(selectedSession.price)} <span className="text-xs font-normal text-slate-400">/ người</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Additional Information Notice */}
                <div className="rounded-xl bg-blue-50/60 border border-blue-100/80 p-3.5 text-xs text-blue-800 flex items-start gap-2.5">
                  <span className="text-sm shrink-0 mt-0.5">ℹ️</span>
                  <p className="leading-relaxed">
                    <span className="font-bold">Thông tin thêm:</span> Đến sớm 10-15 phút để khởi động và làm quen với các thành viên nhé!
                  </p>
                </div>

                {/* Joined Players */}
                <div className="space-y-2.5">
                  <p className="text-xs font-bold text-slate-700">Những người đã tham gia</p>
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-1.5 overflow-hidden">
                      {selectedSession.players.map((p, pIdx) => (
                        <img
                          key={pIdx}
                          src={p.avatar}
                          alt={p.name}
                          title={p.name}
                          className="inline-block h-7.5 w-7.5 rounded-full ring-2 ring-white object-cover"
                        />
                      ))}
                    </div>
                    <span className="text-xs font-semibold text-slate-500">
                      {selectedSession.joinedCountText}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-2 space-y-2">
                  {selectedSession.slotsJoined === selectedSession.slotsMax ? (
                    <button
                      type="button"
                      className="w-full inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 cursor-pointer text-center"
                    >
                      Xem sân khác
                    </button>
                  ) : (
                    <Link
                      href={user ? `/player/booking?sessionId=${selectedSession.id}&mode=solo` : loginUrl()}
                      className="w-full inline-flex h-11 items-center justify-center rounded-xl bg-[#b00c14] hover:bg-red-950 px-5 text-sm font-bold text-white transition shadow-sm cursor-pointer text-center whitespace-nowrap"
                    >
                      Tham gia ngay
                    </Link>
                  )}
                  <p className="text-[10px] text-slate-400 text-center font-medium">Bạn sẽ thanh toán ở bước tiếp theo</p>
                </div>
              </div>
            ) : (
              /* Lời khuyên & Thống kê gốc */
              <>
                {/* Lời khuyên cho bạn Card */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                    <span className="text-emerald-700 text-lg">💡</span>
                    <h3 className="font-heading font-bold text-slate-900 text-sm sm:text-base">Lời khuyên cho bạn</h3>
                  </div>
                  <div className="mt-4 space-y-4">
                    <div className="flex gap-3 text-xs">
                      <div className="h-7 w-7 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 font-bold text-sm">
                        ✓
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm">Sân 1 phù hợp nhất</p>
                        <p className="mt-0.5 text-slate-500 leading-relaxed">Trình độ người chơi tương đồng với bạn và khu giờ bạn thường chơi.</p>
                      </div>
                    </div>

                    <div className="flex gap-3 text-xs">
                      <div className="h-7 w-7 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 font-bold text-sm">
                        🕒
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm">Khung giờ vàng</p>
                        <p className="mt-0.5 text-slate-500 leading-relaxed">18:00 - 21:00 là khung giờ có nhiều người chơi nhất hôm nay.</p>
                      </div>
                    </div>

                    <div className="flex gap-3 text-xs">
                      <div className="h-7 w-7 rounded-full bg-purple-50 text-purple-700 flex items-center justify-center shrink-0 font-bold text-sm">
                        👥
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm">Rủ thêm bạn bè</p>
                        <p className="mt-0.5 text-slate-500 leading-relaxed">Rủ bạn cùng tham gia để tăng cơ hội ghép trận và vui hơn!</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Thống kê nhanh Card */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                  <h3 className="font-heading font-bold text-slate-900 text-sm sm:text-base pb-3 border-b border-slate-100">
                    Thống kê nhanh
                  </h3>
                  <div className="mt-4 space-y-4">
                    {/* Level */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 text-red-600 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 20v-8M17 20V8M7 20v-4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span className="font-semibold text-slate-600">Trình độ của bạn</span>
                      </div>
                      <div className="text-right leading-tight">
                        <p className="font-bold text-slate-900">ELO {userElo}</p>
                        <p className="text-[10px] text-slate-400 font-bold">{userTierLabel}</p>
                      </div>
                    </div>

                    {/* Success Rate */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 text-blue-600 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                          <polyline points="17 6 23 6 23 12" />
                        </svg>
                        <span className="font-semibold text-slate-600">Tỷ lệ ghép thành công</span>
                      </div>
                      <span className="font-bold text-slate-900 text-sm">92%</span>
                    </div>

                    {/* Matches count */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 text-orange-600 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        <span className="font-semibold text-slate-600">Số trận đã chơi</span>
                      </div>
                      <span className="font-bold text-slate-900 text-sm">24 trận</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Bottom AI explanation banner */}
        <div className="bg-red-50/40 border border-red-100 rounded-2xl p-5 flex flex-col md:flex-row items-center gap-4 shadow-2xs">
          <div className="h-10 w-10 rounded-xl bg-red-100 text-red-800 flex items-center justify-center shrink-0 text-xl font-bold">
            ✨
          </div>
          <div className="flex-1 text-center md:text-left">
            <h4 className="font-heading font-bold text-slate-900 text-sm sm:text-base">Ghép đối thủ thông minh</h4>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">
              Chúng tôi sử dụng AI để phân tích trình độ, lịch sử trận, vị trí và thói quen chơi để đề xuất những trận đấu phù hợp nhất với bạn.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 shadow-3xs ring-1 ring-slate-100">
              ⚖️ Trình độ cân bằng
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 shadow-3xs ring-1 ring-slate-100">
              🤝 Cộng đồng văn minh
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 shadow-3xs ring-1 ring-slate-100">
              🛡️ Trải nghiệm an toàn
            </span>
          </div>
        </div>
      </div>
    );
  }

  // DEFAULT BOOKING MARKETPLACE LAYOUT
  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
              {variant === "owner" ? "NetUp thị trường" : "NetUp đặt sân"}
            </p>
            <h1 className="mt-3 max-w-3xl font-heading text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
              Tìm sân theo lưới, đặt lịch nhanh.
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
              Tìm theo tên sân hoặc khu vực, xem nhanh bản đồ, trạng thái slot và đặt lịch trực quan.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[420px]">
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Hiển thị</p>
              <p className="mt-1 font-heading text-2xl font-semibold text-emerald-950">{visibleSessions.length}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Kèo ghép</p>
              <p className="mt-1 font-heading text-2xl font-semibold text-slate-950">{stats.poolCount}</p>
            </div>
            <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">Slot trống</p>
              <p className="mt-1 font-heading text-2xl font-semibold text-amber-950">{stats.openSlotCount}</p>
            </div>
          </div>
        </div>
      </section>

      <Card>
        <form onSubmit={onFilterSubmit} className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600" aria-hidden="true">
                ⌕
              </span>
              <input
                className={`${inputClassName} pl-9`}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm tên sân hoặc khu vực, ví dụ Catchy Pickleball, Hòa Lạc"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setShowAdvanced((value) => !value)}>
                Bộ lọc
              </Button>
              <Button disabled={isLoading}>{isLoading ? "Đang tìm..." : "Tìm sân"}</Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {discoveryTabs.map((tab) => {
              const active = activeTab === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition ${
                    active
                      ? "border-emerald-500 bg-emerald-600 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50"
                  }`}
                  onClick={() => setActiveTab(tab.value)}
                >
                  <span aria-hidden="true">{tab.icon}</span>
                  {tab.label}
                </button>
              );
            })}
          </div>

          {showAdvanced ? (
            <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[1fr_1fr_1fr_auto]">
              <Field label="Môn thể thao">
                <select className={inputClassName} value={sport} onChange={(event) => setSport(event.target.value as SportFilter)}>
                  {sportOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Khu vực">
                <input
                  className={inputClassName}
                  value={district}
                  onChange={(event) => setDistrict(event.target.value)}
                  placeholder="Ví dụ: Hòa Lạc"
                />
              </Field>
              <Field label="Kiểu đặt">
                <select
                  className={inputClassName}
                  value={effectivePostType}
                  disabled={isMatchmaking}
                  onChange={(event) => setPostType(event.target.value as PostTypeFilter)}
                >
                  {postTypeOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </Field>
              <label className="flex items-end pb-2">
                <span className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={openOnly}
                    onChange={(event) => setOpenOnly(event.target.checked)}
                  />
                  Chỉ hiện còn slot
                </span>
              </label>
            </div>
          ) : null}
        </form>
      </Card>

      {error ? (
        <Notice tone="danger">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <a className="font-semibold underline" href={loginUrl()}>
              Đăng nhập Google
            </a>
          </div>
        </Notice>
      ) : (
        <Notice tone="info">{message}</Notice>
      )}

      {activeTab === "booked" ? (
        <EmptyState
          title="Sân đã đặt nằm trong trang Booking của tôi"
          description="Mở danh sách booking để xem mã check-in, trạng thái tiền cọc và lịch chơi sắp tới."
          action={<ButtonLink href="/player/bookings">Xem booking của tôi</ButtonLink>}
        />
      ) : visibleSessions.length === 0 && !isLoading ? (
        <EmptyState
          title="Chưa có sân phù hợp"
          description="Thử đổi từ khóa, mở bộ lọc hoặc bật chế độ chơi với tất cả mọi người."
          action={<Button onClick={() => void loadDiscovery()}>Tải lại danh sách</Button>}
        />
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleSessions.map((session, index) => {
            const image = courtImageForSport(session.sport);
            const open = hasOpenSlots(session);
            const isPool = session.post_type === "pool";
            const isFavorite = favorites.includes(session.id);
            const href = user ? `/player/booking?sessionId=${session.id}&mode=${isPool ? "solo" : "full_court"}` : loginUrl();

            return (
              <article key={session.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                      Đơn ngày
                    </span>
                    <span className="rounded-full bg-fuchsia-50 px-3 py-1 text-xs font-semibold text-fuchsia-700 ring-1 ring-fuchsia-200">
                      {isPool ? "Sự kiện" : postTypeLabel(session.post_type)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={isFavorite ? "Bỏ yêu thích" : "Thêm yêu thích"}
                      className={`flex h-8 w-8 items-center justify-center rounded-full border transition ${
                        isFavorite
                          ? "border-rose-200 bg-rose-50 text-rose-600"
                          : "border-slate-200 bg-white text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                      }`}
                      onClick={() => toggleFavorite(session.id)}
                    >
                      ♥
                    </button>
                    <a
                      href={mapUrl(session)}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Xem bản đồ"
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-emerald-600 transition hover:bg-emerald-50"
                    >
                      ⌖
                    </a>
                  </div>
                </div>

                <div className="space-y-3 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <Badge tone={recommendationTone(session.recommendation_label)}>
                      {recommendationLabel(session.recommendation_label)}
                    </Badge>
                    <span className="text-sm font-semibold text-amber-500">★ {ratingLabel(session, index)}</span>
                  </div>

                  <div className="grid grid-cols-[104px_1fr] gap-3">
                    <img
                      src={image}
                      alt={session.sub_court_name}
                      className="h-28 w-full rounded-lg object-cover"
                    />
                    <div className="min-w-0">
                      <h2 className="line-clamp-2 font-heading text-lg font-semibold leading-snug text-emerald-700">
                        {session.complex_name} ({session.sub_court_name})
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        <span className="font-semibold text-orange-500">({distanceLabel(session, index)})</span>{" "}
                        {session.address}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                    <p>
                      <span className="font-semibold text-slate-950">🕒 Giờ hoạt động:</span>{" "}
                      {formatTimeRange(session.starts_at, session.duration_minutes)}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-950">Môn:</span> {sportLabel(session.sport)} ·{" "}
                      <span className="font-semibold text-slate-950">Slot:</span> {session.open_slots}/{session.max_slots}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-950">Giá:</span>{" "}
                      {formatVnd(isPool ? session.slot_price_vnd : session.full_court_price_vnd)}
                    </p>
                  </div>

                  <a
                    href={href}
                    className={`inline-flex w-full items-center justify-center rounded-lg px-4 py-3 text-sm font-semibold shadow-sm transition ${
                      isPool
                        ? "bg-emerald-600 text-white hover:bg-emerald-700"
                        : "bg-amber-400 text-slate-950 hover:bg-amber-300"
                    } ${!open ? "pointer-events-none opacity-60" : ""}`}
                  >
                    {isPool ? "THAM GIA NGAY" : "ĐẶT LỊCH"}
                  </a>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
