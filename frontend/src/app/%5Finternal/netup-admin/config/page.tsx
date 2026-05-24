"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { adminFetch, adminLogout } from "../_lib/auth";

type AdminConfig = {
  platform_fee_rate: number;
  floor_fee_vnd: number;
  deposit_percent: number;
  matching_radius_km: number;
  no_show_strike_limit: number;
  auto_release_minutes: number;
  support_hotline_enabled: boolean;
  updated_at: string;
};

const toDisplayPercent = (rate: number) => Math.round(rate * 10000) / 100;

export default function AdminConfigPage() {
  const router = useRouter();
  const [config, setConfig] = useState<AdminConfig | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("Đang tải cấu hình hệ thống...");
  const [isSaving, setIsSaving] = useState(false);

  const [platformFeePercent, setPlatformFeePercent] = useState("10");
  const [floorFeeVnd, setFloorFeeVnd] = useState("3000");
  const [depositPercent, setDepositPercent] = useState("30");
  const [matchingRadiusKm, setMatchingRadiusKm] = useState("5");
  const [noShowStrikeLimit, setNoShowStrikeLimit] = useState("3");
  const [autoReleaseMinutes, setAutoReleaseMinutes] = useState("15");
  const [supportHotlineEnabled, setSupportHotlineEnabled] = useState(true);
  const [changeReason, setChangeReason] = useState("");

  function syncForm(next: AdminConfig) {
    setPlatformFeePercent(String(toDisplayPercent(next.platform_fee_rate)));
    setFloorFeeVnd(String(next.floor_fee_vnd));
    setDepositPercent(String(next.deposit_percent));
    setMatchingRadiusKm(String(next.matching_radius_km));
    setNoShowStrikeLimit(String(next.no_show_strike_limit));
    setAutoReleaseMinutes(String(next.auto_release_minutes));
    setSupportHotlineEnabled(next.support_hotline_enabled);
  }

  async function loadConfig() {
    setError("");
    try {
      const payload = await adminFetch<AdminConfig>("/api/v1/admin/config");
      setConfig(payload);
      syncForm(payload);
      setMessage("Cấu hình hệ thống đã đồng bộ.");
    } catch (caught) {
      const nextError = caught instanceof Error ? caught.message : "Không tải được cấu hình hệ thống";
      if (nextError === "admin_unauthorized") {
        router.push("/_internal/netup-admin/login");
        return;
      }
      setError(nextError);
      setMessage("Không thể đọc cấu hình admin.");
      setConfig(null);
    }
  }

  useEffect(() => {
    loadConfig();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSaving(true);
    try {
      const payload = await adminFetch<AdminConfig>("/api/v1/admin/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          change_reason: changeReason,
          platform_fee_rate: Number(platformFeePercent) / 100,
          floor_fee_vnd: Number(floorFeeVnd),
          deposit_percent: Number(depositPercent),
          matching_radius_km: Number(matchingRadiusKm),
          no_show_strike_limit: Number(noShowStrikeLimit),
          auto_release_minutes: Number(autoReleaseMinutes),
          support_hotline_enabled: supportHotlineEnabled,
        }),
      });
      setConfig(payload);
      syncForm(payload);
      setChangeReason("");
      setMessage("Đã cập nhật cấu hình và ghi audit thành công.");
    } catch (caught) {
      const nextError = caught instanceof Error ? caught.message : "Không cập nhật được cấu hình";
      if (nextError === "admin_unauthorized") {
        router.push("/_internal/netup-admin/login");
        return;
      }
      setError(nextError);
    } finally {
      setIsSaving(false);
    }
  }

  async function logout() {
    await adminLogout();
    router.push("/_internal/netup-admin/login");
  }

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-slate-950">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">
              NetUp Quản trị
            </p>
            <h1 className="mt-2 text-3xl font-semibold">Cấu hình hệ thống</h1>
            <p className="mt-2 text-sm text-slate-600">{message}</p>
            {config ? (
              <p className="mt-1 text-sm text-slate-600">
                Cập nhật lần cuối: {new Date(config.updated_at).toLocaleString("vi-VN")}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              href="/_internal/netup-admin/dashboard"
            >
              Dashboard
            </Link>
            <Link
              className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              href="/_internal/netup-admin/owner-requests"
            >
              Duyệt owner
            </Link>
            <button
              className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={logout}
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-8 lg:px-8">
        {error ? (
          <p className="mb-5 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <form onSubmit={submit} className="rounded border border-slate-200 bg-white p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Platform fee (%)
              <input
                className="rounded border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-900"
                type="number"
                step="0.01"
                min={0}
                max={30}
                value={platformFeePercent}
                onChange={(event) => setPlatformFeePercent(event.target.value)}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Floor fee (VND)
              <input
                className="rounded border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-900"
                type="number"
                min={0}
                max={200000}
                value={floorFeeVnd}
                onChange={(event) => setFloorFeeVnd(event.target.value)}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Deposit percent (%)
              <input
                className="rounded border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-900"
                type="number"
                step="0.01"
                min={5}
                max={80}
                value={depositPercent}
                onChange={(event) => setDepositPercent(event.target.value)}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Matching radius (km)
              <input
                className="rounded border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-900"
                type="number"
                step="0.1"
                min={1}
                max={30}
                value={matchingRadiusKm}
                onChange={(event) => setMatchingRadiusKm(event.target.value)}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              No-show strike limit
              <input
                className="rounded border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-900"
                type="number"
                min={1}
                max={10}
                value={noShowStrikeLimit}
                onChange={(event) => setNoShowStrikeLimit(event.target.value)}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Auto release minutes
              <input
                className="rounded border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-900"
                type="number"
                min={5}
                max={120}
                value={autoReleaseMinutes}
                onChange={(event) => setAutoReleaseMinutes(event.target.value)}
              />
            </label>
          </div>

          <label className="mt-4 flex items-center gap-3 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={supportHotlineEnabled}
              onChange={(event) => setSupportHotlineEnabled(event.target.checked)}
            />
            Bật hotline hỗ trợ
          </label>

          <label className="mt-4 grid gap-2 text-sm font-semibold text-slate-700">
            Lý do thay đổi (bắt buộc để audit)
            <textarea
              className="min-h-24 rounded border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-900"
              value={changeReason}
              onChange={(event) => setChangeReason(event.target.value)}
              placeholder="Ví dụ: Điều chỉnh phí theo chính sách vận hành tuần này"
              required
            />
          </label>

          <button
            className="mt-5 rounded bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-400"
            disabled={isSaving}
          >
            {isSaving ? "Đang lưu..." : "Lưu cấu hình"}
          </button>
        </form>
      </section>
    </main>
  );
}
