"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

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

type ApiErrorDetail = {
  field?: string;
  message?: string;
};

function money(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

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

  const canCreateCourt = complexes.length > 0;
  const canCreateSession = courts.length > 0;

  const activeCourts = useMemo(
    () => courts.filter((court) => court.status === "active"),
    [courts],
  );

  async function apiFetch(path: string, init?: RequestInit) {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    const payload = response.status === 204 ? null : await response.json();
    if (!response.ok) {
      const firstDetail = payload?.error?.details?.[0] as ApiErrorDetail | undefined;
      const detailMessage = firstDetail?.field
        ? `${firstDetail.field}: ${firstDetail.message}`
        : firstDetail?.message;
      throw new Error(detailMessage ?? payload?.error?.message ?? "Thao tác không thành công");
    }
    return payload;
  }

  async function loadInventory() {
    setError("");
    try {
      const [nextComplexes, nextCourts, nextSessions] = await Promise.all([
        apiFetch("/api/v1/owner/court-complexes"),
        apiFetch("/api/v1/owner/courts"),
        apiFetch("/api/v1/owner/sessions"),
      ]);
      setComplexes(nextComplexes);
      setCourts(nextCourts);
      setSessions(nextSessions);
      setCourtComplexId(nextComplexes[0]?.id ?? "");
      setSessionCourtId(nextCourts[0]?.id ?? "");
      setMessage("Dữ liệu sân đã được đồng bộ từ API");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không tải được dữ liệu sân");
      setMessage("Chưa thể tải dữ liệu vận hành");
    }
  }

  useEffect(() => {
    loadInventory();
  }, []);

  async function createComplex(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    try {
      await apiFetch("/api/v1/owner/court-complexes", {
        method: "POST",
        body: JSON.stringify({
          name: complexName,
          district,
          address,
        }),
      });
      setComplexName("");
      setDistrict("");
      setAddress("");
      await loadInventory();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không tạo được cụm sân");
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
      setError(caught instanceof Error ? caught.message : "Không tạo được sân");
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
      setError(caught instanceof Error ? caught.message : "Không tạo được phiên sân");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function remove(path: string) {
    setError("");
    try {
      await apiFetch(path, { method: "DELETE" });
      await loadInventory();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không xóa được dữ liệu");
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-slate-950">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">
              NetUp Chủ sân
            </p>
            <h1 className="mt-2 text-3xl font-semibold">Quản lý sân và phiên</h1>
            <p className="mt-2 text-sm text-slate-600">{message}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              href="/owner/dashboard"
            >
              Hồ sơ owner
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

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-3 lg:px-8">
        <form onSubmit={createComplex} className="rounded border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Tạo cụm sân</h2>
          <label className="mt-4 grid gap-2 text-sm font-semibold text-slate-700">
            Tên cụm sân
            <input
              className="rounded border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-900"
              value={complexName}
              onChange={(event) => setComplexName(event.target.value)}
              required
            />
          </label>
          <label className="mt-3 grid gap-2 text-sm font-semibold text-slate-700">
            Quận/Huyện
            <input
              className="rounded border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-900"
              value={district}
              onChange={(event) => setDistrict(event.target.value)}
              required
            />
          </label>
          <label className="mt-3 grid gap-2 text-sm font-semibold text-slate-700">
            Địa chỉ
            <input
              className="rounded border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-900"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              required
            />
          </label>
          <button
            className="mt-5 w-full rounded bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-400"
            disabled={isSubmitting}
          >
            Lưu cụm sân
          </button>
        </form>

        <form onSubmit={createCourt} className="rounded border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Tạo sân</h2>
          <label className="mt-4 grid gap-2 text-sm font-semibold text-slate-700">
            Cụm sân
            <select
              className="rounded border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-900"
              value={courtComplexId}
              onChange={(event) => setCourtComplexId(event.target.value)}
              disabled={!canCreateCourt}
            >
              {complexes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 grid gap-2 text-sm font-semibold text-slate-700">
            Tên sân
            <input
              className="rounded border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-900"
              value={courtName}
              onChange={(event) => setCourtName(event.target.value)}
              required
            />
          </label>
          <label className="mt-3 grid gap-2 text-sm font-semibold text-slate-700">
            Mã sân con
            <input
              className="rounded border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-900"
              value={subCourtName}
              onChange={(event) => setSubCourtName(event.target.value)}
              required
            />
          </label>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Môn
              <select
                className="rounded border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-900"
                value={sport}
                onChange={(event) => setSport(event.target.value)}
              >
                {sportOptions.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Giới hạn phút
              <select
                className="rounded border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-900"
                value={maxRentalDuration}
                onChange={(event) => setMaxRentalDuration(event.target.value)}
              >
                {durationOptions.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="mt-3 grid gap-2 text-sm font-semibold text-slate-700">
            Giá cơ bản
            <input
              className="rounded border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-900"
              value={basePrice}
              onChange={(event) => setBasePrice(event.target.value)}
              inputMode="numeric"
              required
            />
          </label>
          <button
            className="mt-5 w-full rounded bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-400"
            disabled={isSubmitting || !canCreateCourt}
          >
            Lưu sân
          </button>
        </form>

        <form onSubmit={createSession} className="rounded border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Tạo phiên</h2>
          <label className="mt-4 grid gap-2 text-sm font-semibold text-slate-700">
            Sân
            <select
              className="rounded border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-900"
              value={sessionCourtId}
              onChange={(event) => setSessionCourtId(event.target.value)}
              disabled={!canCreateSession}
            >
              {activeCourts.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} - {item.sub_court_name}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 grid gap-2 text-sm font-semibold text-slate-700">
            Tên phiên
            <input
              className="rounded border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-900"
              value={sessionTitle}
              onChange={(event) => setSessionTitle(event.target.value)}
              required
            />
          </label>
          <label className="mt-3 grid gap-2 text-sm font-semibold text-slate-700">
            Thời gian bắt đầu
            <input
              className="rounded border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-900"
              type="datetime-local"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
              required
            />
          </label>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Phút
              <select
                className="rounded border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-900"
                value={sessionDuration}
                onChange={(event) => setSessionDuration(event.target.value)}
              >
                {durationOptions.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Slot
              <input
                className="rounded border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-900"
                value={maxSlots}
                onChange={(event) => setMaxSlots(event.target.value)}
                inputMode="numeric"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Trống
              <input
                className="rounded border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-900"
                value={openSlots}
                onChange={(event) => setOpenSlots(event.target.value)}
                inputMode="numeric"
              />
            </label>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Giá slot
              <input
                className="rounded border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-900"
                value={slotPrice}
                onChange={(event) => setSlotPrice(event.target.value)}
                inputMode="numeric"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Giá nguyên sân
              <input
                className="rounded border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-900"
                value={fullCourtPrice}
                onChange={(event) => setFullCourtPrice(event.target.value)}
                inputMode="numeric"
              />
            </label>
          </div>
          <button
            className="mt-5 w-full rounded bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-400"
            disabled={isSubmitting || !canCreateSession}
          >
            Lưu phiên
          </button>
        </form>
      </section>

      {error ? (
        <section className="mx-auto max-w-7xl px-6 pb-6 lg:px-8">
          <p className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        </section>
      ) : null}

      <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-10 lg:grid-cols-3 lg:px-8">
        <div className="rounded border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Cụm sân</h2>
          <div className="mt-4 grid gap-3">
            {complexes.map((item) => (
              <div key={item.id} className="rounded border border-slate-200 bg-slate-50 p-4">
                <p className="font-semibold">{item.name}</p>
                <p className="mt-1 text-sm text-slate-600">{item.district}</p>
                <p className="mt-1 text-sm text-slate-600">{item.address}</p>
                <button
                  className="mt-3 rounded border border-red-200 px-3 py-1 text-sm font-semibold text-red-700 hover:bg-red-50"
                  onClick={() => remove(`/api/v1/owner/court-complexes/${item.id}`)}
                >
                  Xóa
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Sân</h2>
          <div className="mt-4 grid gap-3">
            {courts.map((item) => (
              <div key={item.id} className="rounded border border-slate-200 bg-slate-50 p-4">
                <p className="font-semibold">
                  {item.name} - {item.sub_court_name}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {item.sport} · {item.complex_name ?? "chưa gắn cụm"} · {item.status}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {money(item.base_price_vnd)}đ · tối đa {item.max_rental_duration_minutes} phút
                </p>
                <button
                  className="mt-3 rounded border border-red-200 px-3 py-1 text-sm font-semibold text-red-700 hover:bg-red-50"
                  onClick={() => remove(`/api/v1/owner/courts/${item.id}`)}
                >
                  Xóa
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Phiên sân</h2>
          <div className="mt-4 grid gap-3">
            {sessions.map((item) => (
              <div key={item.id} className="rounded border border-slate-200 bg-slate-50 p-4">
                <p className="font-semibold">{item.title}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {item.court_name ?? "Sân"} · {new Date(item.starts_at).toLocaleString("vi-VN")}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {item.duration_minutes} phút · {item.open_slots}/{item.max_slots} slot ·{" "}
                  {money(item.slot_price_vnd)}đ/slot
                </p>
                <button
                  className="mt-3 rounded border border-red-200 px-3 py-1 text-sm font-semibold text-red-700 hover:bg-red-50"
                  onClick={() => remove(`/api/v1/owner/sessions/${item.id}`)}
                >
                  Xóa
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
