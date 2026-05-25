"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge, Button, Card, EmptyState, Field, Notice, inputClassName } from "@/components/ui";
import { API_BASE_URL, apiFetch } from "@/lib/http";
import {
  courtImageForSport,
  errorMessage,
  formatTimeRange,
  formatVnd,
  postTypeLabel,
  sportLabel,
} from "@/lib/format";

type UserProfile = {
  email: string;
  full_name: string;
  roles: string[];
};

type Session = {
  id: string;
  title: string;
  post_type: string;
  status: string;
  starts_at: string;
  duration_minutes: number;
  open_slots: number;
  max_slots: number;
  slot_price_vnd: number;
  full_court_price_vnd: number;
  allows_solo_join: boolean;
  court_name: string;
  sub_court_name: string;
  sport: string;
  complex_name: string;
  district: string;
  address: string;
};

const sportOptions = [
  { value: "", label: "Tất cả môn" },
  { value: "Badminton", label: "Cầu lông" },
  { value: "Football", label: "Bóng đá" },
  { value: "Tennis", label: "Tennis" },
];

function loginUrl() {
  return `${API_BASE_URL}/api/v1/auth/google/start`;
}

export default function HomePage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sport, setSport] = useState("");
  const [district, setDistrict] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function loadSessions(nextSport = sport, nextDistrict = district) {
    setIsLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ has_open_slots: "true" });
      if (nextSport) params.set("sport", nextSport);
      if (nextDistrict.trim()) params.set("district", nextDistrict.trim());
      const payload = await apiFetch<Session[]>(`/api/v1/public/discovery/sessions?${params.toString()}`);
      setSessions(payload);
    } catch (caught) {
      setSessions([]);
      setError(errorMessage(caught, "Không tải được danh sách sân"));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const profile = await apiFetch<UserProfile>("/api/v1/auth/me", {
          credentials: "include",
        });
        if (!cancelled) setUser(profile);
      } catch {
        if (!cancelled) setUser(null);
      }
      if (!cancelled) void loadSessions("", "");
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  async function logout() {
    setIsLoggingOut(true);
    try {
      await apiFetch("/api/v1/auth/logout", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({}),
      });
      setUser(null);
    } finally {
      setIsLoggingOut(false);
    }
  }

  const featuredSession = sessions[0] ?? null;
  const visibleSessions = useMemo(() => sessions.slice(0, 12), [sessions]);

  return (
    <main className="fade-up space-y-6">
      <section className="grid gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-[1fr_420px] lg:p-7">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-800">NetUp</p>
          <h1 className="mt-3 max-w-4xl font-heading text-3xl font-semibold leading-tight text-ink sm:text-5xl">
            Tìm sân trống và đặt lịch chơi ngay.
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
            Chọn kèo chờ ghép hoặc thuê nguyên sân theo môn, khu vực và khung giờ phù hợp. Bạn có thể xem sân trước,
            đăng nhập khi bắt đầu đặt lịch.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {user ? (
              <>
                <Badge tone="success">Đã đăng nhập: {user.full_name}</Badge>
                <Button variant="outline" onClick={logout} disabled={isLoggingOut}>
                  {isLoggingOut ? "Đang đăng xuất..." : "Đăng xuất"}
                </Button>
              </>
            ) : (
              <a
                href={loginUrl()}
                className="inline-flex items-center justify-center rounded-lg border border-red-800 bg-white px-4 py-2 text-sm font-semibold text-red-800 shadow-sm transition hover:bg-red-50"
              >
                Đăng nhập để đặt sân
              </a>
            )}
          </div>
        </div>

        <div
          className="min-h-[260px] rounded-lg bg-cover bg-center"
          style={{
            backgroundImage: `linear-gradient(130deg, rgba(15,23,42,0.18), rgba(127,29,29,0.34)), url('${courtImageForSport(
              featuredSession?.sport,
            )}')`,
          }}
          aria-hidden="true"
        />
      </section>

      <Card>
        <form
          className="grid gap-3 md:grid-cols-[220px_1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            void loadSessions();
          }}
        >
          <Field label="Môn thể thao">
            <select className={inputClassName} value={sport} onChange={(event) => setSport(event.target.value)}>
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
              placeholder="Nhập quận/huyện, ví dụ Hà Đông"
            />
          </Field>
          <div className="flex items-end">
            <Button className="w-full md:w-auto" disabled={isLoading}>
              {isLoading ? "Đang tìm..." : "Tìm sân"}
            </Button>
          </div>
        </form>
      </Card>

      {error ? <Notice tone="danger">{error}</Notice> : null}

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-heading text-2xl font-semibold text-ink">Sân đang mở đặt lịch</h2>
            <p className="mt-1 text-sm text-slate-600">
              {isLoading ? "Đang cập nhật danh sách sân..." : `${visibleSessions.length} khung giờ có thể đặt`}
            </p>
          </div>
          {user ? (
            <a className="text-sm font-semibold text-red-800 hover:underline" href="/player/bookings">
              Xem booking của tôi
            </a>
          ) : null}
        </div>

        {visibleSessions.length === 0 && !isLoading ? (
          <EmptyState
            title="Chưa có sân phù hợp"
            description="Thử đổi môn, khu vực hoặc quay lại sau khi chủ sân mở thêm khung giờ."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleSessions.map((session) => {
              const href = user ? `/player/booking?sessionId=${session.id}` : loginUrl();
              return (
                <article key={session.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                  <div
                    className="relative min-h-[170px] bg-cover bg-center"
                    style={{
                      backgroundImage: `linear-gradient(130deg, rgba(15,23,42,0.2), rgba(127,29,29,0.38)), url('${courtImageForSport(
                        session.sport,
                      )}')`,
                    }}
                  >
                    <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                      <Badge className="bg-white/95 text-slate-800">{postTypeLabel(session.post_type)}</Badge>
                      <Badge tone="success" className="bg-white/95">
                        Còn {session.open_slots}/{session.max_slots} slot
                      </Badge>
                    </div>
                    <div className="absolute bottom-3 left-3 right-3">
                      <h3 className="font-heading text-xl font-semibold text-white drop-shadow">
                        {session.sub_court_name}
                      </h3>
                      <p className="text-sm font-medium text-white/95 drop-shadow">{session.complex_name}</p>
                    </div>
                  </div>

                  <div className="space-y-3 p-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="neutral">{sportLabel(session.sport)}</Badge>
                      <Badge tone="info">{session.district}</Badge>
                    </div>
                    <div className="grid gap-2 text-sm text-slate-700">
                      <p>
                        <span className="font-semibold text-slate-950">Thời gian:</span>{" "}
                        {formatTimeRange(session.starts_at, session.duration_minutes)}
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
                    <p className="line-clamp-2 text-sm leading-6 text-slate-600">{session.address}</p>
                    <a
                      href={href}
                      className="inline-flex w-full items-center justify-center rounded-lg bg-red-800 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-900"
                    >
                      {user ? "Đặt sân" : "Đăng nhập để đặt sân"}
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
