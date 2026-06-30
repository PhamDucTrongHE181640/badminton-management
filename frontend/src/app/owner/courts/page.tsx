"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { Badge, Button, ButtonLink, Card, EmptyState, Field, Notice, PageHero, StatCard, inputClassName } from "@/components/ui";
import { apiFetch } from "@/lib/http";
import { courtImageForSport, errorMessage, formatTimeRange, formatVnd, postTypeLabel, sportLabel } from "@/lib/format";

type CourtComplex = {
  id: string;
  name: string;
  district: string;
  address: string;
};

type Court = {
  id: string;
  complex_id: string;
  name: string;
  sub_court_name: string;
  sport: string;
  status: string;
  image_url: string | null;
  amenities: string[];
  base_price_vnd: number;
  max_rental_duration_minutes: number;
  complex_name: string | null;
  district: string | null;
};

type Session = {
  id: string;
  court_id: string;
  title: string;
  description: string | null;
  post_type: "pool" | "rental";
  status: string;
  image_url: string | null;
  starts_at: string;
  duration_minutes: number;
  open_slots: number;
  max_slots: number;
  required_skill_min: string;
  required_skill_max: string;
  slot_price_vnd: number;
  full_court_price_vnd: number;
  court_name: string | null;
  complex_name: string | null;
};

type OwnerPostQuota = {
  rental_post_limit: number;
  slot_post_limit: number;
  rental_posts_used: number;
  slot_posts_used: number;
  rental_posts_remaining: number;
  slot_posts_remaining: number;
};

type PostKind = "rental" | "pool";

const sportOptions = ["Badminton", "Football", "Tennis"];
const durationOptions = [30, 60, 90, 120, 150, 180, 210, 240, 270, 300];
const skillOptions = ["Beginner", "Intermediate", "Advanced"];

function localDateTimeValue(minutesFromNow: number) {
  const date = new Date(Date.now() + minutesFromNow * 60 * 1000);
  date.setSeconds(0, 0);
  return date.toISOString().slice(0, 16);
}

function imageForPost(session: Session, courts: Court[]) {
  const court = courts.find((item) => item.id === session.court_id);
  return session.image_url || court?.image_url || courtImageForSport(court?.sport ?? "Badminton");
}

function previewTimeLabel(startsAt: string, durationMinutes: string) {
  const start = new Date(startsAt);
  if (!startsAt || Number.isNaN(start.getTime())) return "Chưa chọn thời gian";
  return formatTimeRange(start.toISOString(), Number(durationMinutes) || 60);
}

function skillLabel(value: string) {
  if (value === "Advanced") return "Nâng cao";
  if (value === "Intermediate") return "Trung bình";
  return "Người mới";
}

