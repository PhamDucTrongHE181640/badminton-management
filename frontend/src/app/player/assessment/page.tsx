"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { Badge, Button, ButtonLink, Card, Field, Notice, PageHero, StatCard, inputClassName } from "@/components/ui";
import { apiFetch } from "@/lib/http";
import { errorMessage, formatFullDateTime, sportLabel } from "@/lib/format";

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
  helper: string;
};

const questionBySport: Record<Sport, Question[]> = {
  Badminton: [
    { key: "racket_control", label: "Kiểm soát cầu", min: 1, max: 5, helper: "Khả năng điều cầu đúng ý." },
    { key: "footwork", label: "Di chuyển chân", min: 1, max: 5, helper: "Độ linh hoạt khi đổi hướng." },
    { key: "stamina", label: "Thể lực", min: 1, max: 5, helper: "Giữ nhịp trong cả trận." },
    { key: "match_reading", label: "Đọc tình huống", min: 1, max: 5, helper: "Chọn vị trí và xử lý pha cầu." },
    { key: "weekly_sessions", label: "Số buổi mỗi tuần", min: 0, max: 14, helper: "Tần suất chơi gần đây." },
    { key: "experience_years", label: "Số năm kinh nghiệm", min: 0, max: 20, helper: "Kinh nghiệm thi đấu hoặc luyện tập." },
  ],
  Football: [
    { key: "ball_control", label: "Kiểm soát bóng", min: 1, max: 5, helper: "Giữ bóng và xử lý bước một." },
    { key: "tactical_awareness", label: "Tư duy chiến thuật", min: 1, max: 5, helper: "Đọc vị trí và khoảng trống." },
    { key: "team_play", label: "Phối hợp đội", min: 1, max: 5, helper: "Di chuyển và chuyền theo đội." },
    { key: "stamina", label: "Thể lực", min: 1, max: 5, helper: "Duy trì cường độ trong trận." },
    { key: "weekly_sessions", label: "Số buổi mỗi tuần", min: 0, max: 14, helper: "Tần suất chơi gần đây." },
    { key: "experience_years", label: "Số năm kinh nghiệm", min: 0, max: 20, helper: "Kinh nghiệm thi đấu hoặc luyện tập." },
  ],
  Tennis: [
    { key: "serve_consistency", label: "Ổn định giao bóng", min: 1, max: 5, helper: "Tỷ lệ giao bóng vào sân." },
    { key: "rally_control", label: "Duy trì rally", min: 1, max: 5, helper: "Khả năng giữ bóng qua lại." },
    { key: "footwork", label: "Di chuyển chân", min: 1, max: 5, helper: "Tiếp cận bóng đúng nhịp." },
    { key: "mental_focus", label: "Tập trung thi đấu", min: 1, max: 5, helper: "Giữ ổn định khi điểm căng." },
    { key: "weekly_sessions", label: "Số buổi mỗi tuần", min: 0, max: 14, helper: "Tần suất chơi gần đây." },
    { key: "experience_years", label: "Số năm kinh nghiệm", min: 0, max: 20, helper: "Kinh nghiệm thi đấu hoặc luyện tập." },
  ],
};

function seedAnswers(sport: Sport): Record<string, number> {
  return Object.fromEntries(questionBySport[sport].map((question) => [question.key, question.min]));
}

function trendText(delta: number) {
  if (delta > 0) return "Tăng hạng";
  if (delta < 0) return "Cần cải thiện";
  return "Ổn định";
}

