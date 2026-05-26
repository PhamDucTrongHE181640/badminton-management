"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

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

  const activeTier = skillTier?.visible_skill_tier ?? "Beginner";

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

  const title = isMatchmaking
    ? "Xếp đối cùng trình tại Hòa Lạc."
    : "Tìm sân theo lưới, đặt lịch nhanh.";
  const description = isMatchmaking
    ? "NetUp dùng Elo đã lưu khi tài khoản đăng nhập lần đầu để lọc phòng chơi sát trình. Bật chế độ giao lưu nếu bạn muốn xem tất cả kèo."
    : "Tìm theo tên sân hoặc khu vực, xem nhanh bản đồ, trạng thái slot và đặt lịch trực quan.";

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
              {variant === "owner" ? "NetUp thị trường" : isMatchmaking ? "NetUp matchmaking" : "NetUp đặt sân"}
            </p>
            <h1 className="mt-3 max-w-3xl font-heading text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
              {title}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">{description}</p>
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

      {isMatchmaking ? (
        <section className="grid gap-4 rounded-lg border border-emerald-200 bg-emerald-50 p-5 shadow-sm lg:grid-cols-[1fr_320px]">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Bộ lọc xếp đối</p>
                <h2 className="mt-1 font-heading text-2xl font-semibold text-emerald-950">
                  Ghép kèo theo Elo và lịch sử thi đấu
                </h2>
              </div>
              <Badge tone="success">
                Level dùng để lọc: {tierLabels[activeTier] ?? activeTier}
              </Badge>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-emerald-100 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Nguồn level</p>
                <p className="mt-1 text-sm font-semibold text-slate-950">
                  {skillTier?.has_assessment ? "Elo ban đầu đã lưu" : user ? "Cần onboarding lần đầu" : "Khách xem công khai"}
                </p>
              </div>
              <div className="rounded-lg border border-emerald-100 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Cập nhật sau đó</p>
                <p className="mt-1 text-sm font-semibold text-slate-950">Feedback + kết quả trận</p>
              </div>
              <div className="rounded-lg border border-emerald-100 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Phạm vi hiển thị</p>
                <p className="mt-1 text-sm font-semibold text-slate-950">
                  {playAll ? "Tất cả cấp độ" : "Cùng level"}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-emerald-100 bg-white p-4">
            <p className="text-sm font-semibold text-slate-950">Chế độ hiển thị phòng chơi</p>
            <label className="mt-4 flex cursor-pointer items-center justify-between gap-3 rounded-full border border-slate-200 bg-slate-50 p-1">
              <span className="px-3 text-sm font-semibold text-slate-700">Chơi với tất cả mọi người</span>
              <input
                className="sr-only"
                type="checkbox"
                checked={playAll}
                onChange={(event) => setPlayAll(event.target.checked)}
              />
              <span className={`relative h-8 w-14 rounded-full transition ${playAll ? "bg-emerald-600" : "bg-slate-300"}`}>
                <span className={`absolute left-1 top-1 h-6 w-6 rounded-full bg-white shadow transition ${playAll ? "translate-x-6" : ""}`} />
              </span>
            </label>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              Mặc định NetUp chỉ hiển thị kèo cùng level hoặc chênh lệch thấp. Elo sau onboarding chỉ thay đổi qua
              feedback và lịch sử trận đấu.
            </p>
          </div>
        </section>
      ) : null}

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
