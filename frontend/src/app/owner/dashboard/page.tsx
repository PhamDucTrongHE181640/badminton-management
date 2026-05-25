"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { Badge, Button, ButtonLink, Card, Field, Notice, PageHero, StatCard, inputClassName } from "@/components/ui";
import { API_BASE_URL, apiFetch } from "@/lib/http";
import { errorMessage, formatFullDateTime, requestStatusLabel } from "@/lib/format";

type UserProfile = {
  email: string;
  full_name: string;
  roles: string[];
};

type OwnerRequest = {
  id: string;
  business_name: string;
  contact_phone: string | null;
  facility_overview: string | null;
  status: string;
  submitted_at: string;
  reviewed_at: string | null;
  review_note: string | null;
};

type CourtComplex = { id: string };
type Court = { id: string; status: string };
type Session = { id: string; starts_at: string; open_slots: number; max_slots: number };
type Checkin = { id: string };

function requestTone(status: string | undefined): "success" | "warning" | "danger" | "neutral" {
  if (status === "approved") return "success";
  if (status === "pending") return "warning";
  if (status === "rejected") return "danger";
  return "neutral";
}

export default function OwnerDashboardPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [requests, setRequests] = useState<OwnerRequest[]>([]);
  const [complexes, setComplexes] = useState<CourtComplex[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [businessName, setBusinessName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [facilityOverview, setFacilityOverview] = useState("");
  const [message, setMessage] = useState("Đang tải thông tin chủ sân...");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const latestRequest = useMemo(() => requests[0] ?? null, [requests]);
  const isOwner = Boolean(user?.roles.includes("owner") || latestRequest?.status === "approved");

  async function loadDashboard() {
    setError("");
    try {
      const [nextUser, nextRequests] = await Promise.all([
        apiFetch<UserProfile>("/api/v1/auth/me", { credentials: "include" }),
        apiFetch<OwnerRequest[]>("/api/v1/owner/requests/me", { credentials: "include" }),
      ]);
      setUser(nextUser);
      setRequests(nextRequests);

      if (nextUser.roles.includes("owner") || nextRequests[0]?.status === "approved") {
        const [nextComplexes, nextCourts, nextSessions, nextCheckins] = await Promise.allSettled([
          apiFetch<CourtComplex[]>("/api/v1/owner/court-complexes", { credentials: "include" }),
          apiFetch<Court[]>("/api/v1/owner/courts", { credentials: "include" }),
          apiFetch<Session[]>("/api/v1/owner/sessions", { credentials: "include" }),
          apiFetch<Checkin[]>("/api/v1/owner/checkins", { credentials: "include" }),
        ]);
        setComplexes(nextComplexes.status === "fulfilled" ? nextComplexes.value : []);
        setCourts(nextCourts.status === "fulfilled" ? nextCourts.value : []);
        setSessions(nextSessions.status === "fulfilled" ? nextSessions.value : []);
        setCheckins(nextCheckins.status === "fulfilled" ? nextCheckins.value : []);
      }
      setMessage("Khu vực chủ sân đã sẵn sàng.");
    } catch (caught) {
      setUser(null);
      setRequests([]);
      setComplexes([]);
      setCourts([]);
      setSessions([]);
      setCheckins([]);
      setError(errorMessage(caught, "Không kết nối được API chủ sân"));
      setMessage("Bạn cần đăng nhập Google trước khi đăng ký hoặc vận hành sân.");
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function submitOwnerRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await apiFetch<OwnerRequest>("/api/v1/owner/requests", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({
          business_name: businessName,
          contact_phone: contactPhone || null,
          facility_overview: facilityOverview || null,
        }),
      });
      setBusinessName("");
      setContactPhone("");
      setFacilityOverview("");
      await loadDashboard();
    } catch (caught) {
      setError(errorMessage(caught, "Không gửi được hồ sơ chủ sân"));
    } finally {
      setIsSubmitting(false);
    }
  }

  const upcomingSessions = sessions.filter((item) => new Date(item.starts_at) > new Date()).length;
  const activeCourts = courts.filter((item) => item.status === "active").length;
  const openSlots = sessions.reduce((total, item) => total + item.open_slots, 0);

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="NetUp chủ sân"
        title="Quản lý hồ sơ, sân và check-in tại quầy."
        description={message}
        actions={
          <>
            {user ? (
              <>
                <ButtonLink href="/owner/courts">Quản lý sân</ButtonLink>
                <ButtonLink href="/owner/check-in" variant="outline">
                  Mở check-in
                </ButtonLink>
              </>
            ) : (
              <a
                href={`${API_BASE_URL}/api/v1/auth/google/start`}
                className="inline-flex items-center justify-center rounded-lg bg-red-800 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-900"
              >
                Đăng nhập Google
              </a>
            )}
          </>
        }
        aside={
          <div
            className="min-h-[220px] rounded-lg bg-cover bg-center"
            style={{
              backgroundImage:
                "linear-gradient(130deg, rgba(15,23,42,0.2), rgba(127,29,29,0.34)), url('/courts/tennis1.jpg')",
            }}
            aria-hidden="true"
          />
        }
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Cụm sân" value={complexes.length} helper="Địa điểm đang quản lý" />
        <StatCard label="Sân hoạt động" value={`${activeCourts}/${courts.length}`} helper="Sân sẵn sàng nhận lịch" tone="accent" />
        <StatCard label="Khung giờ sắp tới" value={upcomingSessions} helper={`${openSlots} slot còn trống`} />
        <StatCard label="Check-in" value={checkins.length} helper="Lượt đã xác nhận tại sân" tone="success" />
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Tài khoản</p>
            <h2 className="mt-2 font-heading text-xl font-semibold text-ink">
              {user?.full_name ?? "Chưa đăng nhập"}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{user?.email ?? "Không có phiên đăng nhập"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(user?.roles ?? ["guest"]).map((role) => (
              <Badge key={role} tone={role === "owner" ? "success" : "neutral"}>
                {role}
              </Badge>
            ))}
          </div>
          {isOwner ? (
            <Notice tone="success">Tài khoản đã có quyền vận hành sân trên NetUp.</Notice>
          ) : (
            <Notice tone="info">Sau khi admin duyệt, bạn sẽ mở được quản lý sân và check-in.</Notice>
          )}
        </Card>

        <Card className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Hồ sơ chủ sân</p>
              <h2 className="mt-2 font-heading text-xl font-semibold text-ink">
                {latestRequest ? requestStatusLabel(latestRequest.status) : "Chưa gửi yêu cầu"}
              </h2>
            </div>
            {latestRequest ? (
              <Badge tone={requestTone(latestRequest.status)}>{requestStatusLabel(latestRequest.status)}</Badge>
            ) : null}
          </div>

          {latestRequest ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-950">{latestRequest.business_name}</p>
              <p className="mt-1">Điện thoại: {latestRequest.contact_phone ?? "chưa có"}</p>
              <p className="mt-1">{latestRequest.facility_overview ?? "Chưa có mô tả cơ sở"}</p>
              <p className="mt-2 text-slate-500">Gửi lúc: {formatFullDateTime(latestRequest.submitted_at)}</p>
              {latestRequest.review_note ? (
                <Notice tone="warning" className="mt-3">
                  Ghi chú duyệt: {latestRequest.review_note}
                </Notice>
              ) : null}
            </div>
          ) : null}

          {user && !isOwner && latestRequest?.status !== "pending" ? (
            <form onSubmit={submitOwnerRequest} className="grid gap-4">
              <Field label="Tên cơ sở kinh doanh">
                <input className={inputClassName} value={businessName} onChange={(event) => setBusinessName(event.target.value)} required />
              </Field>
              <Field label="Số điện thoại liên hệ">
                <input className={inputClassName} value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} />
              </Field>
              <Field label="Mô tả cơ sở">
                <textarea
                  className={`${inputClassName} min-h-28`}
                  value={facilityOverview}
                  onChange={(event) => setFacilityOverview(event.target.value)}
                  placeholder="Số lượng sân, môn thể thao, khu vực phục vụ..."
                />
              </Field>
              <Button disabled={isSubmitting}>{isSubmitting ? "Đang gửi..." : "Gửi yêu cầu chủ sân"}</Button>
            </form>
          ) : null}
        </Card>
      </section>
    </div>
  );
}