export default function PlayerAssessmentPage() {
  const [sport, setSport] = useState<Sport>("Badminton");
  const [answers, setAnswers] = useState<Record<string, number>>(seedAnswers("Badminton"));
  const [summary, setSummary] = useState<SkillTierSummary | null>(null);
  const [history, setHistory] = useState<EloHistoryItem[]>([]);
  const [message, setMessage] = useState("Thiết lập trình độ ban đầu để NetUp khởi tạo Elo cho tài khoản.");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const questions = useMemo(() => questionBySport[sport], [sport]);

  async function loadSummary() {
    setError("");
    try {
      const [skillTier, eloHistory] = await Promise.all([
        apiFetch<SkillTierSummary>("/api/v1/player/skill-tier", { credentials: "include" }),
        apiFetch<EloHistoryItem[]>("/api/v1/player/elo-history?limit=10", { credentials: "include" }),
      ]);
      setSummary(skillTier);
      setHistory(eloHistory);
    } catch (caught) {
      setSummary(null);
      setHistory([]);
      setError(errorMessage(caught, "Không tải được dữ liệu trình độ"));
    }
  }

  useEffect(() => {
    void loadSummary();
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
        credentials: "include",
        body: JSON.stringify({
          sport,
          form_version: "v1",
          answers,
        }),
      });
      setMessage("Đã lưu Elo ban đầu. Từ bây giờ level chỉ cập nhật qua feedback và lịch sử trận đấu.");
      await loadSummary();
    } catch (caught) {
      setError(errorMessage(caught, "Không lưu được Elo ban đầu"));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (summary?.has_assessment) {
    return (
      <div className="space-y-5">
        <PageHero
          eyebrow="Elo người chơi"
          title="Elo ban đầu đã được lưu cho tài khoản này."
          description="NetUp không mở lại bước đánh giá ban đầu. Từ bây giờ level chỉ được cập nhật qua feedback và lịch sử trận đấu."
          actions={
            <>
              <ButtonLink href="/player/discovery?mode=matchmaking">Tìm kèo phù hợp</ButtonLink>
              <ButtonLink href="/player/matches" variant="outline">
                Xem lịch đấu
              </ButtonLink>
            </>
          }
        />

        {error ? <Notice tone="danger">{error}</Notice> : null}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Level hiện tại" value={summary.visible_skill_tier} helper="Cập nhật sau trận" tone="accent" />
          <StatCard label="Trận đã chơi" value={summary.matches_played} helper="Dữ liệu lịch đấu" />
          <StatCard label="Thắng / Hòa / Thua" value={`${summary.wins}/${summary.draws}/${summary.losses}`} />
          <StatCard
            label="Thiết lập ban đầu"
            value={summary.last_assessment ? sportLabel(summary.last_assessment.sport) : "Đã lưu"}
            helper={summary.last_assessment ? formatFullDateTime(summary.last_assessment.updated_at) : undefined}
          />
        </section>

        <Card className="space-y-3">
          <h2 className="font-heading text-xl font-semibold text-ink">Lịch sử cập nhật Elo</h2>
          {history.length === 0 ? (
            <p className="text-sm text-slate-600">Chưa có lịch sử thay đổi level.</p>
          ) : (
            <div className="grid gap-3">
              {history.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">
                      {item.skill_tier_before} sang {item.skill_tier_after}
                    </p>
                    <Badge tone={item.delta >= 0 ? "success" : "warning"}>{trendText(item.delta)}</Badge>
                  </div>
                  <p className="mt-1 text-slate-600">{formatFullDateTime(item.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Onboarding người chơi"
        title="Thiết lập trình độ ban đầu một lần."
        description={message}
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Level hiện tại"
          value={summary?.visible_skill_tier ?? "Chưa có"}
          helper="Sẽ được lưu vào Elo"
          tone="accent"
        />
        <StatCard label="Trận đã chơi" value={summary?.matches_played ?? 0} helper="Dữ liệu lịch đấu" />
        <StatCard label="Thắng / Hòa / Thua" value={`${summary?.wins ?? 0}/${summary?.draws ?? 0}/${summary?.losses ?? 0}`} />
        <StatCard
          label="Thiết lập ban đầu"
          value={summary?.last_assessment ? sportLabel(summary.last_assessment.sport) : "Chưa có"}
          helper={summary?.last_assessment ? formatFullDateTime(summary.last_assessment.updated_at) : undefined}
        />
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <form onSubmit={onSubmit} className="space-y-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="font-heading text-xl font-semibold text-ink">Thiết lập Elo ban đầu</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Bước này chỉ thực hiện một lần sau khi đăng nhập lần đầu. NetUp không hiển thị điểm Elo thô cho người chơi.
            </p>
          </div>

          <Field label="Môn thể thao">
            <select
              className={inputClassName}
              value={sport}
              onChange={(event) => onSportChange(event.target.value as Sport)}
            >
              <option value="Badminton">Cầu lông</option>
              <option value="Football">Bóng đá</option>
              <option value="Tennis">Tennis</option>
            </select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            {questions.map((question) => (
              <div key={question.key} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{question.label}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{question.helper}</p>
                  </div>
                  <Badge tone="info">{answers[question.key] ?? question.min}</Badge>
                </div>
                <input
                  className="mt-4 w-full accent-red-800"
                  type="range"
                  min={question.min}
                  max={question.max}
                  value={answers[question.key] ?? question.min}
                  onChange={(event) => onAnswerChange(question.key, event.target.value)}
                />
                <div className="mt-1 flex justify-between text-xs text-slate-500">
                  <span>{question.min}</span>
                  <span>{question.max}</span>
                </div>
              </div>
            ))}
          </div>

          <Button disabled={isSubmitting}>{isSubmitting ? "Đang lưu..." : "Lưu Elo ban đầu"}</Button>
        </form>

        <div className="space-y-5">
          <Card className="space-y-3">
            <h2 className="font-heading text-xl font-semibold text-ink">Tóm tắt level</h2>
            {summary ? (
              <div className="space-y-3 text-sm text-slate-700">
                <div className="rounded-lg border border-red-100 bg-red-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-red-800">
                    Level hiển thị
                  </p>
                  <p className="mt-1 font-heading text-2xl font-semibold text-red-950">
                    {summary.visible_skill_tier}
                  </p>
                </div>
                <p>
                  Thành tích hiện tại: {summary.wins} thắng, {summary.draws} hòa, {summary.losses} thua.
                </p>
                <p>
                  Thiết lập ban đầu:{" "}
                  {summary.last_assessment
                    ? `${sportLabel(summary.last_assessment.sport)} · ${formatFullDateTime(summary.last_assessment.updated_at)}`
                    : "chưa có"}
                </p>
              </div>
            ) : (
              <p className="text-sm leading-6 text-slate-600">
                Hoàn tất bước thiết lập ban đầu để NetUp tính level hiển thị.
              </p>
            )}
          </Card>

          <Card className="space-y-3">
            <h2 className="font-heading text-xl font-semibold text-ink">Lịch sử cập nhật</h2>
            {history.length === 0 ? (
              <p className="text-sm text-slate-600">Chưa có lịch sử thay đổi level.</p>
            ) : (
              <div className="grid gap-3">
                {history.map((item) => (
                  <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-slate-900">
                        {item.skill_tier_before} sang {item.skill_tier_after}
                      </p>
                      <Badge tone={item.delta >= 0 ? "success" : "warning"}>{trendText(item.delta)}</Badge>
                    </div>
                    <p className="mt-1 text-slate-600">{formatFullDateTime(item.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </section>
    </div>
  );
}
