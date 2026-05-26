"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

import {
  Badge,
  Button,
  ButtonLink,
  Card,
  Field,
  Notice,
  PageHero,
  StatCard,
  inputClassName,
} from "@/components/ui";
import { apiFetch } from "@/lib/http";
import { errorMessage, formatFullDateTime, sportLabel } from "@/lib/format";

type Sport = "Badminton" | "Football" | "Tennis";
type UploadState = "idle" | "uploading" | "analyzing" | "completed" | "failed";

type SkillTierSummary = {
  visible_skill_tier: string;
  matches_played: number;
  wins: number;
  losses: number;
  draws: number;
  updated_at: string | null;
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

type VideoAssessment = {
  assessment_id: string;
  sport: string;
  status: "uploaded" | "analyzing" | "completed" | "failed";
  llm_provider: string;
  llm_model: string | null;
  file_size_bytes: number;
  duration_seconds: number | null;
  computed_skill_tier: string | null;
  confidence: number | null;
  technical_score: number | null;
  movement_score: number | null;
  consistency_score: number | null;
  game_reading_score: number | null;
  aspect_evaluations: AspectEvaluation[];
  summary: string | null;
  strengths: string[];
  improvement_areas: string[];
  warning: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

type AssessmentSubmitResponse = {
  assessment_id: string;
  visible_skill_tier: string;
  elo_delta: number;
};

type AspectEvaluation = {
  key: string;
  label: string;
  score: number;
  tier: string;
  feedback: string;
  evidence: string;
  improvement_tip: string;
};

type FilePreview = {
  name: string;
  sizeBytes: number;
  durationSeconds: number | null;
};

type Question = {
  key: string;
  label: string;
  min: number;
  max: number;
  helper: string;
};

const sportOptions: Array<{ value: Sport; label: string }> = [
  { value: "Badminton", label: "Cầu lông" },
  { value: "Football", label: "Bóng đá" },
  { value: "Tennis", label: "Tennis" },
];

const uploadGuidelines = [
  "Quay người chơi chính toàn thân, thấy rõ động tác tay/chân.",
  "Video nên ngắn, đủ sáng, không rung mạnh và không che mặt sân.",
  "Ưu tiên vài pha xử lý liên tục thay vì chỉ đứng tạo dáng.",
];

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

function seedAnswers(nextSport: Sport): Record<string, number> {
  return Object.fromEntries(questionBySport[nextSport].map((question) => [question.key, question.min]));
}

function fileSizeLabel(sizeBytes: number) {
  if (sizeBytes >= 1024 * 1024) {
    return `${(sizeBytes / 1024 / 1024).toFixed(2)} MB`;
  }
  return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
}

function durationLabel(durationSeconds: number | null) {
  if (durationSeconds === null) return "Chưa đọc được";
  if (durationSeconds < 60) return `${Math.round(durationSeconds)} giây`;
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = Math.round(durationSeconds % 60);
  return `${minutes} phút ${seconds.toString().padStart(2, "0")} giây`;
}

function trendText(delta: number) {
  if (delta > 0) return "Tăng hạng";
  if (delta < 0) return "Cần cải thiện";
  return "Ổn định";
}

function uploadStateText(state: UploadState) {
  const labels: Record<UploadState, string> = {
    idle: "Sẵn sàng upload",
    uploading: "Đang upload video",
    analyzing: "Gemini đang phân tích",
    completed: "Đã hoàn tất",
    failed: "Cần thử lại",
  };
  return labels[state];
}

function tierLabel(value: string | null | undefined) {
  const labels: Record<string, string> = {
    Beginner: "Người mới",
    Intermediate: "Trung bình",
    Advanced: "Nâng cao",
  };
  return labels[value ?? ""] ?? value ?? "Chưa có";
}

function tierTone(value: string | null | undefined): "success" | "warning" | "info" {
  if (value === "Advanced") return "success";
  if (value === "Intermediate") return "info";
  return "warning";
}

function readBrowserDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(video.duration) ? video.duration : null);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    video.src = url;
  });
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export default function PlayerAssessmentPage() {
  const [sport, setSport] = useState<Sport>("Badminton");
  const [answers, setAnswers] = useState<Record<string, number>>(() => seedAnswers("Badminton"));
  const [summary, setSummary] = useState<SkillTierSummary | null>(null);
  const [history, setHistory] = useState<EloHistoryItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<FilePreview | null>(null);
  const [videoJob, setVideoJob] = useState<VideoAssessment | null>(null);
  const [formState, setFormState] = useState<"idle" | "submitting" | "completed">("idle");
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [message, setMessage] = useState("Hoàn thành form để NetUp khởi tạo level ban đầu.");
  const [error, setError] = useState("");

  const currentLevel = useMemo(() => {
    if (videoJob?.computed_skill_tier) return videoJob.computed_skill_tier;
    return summary?.visible_skill_tier ?? "Chưa có";
  }, [summary, videoJob]);

  const questions = questionBySport[sport];

  async function loadSummary() {
    setError("");
    try {
      const [skillTier, eloHistory] = await Promise.all([
        apiFetch<SkillTierSummary>("/api/v1/player/skill-tier", { credentials: "include" }),
        apiFetch<EloHistoryItem[]>("/api/v1/player/elo-history?limit=10", {
          credentials: "include",
        }),
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

  function selectSport(nextSport: Sport) {
    setSport(nextSport);
    setAnswers(seedAnswers(nextSport));
  }

  function updateAnswer(key: string, value: number) {
    setAnswers((current) => ({ ...current, [key]: value }));
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFormState("submitting");
    setMessage("Đang lưu đánh giá ban đầu.");

    try {
      const result = await apiFetch<AssessmentSubmitResponse>(
        "/api/v1/player/assessments",
        {
          method: "POST",
          credentials: "include",
          body: JSON.stringify({
            sport,
            form_version: "v1",
            answers,
          }),
        },
        { timeoutMs: 15000 },
      );
      setFormState("completed");
      setMessage(`Đã lưu level ban đầu: ${tierLabel(result.visible_skill_tier)}.`);
      await loadSummary();
    } catch (caught) {
      setFormState("idle");
      setError(errorMessage(caught, "Không lưu được đánh giá ban đầu"));
      setMessage("Hoàn thành form để NetUp khởi tạo level ban đầu.");
    }
  }

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setVideoJob(null);
    setUploadState("idle");
    setError("");

    if (!file) {
      setFilePreview(null);
      return;
    }

    setFilePreview({
      name: file.name,
      sizeBytes: file.size,
      durationSeconds: null,
    });
    const durationSeconds = await readBrowserDuration(file);
    setFilePreview({
      name: file.name,
      sizeBytes: file.size,
      durationSeconds,
    });
  }

  async function pollVideoAssessment(assessmentId: string) {
    for (let attempt = 0; attempt < 45; attempt += 1) {
      await delay(2000);
      const nextJob = await apiFetch<VideoAssessment>(
        `/api/v1/player/video-assessments/${assessmentId}`,
        { credentials: "include" },
      );
      setVideoJob(nextJob);
      if (nextJob.status === "completed") {
        setUploadState("completed");
        setMessage("NetUp đã cập nhật level từ video của bạn.");
        await loadSummary();
        return;
      }
      if (nextJob.status === "failed") {
        setUploadState("failed");
        setMessage("Gemini chưa phân tích được video. Vui lòng thử lại sau.");
        setError(nextJob.error_message ?? "Gemini chưa phân tích được video. Vui lòng thử lại sau.");
        return;
      }
      setUploadState("analyzing");
    }
    setUploadState("failed");
    setMessage("Job phân tích đang lâu hơn dự kiến.");
    setError("Job phân tích đang lâu hơn dự kiến. Vui lòng mở lại trang sau ít phút.");
  }

  async function submitVideo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) {
      setError("Vui lòng chọn video trước khi gửi đánh giá.");
      return;
    }

    setError("");
    setUploadState("uploading");
    setMessage("Đang upload video và tạo job đánh giá.");

    const formData = new FormData();
    formData.set("sport", sport);
    formData.set("video", selectedFile);

    try {
      const createdJob = await apiFetch<VideoAssessment>(
        "/api/v1/player/video-assessments",
        {
          method: "POST",
          credentials: "include",
          body: formData,
        },
        { timeoutMs: 30000 },
      );
      setVideoJob(createdJob);
      setUploadState(createdJob.status === "failed" ? "failed" : "analyzing");
      setMessage("Video đã được nhận. NetUp đang chờ Gemini trả kết quả.");

      if (createdJob.status === "completed") {
        setUploadState("completed");
        setMessage("NetUp đã cập nhật level từ video của bạn.");
        await loadSummary();
        return;
      }
      if (createdJob.status === "failed") {
        setMessage("Gemini chưa phân tích được video. Vui lòng thử lại sau.");
        setError(createdJob.error_message ?? "Gemini chưa phân tích được video.");
        return;
      }
      await pollVideoAssessment(createdJob.assessment_id);
    } catch (caught) {
      setUploadState("failed");
      setMessage("Không upload được video đánh giá. Vui lòng thử lại.");
      setError(errorMessage(caught, "Không upload được video đánh giá"));
    }
  }

  const heroMessage =
    summary?.has_assessment && uploadState === "idle" && !videoJob
      ? "Form ban đầu đã được lưu. Upload video khi bạn muốn AI đánh giá lại kỹ năng và cập nhật level hiện tại."
      : message;

  if (summary?.has_assessment) {
    return (
      <div className="space-y-5">
        <PageHero
          eyebrow="Đánh giá lại"
          title="Cập nhật level bằng video bất cứ lúc nào."
          description={heroMessage}
          actions={
            <>
              <ButtonLink href="/player/discovery?mode=matchmaking">Tìm kèo phù hợp</ButtonLink>
              <ButtonLink href="/player/matches" variant="outline">
                Xem lịch đấu
              </ButtonLink>
            </>
          }
          aside={
            <div className="grid gap-3 rounded-lg border border-red-100 bg-red-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-red-800">Trạng thái</p>
              <p className="font-heading text-2xl font-semibold text-red-950">{uploadStateText(uploadState)}</p>
              <p className="text-sm text-red-900">
                Level hiện tại: <span className="font-semibold">{tierLabel(currentLevel)}</span>
              </p>
            </div>
          }
        />

        {error ? <Notice tone="danger">{error}</Notice> : null}
        {videoJob?.warning ? <Notice tone="warning">{videoJob.warning}</Notice> : null}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Level hiện tại" value={tierLabel(currentLevel)} helper="Cập nhật sau video hoặc trận" tone="accent" />
          <StatCard label="Trận đã chơi" value={summary.matches_played} helper="Dữ liệu lịch đấu" />
          <StatCard label="Thắng / Hòa / Thua" value={`${summary.wins}/${summary.draws}/${summary.losses}`} />
          <StatCard
            label="Độ tin cậy"
            value={videoJob?.confidence !== null && videoJob?.confidence !== undefined ? `${Math.round(videoJob.confidence * 100)}%` : "-"}
            helper="Từ lần video gần nhất"
          />
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <form onSubmit={submitVideo} className="space-y-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <h2 className="font-heading text-xl font-semibold text-ink">Video đánh giá lại</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Upload video kỹ thuật để Gemini đánh giá 4 khía cạnh và cập nhật Elo hiện tại.
              </p>
            </div>

            <Field label="Môn thể thao">
              <select
                className={inputClassName}
                value={sport}
                onChange={(event) => selectSport(event.target.value as Sport)}
                disabled={uploadState === "uploading" || uploadState === "analyzing"}
              >
                {sportOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Video kỹ thuật">
              <input
                className={inputClassName}
                type="file"
                accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
                onChange={onFileChange}
                disabled={uploadState === "uploading" || uploadState === "analyzing"}
              />
            </Field>

            {filePreview ? (
              <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">File</p>
                  <p className="mt-1 truncate font-semibold text-slate-950">{filePreview.name}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Dung lượng</p>
                  <p className="mt-1 font-semibold text-slate-950">{fileSizeLabel(filePreview.sizeBytes)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Thời lượng</p>
                  <p className="mt-1 font-semibold text-slate-950">{durationLabel(filePreview.durationSeconds)}</p>
                </div>
              </div>
            ) : null}

            <Button disabled={!selectedFile || uploadState === "uploading" || uploadState === "analyzing"}>
              {uploadState === "uploading"
                ? "Đang upload..."
                : uploadState === "analyzing"
                  ? "Đang phân tích..."
                  : "Gửi video đánh giá lại"}
            </Button>
          </form>

          <div className="space-y-5">
            <Card className="space-y-3">
              <h2 className="font-heading text-xl font-semibold text-ink">Hướng dẫn quay video</h2>
              <div className="grid gap-3">
                {uploadGuidelines.map((item, index) => (
                  <div key={item} className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-800 text-xs font-semibold text-white">
                      {index + 1}
                    </span>
                    <p className="text-sm leading-6 text-slate-700">{item}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="space-y-3">
              <h2 className="font-heading text-xl font-semibold text-ink">Kết quả AI</h2>
              {videoJob?.status === "completed" ? (
                <div className="space-y-4 text-sm text-slate-700">
                  <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">
                      Level đề xuất
                    </p>
                    <p className="mt-1 font-heading text-2xl font-semibold text-emerald-950">
                      {tierLabel(videoJob.computed_skill_tier)}
                    </p>
                  </div>
                  <p className="leading-6">{videoJob.summary}</p>

                  {videoJob.aspect_evaluations.length > 0 ? (
                    <div>
                      <p className="font-semibold text-slate-950">Đánh giá theo khía cạnh</p>
                      <div className="mt-3 grid gap-3">
                        {videoJob.aspect_evaluations.map((aspect) => (
                          <div key={aspect.key} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold text-slate-950">{aspect.label}</p>
                                <p className="mt-1 text-sm leading-6 text-slate-600">{aspect.feedback}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge tone={tierTone(aspect.tier)}>{tierLabel(aspect.tier)}</Badge>
                                <span className="rounded-lg bg-white px-3 py-1 text-sm font-semibold text-slate-950 ring-1 ring-slate-200">
                                  {aspect.score}/100
                                </span>
                              </div>
                            </div>
                            <div className="mt-3 grid gap-2 text-xs leading-5 text-slate-600 sm:grid-cols-2">
                              <p className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
                                <span className="font-semibold text-slate-950">Quan sát: </span>
                                {aspect.evidence}
                              </p>
                              <p className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
                                <span className="font-semibold text-slate-950">Cải thiện: </span>
                                {aspect.improvement_tip}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {videoJob.strengths.length > 0 ? (
                    <div>
                      <p className="font-semibold text-slate-950">Điểm mạnh</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {videoJob.strengths.map((item) => (
                          <Badge key={item} tone="success">
                            {item}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {videoJob.improvement_areas.length > 0 ? (
                    <div>
                      <p className="font-semibold text-slate-950">Gợi ý cải thiện</p>
                      <div className="mt-2 grid gap-2">
                        {videoJob.improvement_areas.map((item) => (
                          <p key={item} className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-amber-900">
                            {item}
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm leading-6 text-slate-600">
                  Kết quả sẽ hiển thị ở đây sau khi Gemini trả về JSON hợp lệ và backend lưu đánh giá lại.
                </p>
              )}
            </Card>

            <Card className="space-y-3">
              <h2 className="font-heading text-xl font-semibold text-ink">Lịch sử cập nhật level</h2>
              {history.length === 0 ? (
                <p className="text-sm text-slate-600">Chưa có lịch sử thay đổi level.</p>
              ) : (
                <div className="grid gap-3">
                  {history.map((item) => (
                    <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-slate-900">
                          {tierLabel(item.skill_tier_before)} sang {tierLabel(item.skill_tier_after)}
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

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Onboarding ban đầu"
        title="Hoàn thành form để khởi tạo level."
        description={heroMessage}
        aside={
          <div className="grid gap-3 rounded-lg border border-red-100 bg-red-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-red-800">Trạng thái</p>
            <p className="font-heading text-2xl font-semibold text-red-950">
              {formState === "submitting" ? "Đang lưu" : formState === "completed" ? "Đã lưu" : "Chưa có level"}
            </p>
            <p className="text-sm text-red-900">
              Sau onboarding có thể đánh giá lại bằng video.
            </p>
          </div>
        }
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Level hiện tại" value="Chưa có" helper="Sẽ có sau khi gửi form" tone="accent" />
        <StatCard label="Môn đang chọn" value={sportLabel(sport)} helper="Có thể đổi trước khi gửi" />
        <StatCard label="Số câu hỏi" value={questions.length} helper="Dùng để ước lượng Elo ban đầu" />
        <StatCard label="Đánh giá lại" value="Video" helper="Mở sau khi có level ban đầu" />
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <form onSubmit={submitForm} className="space-y-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="font-heading text-xl font-semibold text-ink">Form khởi tạo level</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Form này chỉ dùng một lần để tạo Elo ban đầu cho tài khoản player.
            </p>
          </div>

          <Field label="Môn thể thao">
            <select
              className={inputClassName}
              value={sport}
              onChange={(event) => selectSport(event.target.value as Sport)}
              disabled={formState === "submitting"}
            >
              {sportOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid gap-4">
            {questions.map((question) => (
              <Field key={question.key} label={`${question.label}: ${answers[question.key] ?? question.min}`} helper={question.helper}>
                <input
                  className="w-full accent-red-800"
                  type="range"
                  min={question.min}
                  max={question.max}
                  step={1}
                  value={answers[question.key] ?? question.min}
                  onChange={(event) => updateAnswer(question.key, Number(event.target.value))}
                  disabled={formState === "submitting"}
                />
                <div className="flex justify-between text-xs font-normal text-slate-500">
                  <span>{question.min}</span>
                  <span>{question.max}</span>
                </div>
              </Field>
            ))}
          </div>

          <Button disabled={formState === "submitting"}>
            {formState === "submitting" ? "Đang lưu..." : "Lưu level ban đầu"}
          </Button>
        </form>

        <div className="space-y-5">
          <Card className="space-y-3">
            <h2 className="font-heading text-xl font-semibold text-ink">Sau khi onboard</h2>
            <div className="grid gap-3 text-sm leading-6 text-slate-700">
              <p className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                Form ban đầu sẽ bị khóa để giữ lịch sử Elo nhất quán.
              </p>
              <p className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                Bạn có thể quay lại trang này để upload video và cập nhật level bằng feedback AI.
              </p>
            </div>
          </Card>

          <Card className="space-y-3">
            <h2 className="font-heading text-xl font-semibold text-ink">Khía cạnh video sẽ đánh giá</h2>
            <div className="grid gap-3">
              {["Kỹ thuật", "Di chuyển và thể lực", "Độ ổn định", "Đọc tình huống"].map((item, index) => (
                <div key={item} className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-800 text-xs font-semibold text-white">
                    {index + 1}
                  </span>
                  <p className="text-sm leading-6 text-slate-700">{item}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
