"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type Sport = "Badminton" | "Football" | "Tennis";

type SkillTierSummary = {
  visible_skill_tier: string;
  matches_played: number;
  wins: number;
  losses: number;
  draws: number;
  has_assessment: boolean;
  last_assessment: {
    sport: string;
    form_version: string;
    updated_at: string;
  } | null;
};

type EloHistoryItem = {
  id: string;
  delta: number;
  reason: string;
  algorithm_version: string;
  created_at: string;
  skill_tier_before: string;
  skill_tier_after: string;
};

type Question = {
  key: string;
  label: string;
  min: number;
  max: number;
};

const questionBySport: Record<Sport, Question[]> = {
  Badminton: [
    { key: "racket_control", label: "Kiểm soát cầu", min: 1, max: 5 },
    { key: "footwork", label: "Di chuyển chân", min: 1, max: 5 },
    { key: "stamina", label: "Thể lực", min: 1, max: 5 },
    { key: "match_reading", label: "Đọc tình huống", min: 1, max: 5 },
    { key: "weekly_sessions", label: "Số buổi/tuần", min: 0, max: 14 },
    { key: "experience_years", label: "Số năm kinh nghiệm", min: 0, max: 20 },
  ],
  Football: [
    { key: "ball_control", label: "Kiểm soát bóng", min: 1, max: 5 },
    { key: "tactical_awareness", label: "Tư duy chiến thuật", min: 1, max: 5 },
    { key: "team_play", label: "Phối hợp đội", min: 1, max: 5 },
    { key: "stamina", label: "Thể lực", min: 1, max: 5 },
    { key: "weekly_sessions", label: "Số buổi/tuần", min: 0, max: 14 },
    { key: "experience_years", label: "Số năm kinh nghiệm", min: 0, max: 20 },
  ],
  Tennis: [
    { key: "serve_consistency", label: "Ổn định giao bóng", min: 1, max: 5 },
    { key: "rally_control", label: "Duy trì rally", min: 1, max: 5 },
    { key: "footwork", label: "Di chuyển chân", min: 1, max: 5 },
    { key: "mental_focus", label: "Tập trung thi đấu", min: 1, max: 5 },
    { key: "weekly_sessions", label: "Số buổi/tuần", min: 0, max: 14 },
    { key: "experience_years", label: "Số năm kinh nghiệm", min: 0, max: 20 },
  ],
};

function seedAnswers(sport: Sport): Record<string, number> {
  return Object.fromEntries(questionBySport[sport].map((question) => [question.key, question.min]));
}

export default function PlayerAssessmentPage() {
  const [sport, setSport] = useState<Sport>("Badminton");
  const [answers, setAnswers] = useState<Record<string, number>>(seedAnswers("Badminton"));
  const [summary, setSummary] = useState<SkillTierSummary | null>(null);
  const [history, setHistory] = useState<EloHistoryItem[]>([]);
  const [message, setMessage] = useState("Hoàn tất assessment để hệ thống đề xuất kèo phù hợp.");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const questions = useMemo(() => questionBySport[sport], [sport]);

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

  async function loadSummary() {
    setError("");
    try {
      const [skillTier, eloHistory] = await Promise.all([
        apiFetch<SkillTierSummary>("/api/v1/player/skill-tier"),
        apiFetch<EloHistoryItem[]>("/api/v1/player/elo-history?limit=10"),
      ]);
      setSummary(skillTier);
      setHistory(eloHistory);
    } catch (caught) {
      setSummary(null);
      setHistory([]);
      setError(caught instanceof Error ? caught.message : "Không tải được dữ liệu assessment");
    }
  }

  useEffect(() => {
    loadSummary();
  }, []);

  function onSportChange(nextSport: Sport) {
    setSport(nextSport);
    setAnswers(seedAnswers(nextSport));
  }

  function onAnswerChange(key: string, value: string) {
    const numeric = Number(value);
    setAnswers((previous) => ({ ...previous, [key]: Number.isFinite(numeric) ? numeric : 0 }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    try {
      await apiFetch("/api/v1/player/assessments", {
        method: "POST",
        body: JSON.stringify({
          sport,
          form_version: "v1",
          answers,
        }),
      });
      setMessage("Assessment đã lưu. Tier hiển thị đã được cập nhật.");
      await loadSummary();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không lưu được assessment");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-slate-950">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">
              NetUp Assessment
            </p>
            <h1 className="mt-2 text-3xl font-semibold">Đánh giá năng lực người chơi</h1>
            <p className="mt-2 text-sm text-slate-600">{message}</p>
            {summary ? (
              <p className="mt-1 text-sm text-slate-700">
                Tier hiện tại: <span className="font-semibold">{summary.visible_skill_tier}</span>
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

      <section className="mx-auto grid max-w-6xl gap-5 px-6 py-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
        <form onSubmit={onSubmit} className="rounded border border-slate-200 bg-white p-5">
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Môn thể thao
            <select
              className="rounded border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-900"
              value={sport}
              onChange={(event) => onSportChange(event.target.value as Sport)}
            >
              <option value="Badminton">Badminton</option>
              <option value="Football">Football</option>
              <option value="Tennis">Tennis</option>
            </select>
          </label>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {questions.map((question) => (
              <label key={question.key} className="grid gap-2 text-sm font-semibold text-slate-700">
                {question.label}
                <input
                  className="rounded border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-900"
                  type="number"
                  min={question.min}
                  max={question.max}
                  value={answers[question.key] ?? question.min}
                  onChange={(event) => onAnswerChange(question.key, event.target.value)}
                />
              </label>
            ))}
          </div>

          <button
            className="mt-5 rounded bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-400"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Đang lưu assessment..." : "Lưu assessment"}
          </button>
        </form>

        <div className="rounded border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Tóm tắt tier</h2>
          {summary ? (
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              <p>
                Tier hiển thị: <span className="font-semibold">{summary.visible_skill_tier}</span>
              </p>
              <p>
                Trận đã chơi: {summary.matches_played} · W/L/D: {summary.wins}/{summary.losses}/
                {summary.draws}
              </p>
              <p>
                Assessment gần nhất:{" "}
                {summary.last_assessment
                  ? `${summary.last_assessment.sport} · ${new Date(
                      summary.last_assessment.updated_at
                    ).toLocaleString("vi-VN")}`
                  : "chưa có"}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-600">Chưa có dữ liệu.</p>
          )}

          <h3 className="mt-5 text-base font-semibold">Lịch sử biến động tier</h3>
          <div className="mt-3 grid gap-2">
            {history.length === 0 ? (
              <p className="text-sm text-slate-600">Chưa có lịch sử.</p>
            ) : (
              history.map((item) => (
                <div key={item.id} className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p className="font-semibold text-slate-900">
                    {item.skill_tier_before} → {item.skill_tier_after}
                  </p>
                  <p className="mt-1 text-slate-700">
                    Delta: {item.delta > 0 ? `+${item.delta}` : item.delta}
                  </p>
                  <p className="mt-1 text-slate-600">{new Date(item.created_at).toLocaleString("vi-VN")}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {error ? (
        <section className="mx-auto max-w-6xl px-6 pb-6 lg:px-8">
          <p className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        </section>
      ) : null}
    </main>
  );
}
