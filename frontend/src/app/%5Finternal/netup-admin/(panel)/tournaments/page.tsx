"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge, Button, Card, Field, Notice, PageHero, StatCard, inputClassName } from "@/components/ui";
import { errorMessage, formatFullDateTime, formatNumber, formatVnd } from "@/lib/format";

import { adminFetch } from "../../_lib/auth";

type Tournament = {
  id: string;
  title: string;
  sport: string;
  status: "upcoming" | "ongoing" | "completed";
  startDate: string;
  endDate: string;
  location: string;
  joinedTeams: number;
  maxTeams: number;
  prizeMoney: number;
  fee: number;
  level: "movement" | "semi_pro" | "pro";
};

type RegistrationStatus = "pending" | "registered" | "cancelled";

type AdminRegistration = {
  id: string;
  status: RegistrationStatus;
  teamName: string;
  player1: string;
  player2: string | null;
  createdAt: string;
  tournamentId: string;
  tournamentTitle: string;
  contactPhone: string;
  contactEmail: string;
  reviewedAt: string | null;
  reviewNote: string | null;
  profile: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    city: string | null;
    district: string | null;
    visible_skill_tier: string;
    elo_value: number;
    matches_played: number;
    wins: number;
    losses: number;
    draws: number;
  };
};

const statusOptions: Array<{ value: "" | RegistrationStatus; label: string }> = [
  { value: "", label: "Tất cả đơn" },
  { value: "pending", label: "Chờ thanh toán" },
  { value: "registered", label: "Đã duyệt" },
  { value: "cancelled", label: "Đã hủy" },
];

function registrationStatusLabel(status: RegistrationStatus) {
  if (status === "registered") return "Đã xác nhận";
  if (status === "cancelled") return "Đã hủy";
  return "Chờ thanh toán";
}

function statusTone(status: RegistrationStatus): "success" | "warning" | "danger" {
  if (status === "registered") return "success";
  if (status === "cancelled") return "danger";
  return "warning";
}

function skillLabel(value: string) {
  if (value === "Advanced") return "Nâng cao";
  if (value === "Intermediate") return "Trung bình";
  return "Người mới";
}

