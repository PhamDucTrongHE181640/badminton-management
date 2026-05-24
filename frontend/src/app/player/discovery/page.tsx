"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

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
  slot_price_vnd: number;
  full_court_price_vnd: number;
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

const sportOptions = ["", "Badminton", "Football", "Tennis"];

function money(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

export default function PlayerDiscoveryPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [skillTier, setSkillTier] = useState<SkillTierSummary | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("Đang tải dữ liệu discovery...");
  const [isLoading, setIsLoading] = useState(false);

  const [sport, setSport] = useState("");
  const [district, setDistrict] = useState("");
  const [hasOpenSlots, setHasOpenSlots] = useState(true);

  async function apiFetch<T>(path: string): Promise<T> {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });
    const payload = response.status === 204 ? null : await response.json();
    if (!response.ok) {
      const detail = payload?.error?.details?.[0];
      throw new Error(detail?.field ? `${detail.field}: ${detail.message}` : payload?.error?.message);
    }
    return payload as T;
  }

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (sport) params.set("sport", sport);
    if (district.trim()) params.set("district", district.trim());
    params.set("has_open_slots", hasOpenSlots ? "true" : "false");
    return params.toString();
  }, [district, hasOpenSlots, sport]);

  async function loadDiscovery() {
    setIsLoading(true);
    setError("");
    try {
      const [nextUser, nextTier, nextSessions] = await Promise.all([
        apiFetch<UserProfile>("/api/v1/auth/me"),
        apiFetch<SkillTierSummary>("/api/v1/player/skill-tier"),
        apiFetch<Session[]>(`/api/v1/player/discovery/sessions${query ? `?${query}` : ""}`),
      ]);
      setUser(nextUser);
      setSkillTier(nextTier);
      setSessions(nextSessions);
      setMessage(
        `Đang hiển thị ${nextSessions.length} phiên sân được ưu tiên theo tier + khoảng cách + slot`
      );
    } catch (caught) {
      setSessions([]);
      setUser(null);
      setSkillTier(null);
      setError(caught instanceof Error ? caught.message : "Không tải được discovery");
      setMessage("Vui lòng đăng nhập Google để dùng khu vực người chơi");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadDiscovery();
  }, [query]);

  function onFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    loadDiscovery();
  }

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-slate-950">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">
              NetUp Người chơi
            </p>
            <h1 className="mt-2 text-3xl font-semibold">Discovery và đặt sân</h1>
            <p className="mt-2 text-sm text-slate-600">{message}</p>
            {user ? (
              <p className="mt-1 text-sm text-slate-600">
                {user.full_name} · {user.email}
              </p>
            ) : null}
            {skillTier ? (
              <p className="mt-1 text-sm text-slate-700">
                Tier hiện tại:{" "}
                <span className="font-semibold">{skillTier.visible_skill_tier}</span>
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              href="/player/assessment"
            >
              Assessment
            </Link>
            <Link
              className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              href="/player/bookings"
            >
              Booking của tôi
            </Link>
            <Link
              className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              href="/player/matches"
            >
              Match history
            </Link>
            <Link
              className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              href="/"
            >
              Trang chính
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-6 lg:px-8">
        <form
          onSubmit={onFilterSubmit}
          className="grid gap-3 rounded border border-slate-200 bg-white p-5 lg:grid-cols-4"
        >
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Môn thể thao
            <select
              className="rounded border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-900"
              value={sport}
              onChange={(event) => setSport(event.target.value)}
            >
              {sportOptions.map((item) => (
                <option key={item} value={item}>
                  {item || "Tất cả"}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Quận/Huyện
            <input
              className="rounded border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-900"
              value={district}
              onChange={(event) => setDistrict(event.target.value)}
              placeholder="Ví dụ: Hà Đông"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Trạng thái slot
            <select
              className="rounded border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-900"
              value={hasOpenSlots ? "open" : "full"}
              onChange={(event) => setHasOpenSlots(event.target.value === "open")}
            >
              <option value="open">Còn slot</option>
              <option value="full">Hết slot</option>
            </select>
          </label>
          <button
            className="mt-6 rounded bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-400 lg:mt-7"
            disabled={isLoading}
          >
            {isLoading ? "Đang lọc..." : "Áp dụng bộ lọc"}
          </button>
        </form>
      </section>

      {error ? (
        <section className="mx-auto max-w-7xl px-6 pb-4 lg:px-8">
          <p className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        </section>
      ) : null}

      <section className="mx-auto grid max-w-7xl gap-4 px-6 pb-10 lg:grid-cols-2 lg:px-8">
        {sessions.map((item) => (
          <article key={item.id} className="rounded border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">{item.title}</h2>
              <span className="rounded border border-slate-300 bg-slate-50 px-2 py-1 text-xs font-semibold uppercase text-slate-700">
                {item.post_type}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              {item.complex_name} · {item.court_name} - {item.sub_court_name}
            </p>
            <p className="mt-1 text-sm text-slate-600">{item.district}</p>
            <p className="mt-1 text-sm text-slate-600">
              {new Date(item.starts_at).toLocaleString("vi-VN")} · {item.duration_minutes} phút
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {item.open_slots}/{item.max_slots} slot · {money(item.slot_price_vnd)}đ/slot ·{" "}
              {money(item.full_court_price_vnd)}đ/nguyên sân
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Đề xuất:{" "}
              <span className="font-semibold text-slate-800">
                {item.recommendation_label ?? "n/a"}
              </span>{" "}
              · Điểm: {item.recommendation_score ?? 0}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                className="rounded bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                href={`/player/booking?sessionId=${item.id}`}
              >
                Đặt sân
              </Link>
              {item.pool_post_id ? (
                <Link
                  className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
                  href={`/player/chat?poolPostId=${item.pool_post_id}`}
                >
                  Vào chat pool
                </Link>
              ) : null}
              <span className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                Tier của bạn: {item.player_skill_tier ?? skillTier?.visible_skill_tier ?? "Beginner"}
              </span>
              <span className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700">
                {item.sport}
              </span>
              {item.allows_solo_join ? null : (
                <span className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Không cho solo
                </span>
              )}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
