"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type UserProfile = {
  id: string;
  full_name: string;
  email: string;
};

type SkillTierSummary = {
  visible_skill_tier: string;
  matches_played: number;
  wins: number;
  losses: number;
  draws: number;
};

type BookingSummary = {
  id: string;
  session_id: string;
  session_title: string | null;
  session_starts_at: string | null;
  status: string;
};

type MatchParticipant = {
  id: string;
  match_id: string;
  booking_id: string | null;
  player_user_id: string;
  player_full_name: string | null;
  team_side: number;
  result: string | null;
};

type MatchFeedback = {
  id: string;
  match_id: string;
  from_user_id: string;
  from_user_name: string | null;
  to_user_id: string;
  to_user_name: string | null;
  target_type: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

type MatchDetail = {
  id: string;
  session_id: string;
  session_title: string;
  status: string;
  team_a_score: number | null;
  team_b_score: number | null;
  finalized_at: string | null;
  participants: MatchParticipant[];
  feedback: MatchFeedback[];
};

type MatchHistoryItem = {
  match_id: string;
  session_id: string;
  session_title: string;
  status: string;
  team_a_score: number | null;
  team_b_score: number | null;
  finalized_at: string | null;
  my_result: string | null;
  my_team_side: number;
  feedback_given_count: number;
  feedback_received_count: number;
  feedback_received_avg: number | null;
  elo_delta: number | null;
  skill_tier_before: string | null;
  skill_tier_after: string | null;
};

type FinalizeResponse = {
  match: MatchDetail;
  elo_updates: {
    player_user_id: string;
    player_full_name: string;
    team_side: number;
    result: string;
    old_elo: number;
    new_elo: number;
    delta: number;
    skill_tier_before: string;
    skill_tier_after: string;
    feedback_received_count: number;
    feedback_received_avg: number | null;
  }[];
};

function scoreLabel(aScore: number | null, bScore: number | null): string {
  if (aScore === null || bScore === null) return "-";
  return `${aScore} - ${bScore}`;
}

export default function PlayerMatchesPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [tierSummary, setTierSummary] = useState<SkillTierSummary | null>(null);
  const [bookings, setBookings] = useState<BookingSummary[]>([]);
  const [history, setHistory] = useState<MatchHistoryItem[]>([]);
  const [activeMatch, setActiveMatch] = useState<MatchDetail | null>(null);
  const [lastFinalize, setLastFinalize] = useState<FinalizeResponse | null>(null);

  const [sessionId, setSessionId] = useState("");
  const [teamAScore, setTeamAScore] = useState("21");
  const [teamBScore, setTeamBScore] = useState("19");

  const [targetUserId, setTargetUserId] = useState("");
  const [targetType, setTargetType] = useState<"teammate" | "opponent">("opponent");
  const [feedbackRating, setFeedbackRating] = useState("5");
  const [feedbackComment, setFeedbackComment] = useState("");

  const [message, setMessage] = useState("Đang tải dữ liệu Sprint 6...");
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);

  async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
    const payload = response.status === 204 ? null : await response.json();
    if (!response.ok) {
      const detail = payload?.error?.details?.[0];
      throw new Error(detail?.field ? `${detail.field}: ${detail.message}` : payload?.error?.message);
    }
    return payload as T;
  }

  async function bootstrap() {
    setError("");
    setMessage("Đang đồng bộ dữ liệu match, booking và tier...");
    try {
      const [nextUser, nextTier, nextHistory, nextBookings] = await Promise.all([
        apiFetch<UserProfile>("/api/v1/auth/me"),
        apiFetch<SkillTierSummary>("/api/v1/player/skill-tier"),
        apiFetch<MatchHistoryItem[]>("/api/v1/player/matches/history/list?limit=20"),
        apiFetch<BookingSummary[]>("/api/v1/player/bookings"),
      ]);
      setUser(nextUser);
      setTierSummary(nextTier);
      setHistory(nextHistory);
      setBookings(nextBookings);
      if (!sessionId && nextBookings.length > 0) {
        setSessionId(nextBookings[0].session_id);
      }
      setMessage(`Đã tải ${nextHistory.length} match trong lịch sử người chơi.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không tải được dữ liệu match");
      setMessage("Cần đăng nhập để quản lý match.");
      setUser(null);
      setTierSummary(null);
      setHistory([]);
      setBookings([]);
    }
  }

  useEffect(() => {
    bootstrap();
  }, []);

  const feedbackTargets = useMemo(() => {
    if (!activeMatch || !user) return [];
    return activeMatch.participants.filter((item) => item.player_user_id !== user.id);
  }, [activeMatch, user]);

  async function createMatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLastFinalize(null);
    if (!sessionId) {
      setError("Vui lòng chọn session trước khi tạo match.");
      return;
    }

    setIsCreating(true);
    try {
      const created = await apiFetch<MatchDetail>("/api/v1/player/matches", {
        method: "POST",
        body: JSON.stringify({
          session_id: sessionId,
          team_a_score: Number(teamAScore),
          team_b_score: Number(teamBScore),
        }),
      });
      setActiveMatch(created);
      setTargetUserId("");
      setMessage(`Đã tạo match ${created.id}. Bây giờ bạn có thể nhập feedback và finalize.`);
      await bootstrap();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không tạo được match");
    } finally {
      setIsCreating(false);
    }
  }

  async function loadMatchDetail(matchId: string) {
    setError("");
    setLastFinalize(null);
    try {
      const detail = await apiFetch<MatchDetail>(`/api/v1/player/matches/${matchId}`);
      setActiveMatch(detail);
      setMessage(`Đã mở match ${matchId}.`);
      setTargetUserId("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không mở được match chi tiết");
    }
  }

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!activeMatch) {
      setError("Chưa có match đang mở.");
      return;
    }
    if (!targetUserId) {
      setError("Vui lòng chọn người nhận feedback.");
      return;
    }

    setIsSendingFeedback(true);
    try {
      await apiFetch(`/api/v1/player/matches/${activeMatch.id}/feedback`, {
        method: "POST",
        body: JSON.stringify({
          to_user_id: targetUserId,
          target_type: targetType,
          rating: Number(feedbackRating),
          comment: feedbackComment.trim() || null,
        }),
      });
      const refreshed = await apiFetch<MatchDetail>(`/api/v1/player/matches/${activeMatch.id}`);
      setActiveMatch(refreshed);
      setFeedbackComment("");
      setMessage("Đã lưu feedback thành công.");
      await bootstrap();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không gửi được feedback");
    } finally {
      setIsSendingFeedback(false);
    }
  }

  async function finalizeMatch() {
    if (!activeMatch) return;
    setError("");
    setIsFinalizing(true);
    try {
      const result = await apiFetch<FinalizeResponse>(`/api/v1/player/matches/${activeMatch.id}/finalize`, {
        method: "POST",
      });
      setLastFinalize(result);
      setActiveMatch(result.match);
      setMessage("Đã finalize match và cập nhật Elo thành công.");
      await bootstrap();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không finalize được match");
    } finally {
      setIsFinalizing(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-slate-950">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">
              NetUp Sprint 6
            </p>
            <h1 className="mt-2 text-3xl font-semibold">Match Result, Feedback và Elo</h1>
            <p className="mt-2 text-sm text-slate-600">{message}</p>
            {user ? (
              <p className="mt-1 text-sm text-slate-700">
                {user.full_name} · {user.email}
              </p>
            ) : null}
            {tierSummary ? (
              <p className="mt-1 text-sm text-slate-700">
                Tier: <span className="font-semibold">{tierSummary.visible_skill_tier}</span> · W/L/D: {" "}
                {tierSummary.wins}/{tierSummary.losses}/{tierSummary.draws}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              href="/player/discovery"
            >
              Discovery
            </Link>
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
          </div>
        </div>
      </section>

      {error ? (
        <section className="mx-auto max-w-7xl px-6 py-4 lg:px-8">
          <p className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        </section>
      ) : null}

      <section className="mx-auto grid max-w-7xl gap-5 px-6 py-6 lg:grid-cols-[1fr_1fr] lg:px-8">
        <form onSubmit={createMatch} className="rounded border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Tạo match event</h2>
          <p className="mt-1 text-sm text-slate-600">
            Chọn session đã chơi, nhập tỷ số team A/B để mở luồng feedback và finalize.
          </p>
          <label className="mt-4 grid gap-2 text-sm font-semibold text-slate-700">
            Session
            <select
              className="rounded border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-900"
              value={sessionId}
              onChange={(event) => setSessionId(event.target.value)}
            >
              <option value="">Chọn session từ booking của bạn</option>
              {bookings.map((item) => (
                <option key={item.id} value={item.session_id}>
                  {(item.session_title || "Phiên sân")} · {item.session_starts_at
                    ? new Date(item.session_starts_at).toLocaleString("vi-VN")
                    : "n/a"}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Team A score
              <input
                className="rounded border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-900"
                type="number"
                min={0}
                value={teamAScore}
                onChange={(event) => setTeamAScore(event.target.value)}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Team B score
              <input
                className="rounded border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-900"
                type="number"
                min={0}
                value={teamBScore}
                onChange={(event) => setTeamBScore(event.target.value)}
              />
            </label>
          </div>
          <button
            className="mt-5 rounded bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-400"
            disabled={isCreating}
          >
            {isCreating ? "Đang tạo match..." : "Tạo match"}
          </button>
        </form>

        <div className="rounded border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Chi tiết match đang mở</h2>
          {!activeMatch ? (
            <p className="mt-3 text-sm text-slate-600">Chưa có match được chọn.</p>
          ) : (
            <>
              <p className="mt-3 text-sm text-slate-700">
                Match: <span className="font-semibold">{activeMatch.id}</span>
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {activeMatch.session_title} · Score: {scoreLabel(activeMatch.team_a_score, activeMatch.team_b_score)}
              </p>
              <p className="mt-1 text-sm text-slate-700">Trạng thái: {activeMatch.status}</p>

              <h3 className="mt-4 text-sm font-semibold text-slate-900">Participants</h3>
              <div className="mt-2 grid gap-2">
                {activeMatch.participants.map((item) => (
                  <div key={item.id} className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
                    <p className="font-semibold text-slate-900">
                      {item.player_full_name || item.player_user_id}
                    </p>
                    <p className="text-slate-700">
                      Team {item.team_side} · Result: {item.result || "pending"}
                    </p>
                  </div>
                ))}
              </div>

              <button
                className="mt-4 rounded bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:bg-emerald-300"
                disabled={activeMatch.status === "finalized" || isFinalizing}
                onClick={finalizeMatch}
              >
                {isFinalizing ? "Đang finalize..." : "Finalize match + cập nhật Elo"}
              </button>
            </>
          )}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-6 pb-6 lg:grid-cols-[1fr_1fr] lg:px-8">
        <form onSubmit={submitFeedback} className="rounded border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Gửi feedback participant</h2>
          <label className="mt-4 grid gap-2 text-sm font-semibold text-slate-700">
            Người nhận feedback
            <select
              className="rounded border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-900"
              value={targetUserId}
              onChange={(event) => setTargetUserId(event.target.value)}
            >
              <option value="">Chọn participant</option>
              {feedbackTargets.map((item) => (
                <option key={item.id} value={item.player_user_id}>
                  {item.player_full_name || item.player_user_id} (team {item.team_side})
                </option>
              ))}
            </select>
          </label>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Target type
              <select
                className="rounded border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-900"
                value={targetType}
                onChange={(event) => setTargetType(event.target.value as "teammate" | "opponent")}
              >
                <option value="opponent">opponent</option>
                <option value="teammate">teammate</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Rating (1-5)
              <input
                className="rounded border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-900"
                type="number"
                min={1}
                max={5}
                value={feedbackRating}
                onChange={(event) => setFeedbackRating(event.target.value)}
              />
            </label>
          </div>

          <label className="mt-3 grid gap-2 text-sm font-semibold text-slate-700">
            Bình luận
            <textarea
              className="min-h-24 rounded border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-900"
              value={feedbackComment}
              onChange={(event) => setFeedbackComment(event.target.value)}
              placeholder="Feedback ngắn sau trận"
            />
          </label>

          <button
            className="mt-5 rounded bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-400"
            disabled={!activeMatch || isSendingFeedback}
          >
            {isSendingFeedback ? "Đang gửi feedback..." : "Gửi feedback"}
          </button>

          <h3 className="mt-5 text-sm font-semibold text-slate-900">Feedback đã ghi nhận</h3>
          <div className="mt-2 grid gap-2">
            {activeMatch?.feedback?.length ? (
              activeMatch.feedback.map((item) => (
                <div key={item.id} className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p className="font-semibold text-slate-900">
                    {item.from_user_name || item.from_user_id} → {item.to_user_name || item.to_user_id}
                  </p>
                  <p className="text-slate-700">
                    {item.target_type} · {item.rating}/5
                  </p>
                  <p className="text-slate-600">{item.comment || "Không có nhận xét"}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-600">Chưa có feedback.</p>
            )}
          </div>
        </form>

        <div className="rounded border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Lịch sử match + tier change</h2>
          <div className="mt-3 grid gap-3">
            {history.length === 0 ? (
              <p className="text-sm text-slate-600">Chưa có match history.</p>
            ) : (
              history.map((item) => (
                <article key={item.match_id} className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p className="font-semibold text-slate-900">{item.session_title}</p>
                  <p className="mt-1 text-slate-700">
                    Match {item.match_id} · Team {item.my_team_side} · Result: {item.my_result || "pending"}
                  </p>
                  <p className="mt-1 text-slate-700">
                    Score: {scoreLabel(item.team_a_score, item.team_b_score)} · Status: {item.status}
                  </p>
                  <p className="mt-1 text-slate-700">
                    Tier: {item.skill_tier_before || "-"} → {item.skill_tier_after || "-"} · Elo delta:{" "}
                    {item.elo_delta === null ? "-" : item.elo_delta > 0 ? `+${item.elo_delta}` : item.elo_delta}
                  </p>
                  <p className="mt-1 text-slate-600">
                    Feedback gửi/nhận: {item.feedback_given_count}/{item.feedback_received_count} · Avg nhận:{" "}
                    {item.feedback_received_avg ?? "-"}
                  </p>
                  <button
                    className="mt-3 rounded border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-white"
                    onClick={() => loadMatchDetail(item.match_id)}
                  >
                    Mở match này
                  </button>
                </article>
              ))
            )}
          </div>

          {lastFinalize ? (
            <div className="mt-5 rounded border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <p className="font-semibold">Kết quả finalize gần nhất</p>
              <div className="mt-2 grid gap-2">
                {lastFinalize.elo_updates.map((item) => (
                  <p key={item.player_user_id}>
                    {item.player_full_name}: {item.old_elo} → {item.new_elo} ({item.delta > 0 ? `+${item.delta}` : item.delta})
                  </p>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
