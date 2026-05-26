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
  summary: string | null;
  strengths: string[];
  improvement_areas: string[];
  warning: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

type FilePreview = {
  name: string;
  sizeBytes: number;
  durationSeconds: number | null;
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
  const [summary, setSummary] = useState<SkillTierSummary | null>(null);
  const [history, setHistory] = useState<EloHistoryItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<FilePreview | null>(null);
  const [videoJob, setVideoJob] = useState<VideoAssessment | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [message, setMessage] = useState("Upload video để NetUp khởi tạo level ban đầu bằng AI.");
  const [error, setError] = useState("");

  const currentLevel = useMemo(() => {
    if (videoJob?.computed_skill_tier) return videoJob.computed_skill_tier;
    return summary?.visible_skill_tier ?? "Chưa có";
  }, [summary, videoJob]);

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
        setMessage("NetUp đã khởi tạo level từ video của bạn.");
        await loadSummary();
        return;
      }
      if (nextJob.status === "failed") {
        setUploadState("failed");
        setError(nextJob.error_message ?? "Gemini chưa phân tích được video. Vui lòng thử lại sau.");
        return;
      }
      setUploadState("analyzing");
    }
    setUploadState("failed");
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
        await loadSummary();
        return;
      }
      if (createdJob.status === "failed") {
        setError(createdJob.error_message ?? "Gemini chưa phân tích được video.");
        return;
      }
      await pollVideoAssessment(createdJob.assessment_id);
    } catch (caught) {
      setUploadState("failed");
      setError(errorMessage(caught, "Không upload được video đánh giá"));
    }
  }

  if (summary?.has_assessment) {
    return (
      <div className="space-y-5">
        <PageHero
          eyebrow="Elo người chơi"
          title="Level ban đầu đã được lưu cho tài khoản này."
          description="NetUp không mở lại route đánh giá ban đầu. Sau bước này level chỉ cập nhật qua kết quả trận và feedback sau trận."
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
          <h2 className="font-heading text-xl font-semibold text-ink">Lịch sử cập nhật level</h2>
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
        eyebrow="Onboarding video"
        title="Upload video để khởi tạo level ban đầu."
        description={message}
        aside={
          <div className="grid gap-3 rounded-lg border border-red-100 bg-red-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-red-800">Trạng thái</p>
            <p className="font-heading text-2xl font-semibold text-red-950">{uploadStateText(uploadState)}</p>
            <p className="text-sm text-red-900">
              Level hiện tại: <span className="font-semibold">{currentLevel}</span>
            </p>
          </div>
        }
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}
      {videoJob?.warning ? <Notice tone="warning">{videoJob.warning}</Notice> : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Level hiện tại" value={currentLevel} helper="Sẽ được lưu sau khi AI hoàn tất" tone="accent" />
        <StatCard label="Trận đã chơi" value={summary?.matches_played ?? 0} helper="Dữ liệu lịch đấu" />
        <StatCard label="Thắng / Hòa / Thua" value={`${summary?.wins ?? 0}/${summary?.draws ?? 0}/${summary?.losses ?? 0}`} />
        <StatCard
          label="Độ tin cậy"
          value={videoJob?.confidence !== null && videoJob?.confidence !== undefined ? `${Math.round(videoJob.confidence * 100)}%` : "-"}
          helper="Từ Gemini"
        />
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <form onSubmit={submitVideo} className="space-y-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="font-heading text-xl font-semibold text-ink">Video đánh giá ban đầu</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Hỗ trợ mp4, mov, webm. Giới hạn mặc định là 5MB và 60 giây, admin có thể điều chỉnh trong cấu hình hệ thống.
            </p>
          </div>

          <Field label="Môn thể thao">
            <select
              className={inputClassName}
              value={sport}
              onChange={(event) => setSport(event.target.value as Sport)}
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
                : "Gửi video đánh giá"}
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
                    {videoJob.computed_skill_tier}
                  </p>
                </div>
                <p className="leading-6">{videoJob.summary}</p>

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

                <div className="flex flex-wrap gap-2">
                  <ButtonLink href="/player/discovery?mode=matchmaking">Tìm kèo phù hợp</ButtonLink>
                  <ButtonLink href="/player/bookings" variant="outline">
                    Xem booking
                  </ButtonLink>
                </div>
              </div>
            ) : (
              <p className="text-sm leading-6 text-slate-600">
                Kết quả sẽ hiển thị ở đây sau khi Gemini trả về JSON hợp lệ và backend lưu level ban đầu.
              </p>
            )}
          </Card>
        </div>
      </section>
    </div>
  );
}