function initial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export default function AdminTournamentsPage() {
  const router = useRouter();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [registrations, setRegistrations] = useState<AdminRegistration[]>([]);
  const [registrationStatus, setRegistrationStatus] = useState<"" | RegistrationStatus>("pending");
  const [selectedTournamentId, setSelectedTournamentId] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [message, setMessage] = useState("Đang tải dữ liệu giải đấu...");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [sport, setSport] = useState("Cầu lông");
  const [startDate, setStartDate] = useState("25/06/2026");
  const [endDate, setEndDate] = useState("02/07/2026");
  const [location, setLocation] = useState("");
  const [maxTeams, setMaxTeams] = useState("16");
  const [prizeMoney, setPrizeMoney] = useState("10000000");
  const [fee, setFee] = useState("150000");
  const [level, setLevel] = useState<"movement" | "semi_pro" | "pro">("movement");
  const [image, setImage] = useState("");
  const [description, setDescription] = useState("");

  const pendingCount = useMemo(() => registrations.filter((item) => item.status === "pending").length, [registrations]);
  const approvedCount = useMemo(() => registrations.filter((item) => item.status === "registered").length, [registrations]);
  const activeTeams = useMemo(() => tournaments.reduce((total, item) => total + item.joinedTeams, 0), [tournaments]);

  async function loadData(nextStatus = registrationStatus, nextTournamentId = selectedTournamentId) {
    setIsLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (nextStatus) params.set("status", nextStatus);
      if (nextTournamentId) params.set("tournament_id", nextTournamentId);
      const [nextTournaments, nextRegistrations] = await Promise.all([
        adminFetch<Tournament[]>("/api/v1/admin/tournaments"),
        adminFetch<AdminRegistration[]>(`/api/v1/admin/tournaments/registrations${params.toString() ? `?${params.toString()}` : ""}`),
      ]);
      setTournaments(nextTournaments);
      setRegistrations(nextRegistrations);
      setMessage(`Đã tải ${nextRegistrations.length} đơn đăng ký giải đấu.`);
    } catch (caught) {
      const nextError = errorMessage(caught, "Không tải được dữ liệu giải đấu");
      if (nextError === "admin_unauthorized") {
        router.push("/_internal/netup-admin/login");
        return;
      }
      setError(nextError);
      setMessage("Không thể tải dữ liệu giải đấu.");
      setTournaments([]);
      setRegistrations([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function createTournament(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsCreating(true);
    try {
      await adminFetch<Tournament>("/api/v1/admin/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          sport,
          startDate,
          endDate,
          location,
          maxTeams: Number(maxTeams),
          prizeMoney: Number(prizeMoney),
          fee: Number(fee),
          level,
          image: image || null,
          description: description || null,
        }),
      });
      setTitle("");
      setLocation("");
      setDescription("");
      setImage("");
      setMessage("Đã tạo giải đấu mới.");
      await loadData();
    } catch (caught) {
      setError(errorMessage(caught, "Không tạo được giải đấu"));
    } finally {
      setIsCreating(false);
    }
  }

  async function reviewRegistration(registrationId: string, nextStatus: "registered" | "cancelled") {
    setReviewingId(registrationId);
    setError("");
    try {
      const updated = await adminFetch<AdminRegistration>(`/api/v1/admin/tournaments/registrations/${registrationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, reviewNote: reviewNote || null }),
      });
      setRegistrations((current) =>
        current
          .map((item) => (item.id === updated.id ? updated : item))
          .filter((item) => !registrationStatus || item.status === registrationStatus),
      );
      setReviewNote("");
      setMessage(nextStatus === "registered" ? "Đã xác nhận thanh toán thủ công." : "Đã hủy đơn đăng ký.");
      await loadData();
    } catch (caught) {
      setError(errorMessage(caught, "Không xử lý được đơn đăng ký"));
    } finally {
      setReviewingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Quản trị giải đấu"
        title="Tạo giải và duyệt đơn đăng ký của thí sinh."
        description={message}
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Giải đấu" value={formatNumber(tournaments.length)} helper={`${activeTeams} đội giữ slot`} tone="accent" />
        <StatCard label="Đơn chờ duyệt" value={formatNumber(pendingCount)} helper="Cần check thanh toán" tone="warning" />
        <StatCard label="Đã xác nhận" value={formatNumber(approvedCount)} helper="Thanh toán thủ công" tone="success" />
        <StatCard label="Tổng giải thưởng" value={formatVnd(tournaments.reduce((total, item) => total + item.prizeMoney, 0))} helper="Các giải đang có" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <form onSubmit={createTournament} className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="font-heading text-xl font-semibold text-slate-950">Tạo giải đấu</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">Chỉ admin có quyền đăng giải lên marketplace.</p>
          </div>

          <Field label="Tên giải">
            <input className={inputClassName} value={title} onChange={(event) => setTitle(event.target.value)} required />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Môn">
              <select className={inputClassName} value={sport} onChange={(event) => setSport(event.target.value)}>
                <option value="Cầu lông">Cầu lông</option>
                <option value="Tennis">Tennis</option>
                <option value="Pickleball">Pickleball</option>
                <option value="Bóng đá">Bóng đá</option>
              </select>
            </Field>
            <Field label="Cấp độ">
              <select className={inputClassName} value={level} onChange={(event) => setLevel(event.target.value as typeof level)}>
                <option value="movement">Phong trào</option>
                <option value="semi_pro">Bán chuyên</option>
                <option value="pro">Chuyên nghiệp</option>
              </select>
            </Field>
            <Field label="Ngày bắt đầu">
              <input className={inputClassName} value={startDate} onChange={(event) => setStartDate(event.target.value)} required />
            </Field>
            <Field label="Ngày kết thúc">
              <input className={inputClassName} value={endDate} onChange={(event) => setEndDate(event.target.value)} required />
            </Field>
            <Field label="Số đội tối đa">
              <input className={inputClassName} type="number" min={1} value={maxTeams} onChange={(event) => setMaxTeams(event.target.value)} required />
            </Field>
            <Field label="Lệ phí">
              <input className={inputClassName} type="number" min={0} value={fee} onChange={(event) => setFee(event.target.value)} required />
            </Field>
          </div>

          <Field label="Địa điểm">
            <input className={inputClassName} value={location} onChange={(event) => setLocation(event.target.value)} required />
          </Field>
          <Field label="Giải thưởng">
            <input className={inputClassName} type="number" min={0} value={prizeMoney} onChange={(event) => setPrizeMoney(event.target.value)} required />
          </Field>
          <Field label="Banner URL">
            <input className={inputClassName} value={image} onChange={(event) => setImage(event.target.value)} placeholder="Để trống dùng ảnh mặc định" />
          </Field>
          <Field label="Mô tả">
            <textarea className={`${inputClassName} min-h-24`} value={description} onChange={(event) => setDescription(event.target.value)} />
          </Field>

          <Button disabled={isCreating}>{isCreating ? "Đang tạo..." : "Đăng giải đấu"}</Button>
        </form>

        <div className="space-y-5">
          <Card className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-heading text-xl font-semibold text-slate-950">Đơn đăng ký thí sinh</h2>
                <p className="mt-1 text-sm text-slate-600">Đơn mới ở trạng thái chờ thanh toán để admin kiểm tra thủ công.</p>
              </div>
              <Badge tone="info">{isLoading ? "Đang tải" : `${registrations.length} đơn`}</Badge>
            </div>

            <div className="grid gap-3 lg:grid-cols-[220px_1fr_auto]">
              <Field label="Trạng thái">
                <select
                  className={inputClassName}
                  value={registrationStatus}
                  onChange={(event) => {
                    const next = event.target.value as "" | RegistrationStatus;
                    setRegistrationStatus(next);
                    void loadData(next, selectedTournamentId);
                  }}
                >
                  {statusOptions.map((item) => (
                    <option key={item.value || "all"} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Giải đấu">
                <select
                  className={inputClassName}
                  value={selectedTournamentId}
                  onChange={(event) => {
                    setSelectedTournamentId(event.target.value);
                    void loadData(registrationStatus, event.target.value);
                  }}
                >
                  <option value="">Tất cả giải</option>
                  {tournaments.map((item) => (
                    <option key={item.id} value={item.id}>{item.title}</option>
                  ))}
                </select>
              </Field>
              <div className="flex items-end">
                <Button type="button" variant="outline" onClick={() => void loadData()}>
                  Tải lại
                </Button>
              </div>
            </div>

            <Field label="Ghi chú duyệt">
              <input
                className={inputClassName}
                value={reviewNote}
                onChange={(event) => setReviewNote(event.target.value)}
                placeholder="Ví dụ: Đã nhận chuyển khoản 150.000đ"
              />
            </Field>
          </Card>

          <div className="grid gap-3">
            {registrations.length === 0 ? (
              <Card>
                <p className="text-sm font-semibold text-slate-600">Chưa có đơn đăng ký theo bộ lọc hiện tại.</p>
              </Card>
            ) : (
              registrations.map((item) => (
                <article key={item.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      {item.profile.avatar_url ? (
                        <img src={item.profile.avatar_url} alt={item.profile.full_name} className="h-12 w-12 rounded-full object-cover" />
                      ) : (
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-sm font-black text-slate-600">
                          {initial(item.profile.full_name)}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="font-heading text-base font-semibold text-slate-950">{item.teamName}</p>
                        <p className="mt-1 text-sm text-slate-600">
                          {item.player1}{item.player2 ? ` & ${item.player2}` : ""}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">{item.tournamentTitle}</p>
                      </div>
                    </div>
                    <Badge tone={statusTone(item.status)}>{registrationStatusLabel(item.status)}</Badge>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-3">
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Liên hệ</p>
                      <p className="mt-1 font-semibold text-slate-950">{item.contactPhone}</p>
                      <p className="mt-1 break-all text-xs text-slate-600">{item.contactEmail}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Profile</p>
                      <p className="mt-1 font-semibold text-slate-950">{item.profile.full_name}</p>
                      <p className="mt-1 text-xs text-slate-600">
                        {skillLabel(item.profile.visible_skill_tier)} · ELO {item.profile.elo_value} · {item.profile.matches_played} trận
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Thời gian</p>
                      <p className="mt-1 font-semibold text-slate-950">{formatFullDateTime(item.createdAt)}</p>
                      <p className="mt-1 text-xs text-slate-600">{[item.profile.district, item.profile.city].filter(Boolean).join(", ") || "Chưa có khu vực"}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                    <p className="text-xs text-slate-500">
                      {item.reviewedAt ? `Đã xử lý: ${formatFullDateTime(item.reviewedAt)}` : "Chưa xử lý"}
                      {item.reviewNote ? ` · ${item.reviewNote}` : ""}
                    </p>
                    <div className="flex gap-2">
                      {item.status === "pending" ? (
                        <>
                          <Button
                            size="sm"
                            disabled={reviewingId === item.id}
                            onClick={() => void reviewRegistration(item.id, "registered")}
                          >
                            Xác nhận đã thanh toán
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={reviewingId === item.id}
                            onClick={() => void reviewRegistration(item.id, "cancelled")}
                          >
                            Hủy đơn
                          </Button>
                        </>
                      ) : (
                        <Badge tone={statusTone(item.status)}>{registrationStatusLabel(item.status)}</Badge>
                      )}
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