export default function OwnerCourtsPage() {
  const [complexes, setComplexes] = useState<CourtComplex[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [quota, setQuota] = useState<OwnerPostQuota | null>(null);

  const today = new Date().toISOString().split("T")[0];
  const [targetDate, setTargetDate] = useState<string>(today);

  const [message, setMessage] = useState("Đang tải dữ liệu sân...");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [complexName, setComplexName] = useState("");
  const [district, setDistrict] = useState("");
  const [address, setAddress] = useState("");

  const [courtComplexId, setCourtComplexId] = useState("");
  const [courtName, setCourtName] = useState("");
  const [subCourtName, setSubCourtName] = useState("");
  const [sport, setSport] = useState("Badminton");
  const [courtImageUrl, setCourtImageUrl] = useState("");
  const [amenities, setAmenities] = useState("Có chỗ gửi xe, Đèn LED");
  const [basePrice, setBasePrice] = useState("120000");
  const [maxRentalDuration, setMaxRentalDuration] = useState("120");
  const [minRentalDuration, setMinRentalDuration] = useState("60");
  const [openTime, setOpenTime] = useState("05:00");
  const [closeTime, setCloseTime] = useState("22:30");

  const [postKind, setPostKind] = useState<PostKind>("rental");
  const [sessionCourtId, setSessionCourtId] = useState("");
  const [sessionTitle, setSessionTitle] = useState("");
  const [sessionDescription, setSessionDescription] = useState("");
  const [sessionImageUrl, setSessionImageUrl] = useState("");
  const [startsAt, setStartsAt] = useState(localDateTimeValue(1440));
  const [sessionDuration, setSessionDuration] = useState("60");
  const [maxSlots, setMaxSlots] = useState("4");
  const [openSlots, setOpenSlots] = useState("4");
  const [slotPrice, setSlotPrice] = useState("80000");
  const [fullCourtPrice, setFullCourtPrice] = useState("300000");
  const [skillMin, setSkillMin] = useState("Beginner");
  const [skillMax, setSkillMax] = useState("Advanced");

  const activeCourts = useMemo(() => courts.filter((court) => court.status === "active"), [courts]);
  const upcomingSessions = useMemo(
    () => sessions.filter((session) => new Date(session.starts_at) > new Date() && session.status !== "cancelled"),
    [sessions],
  );
  const selectedCourt = activeCourts.find((item) => item.id === sessionCourtId);
  const rentalPosts = upcomingSessions.filter((item) => item.post_type === "rental").length;
  const slotPosts = upcomingSessions.filter((item) => item.post_type === "pool").length;

  const groupedSessions = useMemo(() => {
    const groups: Record<string, Session[]> = {};
    sessions.forEach(session => {
      const key = session.court_name ? session.court_name : "Sân chưa rõ";
      if (!groups[key]) groups[key] = [];
      groups[key].push(session);
    });
    return groups;
  }, [sessions]);
  const [expandedCourtGroup, setExpandedCourtGroup] = useState<string | null>(null);

  async function loadInventory() {
    setError("");
    try {
      const [nextComplexes, nextCourts, nextQuota] = await Promise.all([
        apiFetch<CourtComplex[]>("/api/v1/owner/court-complexes", { credentials: "include" }),
        apiFetch<Court[]>("/api/v1/owner/courts", { credentials: "include" }),
        apiFetch<OwnerPostQuota>("/api/v1/owner/post-quota", { credentials: "include" }),
      ]);
      setComplexes(nextComplexes);
      setCourts(nextCourts);
      setQuota(nextQuota);
      setCourtComplexId((previous) => previous || nextComplexes[0]?.id || "");
      setSessionCourtId((previous) => previous || nextCourts[0]?.id || "");
      setMessage("Dữ liệu sân và quota bài đăng đã được đồng bộ.");
    } catch (caught) {
      setError(errorMessage(caught, "Không tải được dữ liệu sân"));
      setMessage("Cần tài khoản owner đã được duyệt để quản lý sân.");
    }
  }

  async function loadSessions() {
    try {
      const nextSessions = await apiFetch<Session[]>(`/api/v1/owner/sessions?target_date=${targetDate}`, { credentials: "include" });
      setSessions(nextSessions);
    } catch (caught) {
      setError(errorMessage(caught, "Không tải được lịch"));
    }
  }

  useEffect(() => {
    void loadInventory();
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [targetDate]);

  async function createComplex(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    try {
      await apiFetch("/api/v1/owner/court-complexes", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ name: complexName, district, address }),
      });
      setComplexName("");
      setDistrict("");
      setAddress("");
      await loadInventory();
    } catch (caught) {
      setError(errorMessage(caught, "Không tạo được cụm sân"));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function createCourt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    try {
      await apiFetch("/api/v1/owner/courts", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({
          complex_id: courtComplexId,
          name: courtName.trim(),
          sub_court_name: subCourtName.trim(),
          sport,
          status: "active",
          image_url: courtImageUrl || null,
          amenities: amenities.split(",").map((item) => item.trim()).filter(Boolean),
          base_price_vnd: Number(basePrice),
          max_rental_duration_minutes: Number(maxRentalDuration),
          min_rental_duration_minutes: Number(minRentalDuration),
          open_time: openTime + ":00",
          close_time: closeTime + ":00",
        }),
      });
      setCourtName("");
      setSubCourtName("");
      setCourtImageUrl("");
      await loadInventory();
    } catch (caught) {
      setError(errorMessage(caught, "Không tạo được sân"));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function createSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    const totalSlots = Number(maxSlots);
    try {
      await apiFetch("/api/v1/owner/sessions", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({
          court_id: sessionCourtId,
          title: sessionTitle,
          description: sessionDescription || null,
          image_url: sessionImageUrl || null,
          post_type: postKind,
          status: "scheduled",
          starts_at: new Date(startsAt).toISOString(),
          duration_minutes: Number(sessionDuration),
          open_slots: postKind === "rental" ? totalSlots : Number(openSlots),
          max_slots: totalSlots,
          required_skill_min: skillMin,
          required_skill_max: skillMax,
          slot_price_vnd: postKind === "rental" ? 0 : Number(slotPrice),
          full_court_price_vnd: Number(fullCourtPrice),
          is_peak_hour: false,
          allows_solo_join: postKind === "pool",
        }),
      });
      setSessionTitle("");
      setSessionDescription("");
      setSessionImageUrl("");
      setStartsAt(localDateTimeValue(1440));
      await loadInventory();
    } catch (caught) {
      setError(errorMessage(caught, "Không đăng được bài"));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function remove(path: string) {
    setError("");
    try {
      await apiFetch(path, { method: "DELETE", credentials: "include" }, { allowNoContent: true });
      await loadInventory();
      await loadSessions();
    } catch (caught) {
      setError(errorMessage(caught, "Không xóa được dữ liệu"));
    }
  }

  async function toggleLockSession(sessionId: string, currentStatus: string) {
    const newStatus = currentStatus === "locked" ? "scheduled" : "locked";
    try {
      await apiFetch(`/api/v1/owner/sessions/${sessionId}`, {
        method: "PATCH",
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      });
      await loadSessions();
    } catch (caught) {
      setError(errorMessage(caught, "Không cập nhật được trạng thái"));
    }
  }

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Quản lý sân"
        title="Đăng bài thuê nguyên sân hoặc mở slot ghép người chơi."
        description={message}
        actions={
          <>
            <ButtonLink href="/owner/dashboard" variant="outline">
              Tổng quan owner
            </ButtonLink>
            <ButtonLink href="/owner/check-in" variant="outline">
              Check-in
            </ButtonLink>
          </>
        }
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Cụm sân" value={complexes.length} helper="Địa điểm kinh doanh" />
        <StatCard label="Sân nhỏ" value={courts.length} helper={`${activeCourts.length} đang hoạt động`} tone="accent" />
        <StatCard label="Bài bao sân" value={`${rentalPosts}/${quota?.rental_post_limit ?? 10}`} helper={`${quota?.rental_posts_remaining ?? 10} quota còn lại`} tone="warning" />
        <StatCard label="Bài slot" value={`${slotPosts}/${quota?.slot_post_limit ?? 10}`} helper={`${quota?.slot_posts_remaining ?? 10} quota còn lại`} tone="success" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <div className="space-y-5">
          <form onSubmit={createComplex} className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <h2 className="font-heading text-lg font-semibold text-ink">1. Tạo cụm sân</h2>
              <p className="mt-1 text-sm text-slate-600">Cụm sân là địa điểm để gom các sân nhỏ cùng địa chỉ.</p>
            </div>
            <Field label="Tên cụm sân">
              <input className={inputClassName} value={complexName} onChange={(event) => setComplexName(event.target.value)} required />
            </Field>
            <Field label="Quận/Huyện">
              <input className={inputClassName} value={district} onChange={(event) => setDistrict(event.target.value)} required />
            </Field>
            <Field label="Địa chỉ">
              <input className={inputClassName} value={address} onChange={(event) => setAddress(event.target.value)} required />
            </Field>
            <Button className="w-full" disabled={isSubmitting}>
              Lưu cụm sân
            </Button>
          </form>

          <form onSubmit={createCourt} className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <h2 className="font-heading text-lg font-semibold text-ink">2. Tạo sân nhỏ</h2>
              <p className="mt-1 text-sm text-slate-600">Ảnh sân sẽ được dùng làm fallback cho các bài đăng.</p>
            </div>
            <Field label="Cụm sân">
              <select className={inputClassName} value={courtComplexId} onChange={(event) => setCourtComplexId(event.target.value)} disabled={complexes.length === 0}>
                {complexes.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tên sân">
                <input className={inputClassName} value={courtName} onChange={(event) => setCourtName(event.target.value)} required />
              </Field>
              <Field label="Mã sân con">
                <input className={inputClassName} value={subCourtName} onChange={(event) => setSubCourtName(event.target.value)} required />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Môn">
                <select className={inputClassName} value={sport} onChange={(event) => setSport(event.target.value)}>
                  {sportOptions.map((item) => <option key={item} value={item}>{sportLabel(item)}</option>)}
                </select>
              </Field>
              <Field label="Thuê tối thiểu">
                <select className={inputClassName} value={minRentalDuration} onChange={(event) => setMinRentalDuration(event.target.value)}>
                  {durationOptions.map((item) => <option key={item} value={item}>{item} phút</option>)}
                </select>
              </Field>
              <Field label="Tối đa mỗi lần thuê">
                <select className={inputClassName} value={maxRentalDuration} onChange={(event) => setMaxRentalDuration(event.target.value)}>
                  {durationOptions.map((item) => <option key={item} value={item}>{item} phút</option>)}
                </select>
              </Field>
            </div>
            <Field label="Ảnh sân URL">
              <input className={inputClassName} value={courtImageUrl} onChange={(event) => setCourtImageUrl(event.target.value)} placeholder="https://..." />
            </Field>
            <Field label="Tiện ích">
              <input className={inputClassName} value={amenities} onChange={(event) => setAmenities(event.target.value)} />
            </Field>
            <Field label="Giá cơ bản">
              <input className={inputClassName} value={basePrice} onChange={(event) => setBasePrice(event.target.value)} inputMode="numeric" required />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Giờ mở cửa">
                <input className={inputClassName} type="time" value={openTime} onChange={(event) => setOpenTime(event.target.value)} required />
              </Field>
              <Field label="Giờ đóng cửa">
                <input className={inputClassName} type="time" value={closeTime} onChange={(event) => setCloseTime(event.target.value)} required />
              </Field>
            </div>
            <Button className="w-full" disabled={isSubmitting || complexes.length === 0}>
              Lưu sân
            </Button>
          </form>
        </div>

        <div className="space-y-5">
          <form onSubmit={createSession} className="space-y-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-heading text-xl font-semibold text-ink">3. Đăng bài mở bán</h2>
                <p className="mt-1 text-sm text-slate-600">Chọn đúng kiểu bài để người chơi thấy ở Đặt Sân hoặc Xếp đối vãng lai.</p>
              </div>
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                {[
                  { value: "rental", label: "Thuê nguyên sân" },
                  { value: "pool", label: "Đăng slot" },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setPostKind(item.value as PostKind)}
                    className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${
                      postKind === item.value ? "bg-white text-red-800 shadow-sm" : "text-slate-600 hover:text-red-800"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
              <div className="space-y-4">
                <Field label="Sân">
                  <select className={inputClassName} value={sessionCourtId} onChange={(event) => setSessionCourtId(event.target.value)} disabled={activeCourts.length === 0}>
                    {activeCourts.map((item) => (
                      <option key={item.id} value={item.id}>{item.name} - {item.sub_court_name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Tiêu đề bài đăng">
                  <input className={inputClassName} value={sessionTitle} onChange={(event) => setSessionTitle(event.target.value)} placeholder={postKind === "rental" ? "Bao sân tối nay - Sân A" : "Còn 2 slot cầu lông trình trung bình"} required />
                </Field>
                <Field label="Mô tả">
                  <textarea className={`${inputClassName} min-h-24`} value={sessionDescription} onChange={(event) => setSessionDescription(event.target.value)} placeholder="Ghi chú giờ cao điểm, khu gửi xe, loại mặt sân..." />
                </Field>
                <Field label="Ảnh riêng cho bài đăng URL">
                  <input className={inputClassName} value={sessionImageUrl} onChange={(event) => setSessionImageUrl(event.target.value)} placeholder="Để trống sẽ dùng ảnh sân" />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Thời gian bắt đầu">
                    <input className={inputClassName} type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required />
                  </Field>
                  <Field label="Thời lượng">
                    <select className={inputClassName} value={sessionDuration} onChange={(event) => setSessionDuration(event.target.value)}>
                      {durationOptions.map((item) => <option key={item} value={item}>{item} phút</option>)}
                    </select>
                  </Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Tổng slot">
                    <input className={inputClassName} value={maxSlots} onChange={(event) => setMaxSlots(event.target.value)} inputMode="numeric" />
                  </Field>
                  <Field label={postKind === "rental" ? "Slot bao sân" : "Slot đang mở"}>
                    <input className={inputClassName} value={postKind === "rental" ? maxSlots : openSlots} onChange={(event) => setOpenSlots(event.target.value)} inputMode="numeric" disabled={postKind === "rental"} />
                  </Field>
                  <Field label="Giá bao sân">
                    <input className={inputClassName} value={fullCourtPrice} onChange={(event) => setFullCourtPrice(event.target.value)} inputMode="numeric" />
                  </Field>
                </div>
                {postKind === "pool" ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Giá mỗi slot">
                      <input className={inputClassName} value={slotPrice} onChange={(event) => setSlotPrice(event.target.value)} inputMode="numeric" />
                    </Field>
                    <Field label="Level thấp nhất">
                      <select className={inputClassName} value={skillMin} onChange={(event) => setSkillMin(event.target.value)}>
                        {skillOptions.map((item) => <option key={item} value={item}>{skillLabel(item)}</option>)}
                      </select>
                    </Field>
                    <Field label="Level cao nhất">
                      <select className={inputClassName} value={skillMax} onChange={(event) => setSkillMax(event.target.value)}>
                        {skillOptions.map((item) => <option key={item} value={item}>{skillLabel(item)}</option>)}
                      </select>
                    </Field>
                  </div>
                ) : null}
              </div>

              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <img
                  src={sessionImageUrl || selectedCourt?.image_url || courtImageForSport(selectedCourt?.sport ?? "Badminton")}
                  alt="Preview bài đăng"
                  className="h-40 w-full rounded-lg object-cover"
                />
                <div>
                  <Badge tone={postKind === "rental" ? "warning" : "success"}>{postKind === "rental" ? "Thuê nguyên sân" : "Đăng slot"}</Badge>
                  <h3 className="mt-3 font-heading text-lg font-semibold text-slate-950">{sessionTitle || "Tiêu đề bài đăng"}</h3>
                  <p className="mt-1 text-sm text-slate-600">{selectedCourt ? `${selectedCourt.name} - ${selectedCourt.sub_court_name}` : "Chọn sân để xem preview"}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {postKind === "rental" ? formatVnd(Number(fullCourtPrice)) : `${formatVnd(Number(slotPrice))}/slot`}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{previewTimeLabel(startsAt, sessionDuration)}</p>
                </div>
                <Notice tone="info" className="text-xs">
                  {postKind === "rental"
                    ? `Quota bao sân còn ${quota?.rental_posts_remaining ?? 10} bài.`
                    : `Quota slot còn ${quota?.slot_posts_remaining ?? 10} bài.`}
                </Notice>
              </div>
            </div>

            <Button className="w-full" disabled={isSubmitting || activeCourts.length === 0}>
              {isSubmitting ? "Đang đăng..." : postKind === "rental" ? "Đăng bài thuê nguyên sân" : "Đăng bài slot"}
            </Button>
          </form>

          <Card className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-heading text-lg font-semibold text-ink">Quản lý lịch đặt</h2>
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  className={inputClassName}
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                />
                <Badge>{sessions.length} slot</Badge>
              </div>
            </div>
            {sessions.length === 0 ? (
              <p className="text-sm text-slate-600">Không có lịch cho ngày này.</p>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                {Object.entries(groupedSessions).map(([courtName, courtSessions]) => {
                  const isExpanded = expandedCourtGroup === courtName;
                  return (
                    <div key={courtName} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setExpandedCourtGroup(isExpanded ? null : courtName)}
                        className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition text-left"
                      >
                        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                          🏟️ {courtName} 
                          <Badge tone="neutral" className="ml-2">{courtSessions.length} bài</Badge>
                        </h3>
                        <span className="text-slate-400">
                          {isExpanded ? '▲' : '▼'}
                        </span>
                      </button>
                      
                      {isExpanded && (
                        <div className="p-4 grid gap-3 lg:grid-cols-2 bg-white animate-in slide-in-from-top-2 fade-in duration-200">
                          {courtSessions.map((item) => (
                            <article key={item.id} className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[100px_1fr]">
                              <img src={imageForPost(item, courts)} alt={item.title} className="h-24 w-full rounded-lg object-cover" />
                              <div className="min-w-0 flex flex-col justify-between">
                                <div>
                                  <div className="flex flex-wrap items-start justify-between gap-1">
                                    <h3 className="font-semibold text-slate-950 text-sm line-clamp-1">{item.title}</h3>
                                    <Badge tone={item.post_type === "rental" ? "warning" : "success"} className="text-[10px]">
                                      {postTypeLabel(item.post_type)}
                                    </Badge>
                                  </div>
                                  <p className="mt-1 text-xs text-slate-600 font-medium">🕒 {formatTimeRange(item.starts_at, item.duration_minutes)}</p>
                                  <p className="mt-1 text-xs text-slate-600">
                                    {item.status === "locked" ? (
                                      <span className="text-red-600 font-bold">Đã khóa</span>
                                    ) : (
                                      <span className="text-green-600 font-bold">Sẵn sàng</span>
                                    )} · {item.post_type === "rental" ? formatVnd(item.full_court_price_vnd) : `${formatVnd(item.slot_price_vnd)}/slot`}
                                  </p>
                                </div>
                                <div className="flex flex-col gap-2 mt-2">
                                  <Button 
                                    className="text-xs h-7 py-0" 
                                    variant={item.status === "locked" ? "primary" : "secondary"} 
                                    size="sm" 
                                    onClick={() => toggleLockSession(item.id, item.status)}
                                  >
                                    {item.status === "locked" ? "Mở khóa" : "Khóa sân"}
                                  </Button>
                                  <Button className="text-xs h-7 py-0" variant="danger" size="sm" onClick={() => remove(`/api/v1/owner/sessions/${item.id}`)}>
                                    Xóa
                                  </Button>
                                </div>
                              </div>
                            </article>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <Card className="space-y-3">
          <h2 className="font-heading text-lg font-semibold text-ink">Cụm sân</h2>
          {complexes.length === 0 ? (
            <p className="text-sm text-slate-600">Chưa có cụm sân.</p>
          ) : (
            complexes.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="font-semibold text-slate-950">{item.name}</p>
                <p className="mt-1 text-sm text-slate-600">{item.district}</p>
                <p className="mt-1 text-sm text-slate-600">{item.address}</p>
                <Button className="mt-3" variant="danger" size="sm" onClick={() => remove(`/api/v1/owner/court-complexes/${item.id}`)}>
                  Xóa
                </Button>
              </div>
            ))
          )}
        </Card>

        <Card className="space-y-3">
          <h2 className="font-heading text-lg font-semibold text-ink">Sân nhỏ</h2>
          {courts.length === 0 ? (
            <p className="text-sm text-slate-600">Chưa có sân nhỏ.</p>
          ) : (
            courts.map((item) => (
              <div key={item.id} className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[104px_1fr]">
                <img src={item.image_url || courtImageForSport(item.sport)} alt={item.name} className="h-24 w-full rounded-lg object-cover" />
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-semibold text-slate-950">{item.name} - {item.sub_court_name}</p>
                    <Badge tone={item.status === "active" ? "success" : "warning"}>{item.status}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{sportLabel(item.sport)} · {item.complex_name ?? "chưa gắn cụm"}</p>
                  <p className="mt-1 text-sm text-slate-600">{formatVnd(item.base_price_vnd)} · tối đa {item.max_rental_duration_minutes} phút</p>
                  <Button className="mt-3" variant="danger" size="sm" onClick={() => remove(`/api/v1/owner/courts/${item.id}`)}>
                    Xóa
                  </Button>
                </div>
              </div>
            ))
          )}
        </Card>
      </section>

      {complexes.length === 0 && courts.length === 0 && sessions.length === 0 && !error ? (
        <EmptyState
          title="Bắt đầu bằng cụm sân đầu tiên"
          description="Tạo cụm sân, thêm sân nhỏ rồi đăng bài thuê nguyên sân hoặc slot để người chơi tìm thấy."
        />
      ) : null}
    </div>
  );
}
