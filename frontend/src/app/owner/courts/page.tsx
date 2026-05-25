"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { Badge, Button, ButtonLink, Card, EmptyState, Field, Notice, PageHero, StatCard, inputClassName } from "@/components/ui";
import { apiFetch } from "@/lib/http";
import { errorMessage, formatTimeRange, formatVnd, sportLabel } from "@/lib/format";

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
  status: string;
  starts_at: string;
  duration_minutes: number;
  open_slots: number;
  max_slots: number;
  slot_price_vnd: number;
  full_court_price_vnd: number;
  court_name: string | null;
  complex_name: string | null;
};

const sportOptions = ["Badminton", "Football", "Tennis"];
const durationOptions = [30, 60, 90, 120, 150, 180, 210, 240, 270, 300];

function localDateTimeValue(minutesFromNow: number) {
  const date = new Date(Date.now() + minutesFromNow * 60 * 1000);
  date.setSeconds(0, 0);
  return date.toISOString().slice(0, 16);
}

export default function OwnerCourtsPage() {
  const [complexes, setComplexes] = useState<CourtComplex[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
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
  const [basePrice, setBasePrice] = useState("120000");
  const [maxRentalDuration, setMaxRentalDuration] = useState("120");

  const [sessionCourtId, setSessionCourtId] = useState("");
  const [sessionTitle, setSessionTitle] = useState("");
  const [startsAt, setStartsAt] = useState(localDateTimeValue(1440));
  const [sessionDuration, setSessionDuration] = useState("60");
  const [maxSlots, setMaxSlots] = useState("4");
  const [openSlots, setOpenSlots] = useState("4");
  const [slotPrice, setSlotPrice] = useState("80000");
  const [fullCourtPrice, setFullCourtPrice] = useState("300000");

  const activeCourts = useMemo(() => courts.filter((court) => court.status === "active"), [courts]);
  const upcomingSessions = useMemo(
    () => sessions.filter((session) => new Date(session.starts_at) > new Date()),
    [sessions],
  );
  const totalOpenSlots = sessions.reduce((total, session) => total + session.open_slots, 0);

  async function loadInventory() {
    setError("");
    try {
      const [nextComplexes, nextCourts, nextSessions] = await Promise.all([
        apiFetch<CourtComplex[]>("/api/v1/owner/court-complexes", { credentials: "include" }),
        apiFetch<Court[]>("/api/v1/owner/courts", { credentials: "include" }),
        apiFetch<Session[]>("/api/v1/owner/sessions", { credentials: "include" }),
      ]);
      setComplexes(nextComplexes);
      setCourts(nextCourts);
      setSessions(nextSessions);
      setCourtComplexId((previous) => previous || nextComplexes[0]?.id || "");
      setSessionCourtId((previous) => previous || nextCourts[0]?.id || "");
      setMessage("Dữ liệu sân đã được đồng bộ.");
    } catch (caught) {
      setError(errorMessage(caught, "Không tải được dữ liệu sân"));
      setMessage("Cần tài khoản owner đã được duyệt để quản lý sân.");
    }
  }

  useEffect(() => {
    void loadInventory();
  }, []);

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
          amenities: [],
          base_price_vnd: Number(basePrice),
          max_rental_duration_minutes: Number(maxRentalDuration),
        }),
      });
      setCourtName("");
      setSubCourtName("");
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
    try {
      await apiFetch("/api/v1/owner/sessions", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({
          court_id: sessionCourtId,
          title: sessionTitle,
          post_type: "pool",
          status: "scheduled",
          starts_at: new Date(startsAt).toISOString(),
          duration_minutes: Number(sessionDuration),
          open_slots: Number(openSlots),
          max_slots: Number(maxSlots),
          required_skill_min: "Beginner",
          required_skill_max: "Advanced",
          slot_price_vnd: Number(slotPrice),
          full_court_price_vnd: Number(fullCourtPrice),
          is_peak_hour: false,
          allows_solo_join: true,
        }),
      });
      setSessionTitle("");
      setStartsAt(localDateTimeValue(1440));
      await loadInventory();
    } catch (caught) {
      setError(errorMessage(caught, "Không tạo được khung giờ"));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function remove(path: string) {
    setError("");
    try {
      await apiFetch(path, { method: "DELETE", credentials: "include" }, { allowNoContent: true });
      await loadInventory();
    } catch (caught) {
      setError(errorMessage(caught, "Không xóa được dữ liệu"));
    }
  }

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Quản lý sân"
        title="Tạo cụm sân, sân nhỏ và khung giờ mở bán."
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
        <StatCard label="Khung giờ sắp tới" value={upcomingSessions.length} helper="Đang mở cho người chơi" />
        <StatCard label="Slot còn trống" value={totalOpenSlots} helper="Tổng slot có thể đặt" tone="success" />
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <form onSubmit={createComplex} className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="font-heading text-lg font-semibold text-ink">1. Tạo cụm sân</h2>
            <p className="mt-1 text-sm text-slate-600">Ví dụ: NetUp Arena Hà Đông.</p>
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
            <p className="mt-1 text-sm text-slate-600">Mỗi sân nhỏ có môn, giá cơ bản và giới hạn thuê riêng.</p>
          </div>
          <Field label="Cụm sân">
            <select className={inputClassName} value={courtComplexId} onChange={(event) => setCourtComplexId(event.target.value)} disabled={complexes.length === 0}>
              {complexes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
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
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Môn">
              <select className={inputClassName} value={sport} onChange={(event) => setSport(event.target.value)}>
                {sportOptions.map((item) => (
                  <option key={item} value={item}>
                    {sportLabel(item)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tối đa mỗi lần thuê">
              <select className={inputClassName} value={maxRentalDuration} onChange={(event) => setMaxRentalDuration(event.target.value)}>
                {durationOptions.map((item) => (
                  <option key={item} value={item}>
                    {item} phút
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Giá cơ bản">
            <input className={inputClassName} value={basePrice} onChange={(event) => setBasePrice(event.target.value)} inputMode="numeric" required />
          </Field>
          <Button className="w-full" disabled={isSubmitting || complexes.length === 0}>
            Lưu sân
          </Button>
        </form>

        <form onSubmit={createSession} className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="font-heading text-lg font-semibold text-ink">3. Mở khung giờ</h2>
            <p className="mt-1 text-sm text-slate-600">Khung giờ sẽ xuất hiện trên discovery của người chơi.</p>
          </div>
          <Field label="Sân">
            <select className={inputClassName} value={sessionCourtId} onChange={(event) => setSessionCourtId(event.target.value)} disabled={activeCourts.length === 0}>
              {activeCourts.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} - {item.sub_court_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tên khung giờ">
            <input className={inputClassName} value={sessionTitle} onChange={(event) => setSessionTitle(event.target.value)} required />
          </Field>
          <Field label="Thời gian bắt đầu">
            <input className={inputClassName} type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Phút">
              <select className={inputClassName} value={sessionDuration} onChange={(event) => setSessionDuration(event.target.value)}>
                {durationOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tổng slot">
              <input className={inputClassName} value={maxSlots} onChange={(event) => setMaxSlots(event.target.value)} inputMode="numeric" />
            </Field>
            <Field label="Còn trống">
              <input className={inputClassName} value={openSlots} onChange={(event) => setOpenSlots(event.target.value)} inputMode="numeric" />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Giá slot">
              <input className={inputClassName} value={slotPrice} onChange={(event) => setSlotPrice(event.target.value)} inputMode="numeric" />
            </Field>
            <Field label="Giá bao sân">
              <input className={inputClassName} value={fullCourtPrice} onChange={(event) => setFullCourtPrice(event.target.value)} inputMode="numeric" />
            </Field>
          </div>
          <Button className="w-full" disabled={isSubmitting || activeCourts.length === 0}>
            Lưu khung giờ
          </Button>
        </form>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
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
              <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-semibold text-slate-950">
                    {item.name} - {item.sub_court_name}
                  </p>
                  <Badge tone={item.status === "active" ? "success" : "warning"}>{item.status}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {sportLabel(item.sport)} · {item.complex_name ?? "chưa gắn cụm"}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {formatVnd(item.base_price_vnd)} · tối đa {item.max_rental_duration_minutes} phút
                </p>
                <Button className="mt-3" variant="danger" size="sm" onClick={() => remove(`/api/v1/owner/courts/${item.id}`)}>
                  Xóa
                </Button>
              </div>
            ))
          )}
        </Card>

        <Card className="space-y-3">
          <h2 className="font-heading text-lg font-semibold text-ink">Khung giờ</h2>
          {sessions.length === 0 ? (
            <p className="text-sm text-slate-600">Chưa có khung giờ.</p>
          ) : (
            sessions.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-semibold text-slate-950">{item.title}</p>
                  <Badge tone={item.status === "scheduled" ? "success" : "neutral"}>{item.status}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {item.court_name ?? "Sân"} · {formatTimeRange(item.starts_at, item.duration_minutes)}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {item.open_slots}/{item.max_slots} slot · {formatVnd(item.slot_price_vnd)}/slot
                </p>
                <Button className="mt-3" variant="danger" size="sm" onClick={() => remove(`/api/v1/owner/sessions/${item.id}`)}>
                  Xóa
                </Button>
              </div>
            ))
          )}
        </Card>
      </section>

      {complexes.length === 0 && courts.length === 0 && sessions.length === 0 && !error ? (
        <EmptyState
          title="Bắt đầu bằng cụm sân đầu tiên"
          description="Tạo cụm sân, sau đó thêm sân nhỏ và khung giờ để người chơi có thể đặt."
        />
      ) : null}
    </div>
  );
}
