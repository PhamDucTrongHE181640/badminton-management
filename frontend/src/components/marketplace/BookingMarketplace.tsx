"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { Badge, Button, ButtonLink, Card, EmptyState, Field, Notice, PageHero, StatCard, inputClassName } from "@/components/ui";
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

function recommendationTone(label: string | null | undefined): "success" | "info" | "neutral" {
  if (label === "high") return "success";
  if (label === "medium") return "info";
  return "neutral";
}

function hasOpenSlots(session: Session) {
  return session.open_slots > 0;
}

export function BookingMarketplace({ variant }: { variant: Variant }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [skillTier, setSkillTier] = useState<SkillTierSummary | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [message, setMessage] = useState("Đang tìm các khung giờ phù hợp cho bạn...");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [sport, setSport] = useState<SportFilter>("");
  const [district, setDistrict] = useState("");
  const [postType, setPostType] = useState<PostTypeFilter>("");
  const [openOnly, setOpenOnly] = useState(true);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (sport) params.set("sport", sport);
    if (district.trim()) params.set("district", district.trim());
    if (postType) params.set("post_type", postType);
    if (openOnly) params.set("has_open_slots", "true");
    return params.toString();
  }, [district, openOnly, postType, sport]);

  async function loadDiscovery() {
    setIsLoading(true);
    setError("");
    try {
      const [nextUser, nextTier, nextSessions] = await Promise.all([
        apiFetch<UserProfile>("/api/v1/auth/me", { credentials: "include" }),
        apiFetch<SkillTierSummary>("/api/v1/player/skill-tier", { credentials: "include" }),
        apiFetch<Session[]>(`/api/v1/player/discovery/sessions${query ? `?${query}` : ""}`, {
          credentials: "include",
        }),
      ]);
      setUser(nextUser);
      setSkillTier(nextTier);
      setSessions(nextSessions);
      setMessage(`Có ${nextSessions.length} khung giờ đang được xếp theo độ phù hợp.`);
    } catch (caught) {
      setUser(null);
      setSkillTier(null);
      setSessions([]);
      setError(errorMessage(caught, "Không tải được danh sách sân"));
      setMessage("Bạn cần đăng nhập Google để xem và đặt sân.");
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

  const stats = useMemo(() => {
    const poolCount = sessions.filter((item) => item.post_type === "pool").length;
    const rentalCount = sessions.filter((item) => item.post_type === "rental").length;
    const openSlotCount = sessions.reduce((total, item) => total + item.open_slots, 0);
    return { poolCount, rentalCount, openSlotCount };
  }, [sessions]);

  const heroTitle =
    variant === "owner" ? "Xem thị trường đặt sân như người chơi." : "Tìm sân, ghép kèo hoặc bao sân trong vài bước.";
  const heroDescription =
    variant === "owner"
      ? "Góc nhìn thị trường giúp chủ sân kiểm tra cách các phiên sân đang hiển thị với người chơi."
      : "NetUp ưu tiên khung giờ dựa trên level, khu vực quen thuộc và số slot còn trống để bạn chọn nhanh hơn.";

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow={variant === "owner" ? "NetUp thị trường" : "NetUp người chơi"}
        title={heroTitle}
        description={heroDescription}
        actions={
          <>
            <ButtonLink href="/player/assessment" variant="outline">
              Cập nhật level
            </ButtonLink>
            <ButtonLink href="/player/bookings" variant="outline">
              Booking của tôi
            </ButtonLink>
          </>
        }
        aside={
          <div
            className="min-h-[220px] rounded-lg bg-cover bg-center"
            style={{
              backgroundImage:
                "linear-gradient(130deg, rgba(15,23,42,0.22), rgba(127,29,29,0.38)), url('/courts/badminton1.jpg')",
            }}
            aria-hidden="true"
          />
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Khung giờ phù hợp" value={sessions.length} helper={message} tone="accent" />
        <StatCard label="Kèo chờ ghép" value={stats.poolCount} helper="Có thể tham gia theo slot" />
        <StatCard label="Thuê nguyên sân" value={stats.rentalCount} helper="Phù hợp nhóm riêng" />
        <StatCard
          label="Slot còn trống"
          value={stats.openSlotCount}
          helper={skillTier ? `Level của bạn: ${skillTier.visible_skill_tier}` : "Cần đăng nhập"}
          tone={stats.openSlotCount > 0 ? "success" : "warning"}
        />
      </div>

      <Card>
        <form onSubmit={onFilterSubmit} className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto]">
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
              placeholder="Ví dụ: Hà Đông"
            />
          </Field>
          <Field label="Kiểu đặt">
            <select
              className={inputClassName}
              value={postType}
              onChange={(event) => setPostType(event.target.value as PostTypeFilter)}
            >
              {postTypeOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex flex-col justify-end gap-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={openOnly}
                onChange={(event) => setOpenOnly(event.target.checked)}
              />
              Chỉ hiện còn slot
            </label>
            <Button disabled={isLoading}>{isLoading ? "Đang lọc..." : "Lọc sân"}</Button>
          </div>
        </form>
      </Card>

      {error ? (
        <Notice tone="danger">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <a className="font-semibold underline" href={`${API_BASE_URL}/api/v1/auth/google/start`}>
              Đăng nhập Google
            </a>
          </div>
        </Notice>
      ) : null}

      {sessions.length === 0 && !isLoading ? (
        <EmptyState
          title="Chưa có khung giờ phù hợp"
          description="Thử đổi môn, khu vực hoặc tắt bộ lọc còn slot để xem thêm lựa chọn."
          action={<Button onClick={() => void loadDiscovery()}>Tải lại danh sách</Button>}
        />
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {sessions.map((session) => {
            const image = courtImageForSport(session.sport);
            const open = hasOpenSlots(session);
            return (
              <article key={session.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <div
                  className="relative min-h-[180px] bg-cover bg-center"
                  style={{
                    backgroundImage: `linear-gradient(130deg, rgba(15,23,42,0.22), rgba(127,29,29,0.38)), url('${image}')`,
                  }}
                >
                  <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                    <Badge className="bg-white/95 text-slate-800">{postTypeLabel(session.post_type)}</Badge>
                    <Badge tone={open ? "success" : "warning"} className="bg-white/95">
                      {open ? `Còn ${session.open_slots}/${session.max_slots} slot` : "Hết slot"}
                    </Badge>
                  </div>
                  <div className="absolute bottom-3 left-3 right-3">
                    <h2 className="font-heading text-xl font-semibold text-white drop-shadow">{session.sub_court_name}</h2>
                    <p className="text-sm font-medium text-white/95 drop-shadow">{session.complex_name}</p>
                  </div>
                </div>

                <div className="space-y-4 p-5">
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={recommendationTone(session.recommendation_label)}>
                      {recommendationLabel(session.recommendation_label)}
                      {session.recommendation_score ? ` · ${session.recommendation_score}` : ""}
                    </Badge>
                    <Badge tone="neutral">{sportLabel(session.sport)}</Badge>
                    {session.is_peak_hour ? <Badge tone="warning">Giờ cao điểm</Badge> : null}
                  </div>

                  <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                    <p>
                      <span className="font-semibold text-slate-950">Thời gian:</span>{" "}
                      {formatTimeRange(session.starts_at, session.duration_minutes)}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-950">Khu vực:</span> {session.district}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-950">Giá ghép:</span>{" "}
                      {formatVnd(session.slot_price_vnd)}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-950">Bao sân:</span>{" "}
                      {formatVnd(session.full_court_price_vnd)}
                    </p>
                  </div>

                  <p className="text-sm leading-6 text-slate-600">{session.address}</p>

                  <div className="flex flex-wrap gap-2">
                    <ButtonLink href={`/player/booking?sessionId=${session.id}`} variant={open ? "primary" : "outline"}>
                      {session.post_type === "pool" ? "Tham gia kèo" : "Đặt sân"}
                    </ButtonLink>
                    {session.pool_post_id ? (
                      <ButtonLink href={`/player/chat?poolPostId=${session.pool_post_id}`} variant="outline">
                        Chat nhóm
                      </ButtonLink>
                    ) : null}
                    {!skillTier?.has_assessment ? (
                      <ButtonLink href="/player/assessment" variant="ghost">
                        Làm đánh giá level
                      </ButtonLink>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
