"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, EmptyState } from "@/components/ui";
import { apiFetch } from "@/lib/http";
import Link from "next/link";

type PlayerDetailResponse = {
  key: string;
  name: string;
  total_played: number;
  wins: number;
  losses: number;
  win_rate: number;
  partners: any[];
  opponents: any[];
  matches: any[];
};

function PlayerDetailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawKey = searchParams.get("key") || "";
  const [data, setData] = useState<PlayerDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (rawKey) {
      loadDetail();
    }
  }, [rawKey]);

  const loadDetail = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch<PlayerDetailResponse>(
        `/api/v1/player/scorekeeper/player-detail?key=${encodeURIComponent(rawKey)}`
      );
      setData(res);
    } catch (err) {
      console.error("Lỗi lấy thông tin chi tiết người chơi", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-20">
        <p className="text-sm text-slate-400">Đang tải hồ sơ chỉ số cầu lông...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20">
        <p className="text-sm text-slate-400">Không tìm thấy thông tin của đối tượng này.</p>
        <Link href="/player/scorekeeper/stats" className="mt-4 text-red-800 hover:underline inline-block font-bold">
          Quay lại trang Thống kê
        </Link>
      </div>
    );
  }

  const isPair = rawKey.includes("||");

  return (
    <div className="flex flex-col md:flex-row gap-8 items-start mb-8">
      {/* Profile Card left */}
      <div className="w-full md:w-[350px] shrink-0 bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center text-3xl font-black text-red-800 mx-auto shadow-inner mb-4">
            {isPair ? "👥" : data.name[0].toUpperCase()}
          </div>
          <h1 className="text-xl font-black text-slate-900 leading-tight mb-1">{data.name}</h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
            {isPair ? "Đôi nam/nữ" : "Đấu thủ cầu lông"}
          </p>
        </div>

        <div className="border-t border-slate-100 pt-6">
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 text-center">Tỷ lệ thắng</h3>
          <div className="relative w-32 h-32 mx-auto flex items-center justify-center">
            {/* Circular win rate display */}
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-slate-100"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-emerald-500"
                strokeWidth="3.5"
                strokeDasharray={`${data.win_rate}, 100`}
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute text-center">
              <span className="text-2xl font-black text-slate-900 leading-none">{data.win_rate}%</span>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Thắng</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-6 text-center">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Trận</p>
            <p className="text-lg font-black text-slate-900 mt-1">{data.total_played}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Thắng</p>
            <p className="text-lg font-black text-emerald-600 mt-1">{data.wins}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Thua</p>
            <p className="text-lg font-black text-rose-600 mt-1">{data.losses}</p>
          </div>
        </div>
      </div>

      {/* stats lists right */}
      <div className="flex-1 w-full space-y-8">
        {/* Rivals & Partners */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Best Partners */}
          {!isPair && (
            <Card className="p-6 border border-slate-200/80 rounded-2xl bg-white shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-1.5">
                <span>🤝 Bạn diễn ăn ý (Partners)</span>
              </h3>
              {data.partners.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">Chưa có đủ lịch sử đánh cặp</p>
              ) : (
                <div className="space-y-3">
                  {data.partners.map((p, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm border-b border-slate-50 pb-2">
                      <Link 
                        href={`/player/scorekeeper/player?key=${encodeURIComponent(p.key)}`}
                        className="font-bold text-slate-700 hover:text-red-800 hover:underline"
                      >
                        {p.name}
                      </Link>
                      <div className="text-right">
                        <span className="font-black text-emerald-600">{p.win_rate}%</span>
                        <span className="text-[10px] text-slate-400 block">{p.played} trận đánh chung</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* Tough Opponents */}
          <Card className="p-6 border border-slate-200/80 rounded-2xl bg-white shadow-xs col-span-1">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-1.5">
              <span>⚔️ Đối thủ chạm trán (Rivals)</span>
            </h3>
            {data.opponents.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">Chưa đối đầu ai chéo</p>
            ) : (
              <div className="space-y-3">
                {data.opponents.map((o, idx) => (
                  <div key={idx} className="flex justify-between items-center text-sm border-b border-slate-50 pb-2">
                    <Link 
                      href={`/player/scorekeeper/player?key=${encodeURIComponent(o.key)}`}
                      className="font-bold text-slate-700 hover:text-red-800 hover:underline"
                    >
                      {o.name}
                    </Link>
                    <div className="text-right">
                      <span className="font-black text-rose-600">{100 - o.win_rate}% thắng</span>
                      <span className="text-[10px] text-slate-400 block">{o.played} lần đụng độ</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* History Matches log */}
        <div className="space-y-4">
          <h3 className="font-bold text-slate-900 text-sm">Lịch sử đấu chi tiết (Đảm bảo minh bạch)</h3>
          {data.matches.length === 0 ? (
            <EmptyState title="Không có lịch sử" description="Đối tượng này chưa thi đấu trận nào." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {data.matches.map((m) => {
                const isSingles = m.match_type === "singles";
                const isWonA = m.winner_team === "A";
                const formattedDate = new Date(m.played_at).toLocaleString("vi-VN", {
                  year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit"
                });

                return (
                  <Card key={m.id} className="p-4 border border-slate-200/70 shadow-3xs rounded-xl bg-white space-y-3">
                    <div className="flex justify-between items-center text-[10px] text-slate-400 border-b border-slate-100 pb-2">
                      <span>{isSingles ? "Đấu Đơn" : "Đấu Đôi"} · {formattedDate}</span>
                      <span>Ghi bởi: {m.recorder}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className={isWonA ? "font-bold text-slate-900" : "text-slate-500"}>
                        <p className="truncate text-xs">{m.team_a.player1.name}</p>
                        {m.team_a.player2 && <p className="truncate text-[10px] text-slate-400">{m.team_a.player2.name}</p>}
                        <p className="text-sm font-black mt-1 text-emerald-700">Set thắng: {m.team_a.score}</p>
                      </div>
                      <div className={!isWonA ? "font-bold text-slate-900" : "text-slate-500"}>
                        <p className="truncate text-xs">{m.team_b.player1.name}</p>
                        {m.team_b.player2 && <p className="truncate text-[10px] text-slate-400">{m.team_b.player2.name}</p>}
                        <p className="text-sm font-black mt-1 text-indigo-700">Set thắng: {m.team_b.score}</p>
                      </div>
                    </div>

                    <div className="flex gap-2 flex-wrap pt-2 border-t border-slate-50">
                      {m.sets.map((s: any, idx: number) => (
                        <span key={idx} className="bg-slate-50 border border-slate-150 rounded px-1.5 py-0.5 text-[10px] text-slate-600 font-bold">
                          {s.team_a} - {s.team_b}
                        </span>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PlayerDetailPage() {
  return (
    <main className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6">
      <div className="mb-6 flex justify-between items-center">
        <Link href="/player/scorekeeper/stats" className="text-sm font-bold text-red-800 hover:underline">
          ← Quay lại trang Thống kê
        </Link>
        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
          Chi tiết người chơi/cặp đấu
        </span>
      </div>

      <Suspense fallback={<div className="text-center py-20 text-slate-400">Đang tải dữ liệu hồ sơ...</div>}>
        <PlayerDetailContent />
      </Suspense>
    </main>
  );
}
