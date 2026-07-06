"use client";

import { useEffect, useState } from "react";
import { Card, PageHero, Notice, StatCard, EmptyState } from "@/components/ui";
import { apiFetch } from "@/lib/http";
import { errorMessage } from "@/lib/format";
import Link from "next/link";

type LeaderboardItem = {
  key: string;
  name: string;
  avatar_url: string | null;
  played: number;
  wins: number;
  losses: number;
  win_rate: number;
};

type H2HResponse = {
  total_played: number;
  a_wins: number;
  b_wins: number;
  a_win_rate: number;
  b_win_rate: number;
  matches: any[];
};

export default function StatsPage() {
  const [activeSubTab, setActiveSubTab] = useState<"individual" | "pairs" | "h2h">("individual");
  const [players, setPlayers] = useState<LeaderboardItem[]>([]);
  const [pairs, setPairs] = useState<LeaderboardItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // H2H selection state
  const [h2hEntityA, setH2hEntityA] = useState("");
  const [h2hEntityB, setH2hEntityB] = useState("");
  const [h2hResult, setH2hResult] = useState<H2HResponse | null>(null);
  const [isLoadingH2H, setIsLoadingH2H] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch<{ players: LeaderboardItem[]; pairs: LeaderboardItem[] }>(
        "/api/v1/player/scorekeeper/stats"
      );
      setPlayers(res.players);
      setPairs(res.pairs);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunH2H = async () => {
    if (!h2hEntityA || !h2hEntityB) return;
    if (h2hEntityA === h2hEntityB) {
      alert("Hãy chọn hai đối tượng khác nhau để so sánh!");
      return;
    }
    setIsLoadingH2H(true);
    try {
      const res = await apiFetch<H2HResponse>(
        `/api/v1/player/scorekeeper/h2h?a=${encodeURIComponent(h2hEntityA)}&b=${encodeURIComponent(h2hEntityB)}`
      );
      setH2hResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingH2H(false);
    }
  };

  // Build the list of entities available for H2H comparison
  // Combines individual players and double pairs
  const comparisonOptions = [
    ...players.map((p) => ({ key: p.key, name: `[Cá nhân] ${p.name}` })),
    ...pairs.filter((p) => p.key.includes("||")).map((p) => ({ key: p.key, name: `[Cặp đấu] ${p.name}` })),
  ];

  const getEntityDisplayName = (key: string) => {
    const found = comparisonOptions.find((o) => o.key === key);
    return found ? found.name : key;
  };

  return (
    <main className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6">
      <PageHero
        eyebrow="Thống kê"
        title="Bảng Thống Kê & Phân Tích Đối Đầu"
        description="Theo dõi thứ hạng, tỷ lệ thắng của các tay vợt và phân tích lịch sử đối đầu chi tiết."
      />

      <div className="mb-6">
        <Link href="/player/scorekeeper" className="text-sm font-bold text-red-800 hover:underline">
          ← Quay lại bảng trọng tài đếm điểm
        </Link>
      </div>

      {/* Sub Tabs */}
      <div className="flex border-b border-slate-200 mb-8 overflow-x-auto gap-2">
        <button
          onClick={() => setActiveSubTab("individual")}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition shrink-0 cursor-pointer ${
            activeSubTab === "individual" ? "border-red-800 text-red-800" : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          👤 BXH Cá Nhân
        </button>
        <button
          onClick={() => setActiveSubTab("pairs")}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition shrink-0 cursor-pointer ${
            activeSubTab === "pairs" ? "border-red-800 text-red-800" : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          👥 BXH Cặp Đấu
        </button>
        <button
          onClick={() => setActiveSubTab("h2h")}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition shrink-0 cursor-pointer ${
            activeSubTab === "h2h" ? "border-red-800 text-red-800" : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          ⚔️ Đối Đầu Trực Tiếp (H2H)
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-400 text-center py-10">Đang tải dữ liệu phân tích thống kê...</p>
      ) : (
        <>
          {/* Individual Leaderboard */}
          {activeSubTab === "individual" && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-slate-900">Thứ hạng tỷ lệ thắng cá nhân (Chơi tối thiểu 1 trận)</h2>
              {players.length === 0 ? (
                <EmptyState title="Không có dữ liệu" description="Chưa có trận đấu nào được lưu để tính toán thứ hạng." />
              ) : (
                <div className="overflow-hidden border border-slate-200/80 rounded-2xl bg-white shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-slate-100">
                          <th className="py-3.5 px-4 text-center w-16">Hạng</th>
                          <th className="py-3.5 px-4">Tên người chơi</th>
                          <th className="py-3.5 px-4 text-center">Đã chơi</th>
                          <th className="py-3.5 px-4 text-center">Thắng</th>
                          <th className="py-3.5 px-4 text-center">Thua</th>
                          <th className="py-3.5 px-4 text-center w-36">Tỷ lệ thắng</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {players.map((p, idx) => (
                          <tr key={p.key} className="hover:bg-slate-50/50 transition">
                            <td className="py-3.5 px-4 text-center font-black text-slate-400 text-xs">
                              {idx + 1 <= 3 ? (
                                <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-black text-white ${
                                  idx === 0 ? "bg-amber-400" : idx === 1 ? "bg-slate-400" : "bg-amber-600"
                                }`}>
                                  {idx + 1}
                                </span>
                              ) : idx + 1}
                            </td>
                            <td className="py-3.5 px-4">
                               <Link
                                 href={`/player/scorekeeper/player?key=${encodeURIComponent(p.key)}`}
                                 className="flex items-center gap-3 hover:text-red-800 transition group cursor-pointer"
                              >
                                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-xs font-bold text-red-800 overflow-hidden shrink-0">
                                  {p.avatar_url ? <img src={p.avatar_url} alt="" className="object-cover w-full h-full" /> : p.name[0].toUpperCase()}
                                </div>
                                <span className="font-bold group-hover:underline">{p.name}</span>
                              </Link>
                            </td>
                            <td className="py-3.5 px-4 text-center font-bold text-slate-900">{p.played}</td>
                            <td className="py-3.5 px-4 text-center text-emerald-600 font-bold">{p.wins}</td>
                            <td className="py-3.5 px-4 text-center text-rose-600 font-bold">{p.losses}</td>
                            <td className="py-3.5 px-4 text-center">
                              <div className="flex items-center gap-2 justify-center">
                                <span className="font-black text-slate-900 text-sm">{p.win_rate}%</span>
                                <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden hidden sm:block">
                                  <div className="bg-red-800 h-full rounded-full" style={{ width: `${p.win_rate}%` }} />
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Pairs Leaderboard */}
          {activeSubTab === "pairs" && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-slate-900">Thứ hạng tỷ lệ thắng cặp đấu đấu đôi</h2>
              {pairs.length === 0 ? (
                <EmptyState title="Không có dữ liệu" description="Chưa có trận đấu đôi nào được lưu để tính toán thứ hạng." />
              ) : (
                <div className="overflow-hidden border border-slate-200/80 rounded-2xl bg-white shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-slate-100">
                          <th className="py-3.5 px-4 text-center w-16">Hạng</th>
                          <th className="py-3.5 px-4">Tên cặp đấu</th>
                          <th className="py-3.5 px-4 text-center">Đã chơi</th>
                          <th className="py-3.5 px-4 text-center">Thắng</th>
                          <th className="py-3.5 px-4 text-center">Thua</th>
                          <th className="py-3.5 px-4 text-center w-36">Tỷ lệ thắng</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {pairs.map((p, idx) => (
                          <tr key={p.key} className="hover:bg-slate-50/50 transition">
                            <td className="py-3.5 px-4 text-center font-black text-slate-400 text-xs">
                              {idx + 1 <= 3 ? (
                                <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-black text-white ${
                                  idx === 0 ? "bg-amber-400" : idx === 1 ? "bg-slate-400" : "bg-amber-600"
                                }`}>
                                  {idx + 1}
                                </span>
                              ) : idx + 1}
                            </td>
                            <td className="py-3.5 px-4">
                               <Link
                                 href={`/player/scorekeeper/player?key=${encodeURIComponent(p.key)}`}
                                 className="font-bold hover:text-red-800 transition hover:underline cursor-pointer"
                              >
                                👥 {p.name}
                              </Link>
                            </td>
                            <td className="py-3.5 px-4 text-center font-bold text-slate-900">{p.played}</td>
                            <td className="py-3.5 px-4 text-center text-emerald-600 font-bold">{p.wins}</td>
                            <td className="py-3.5 px-4 text-center text-rose-600 font-bold">{p.losses}</td>
                            <td className="py-3.5 px-4 text-center">
                              <div className="flex items-center gap-2 justify-center">
                                <span className="font-black text-slate-900 text-sm">{p.win_rate}%</span>
                                <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden hidden sm:block">
                                  <div className="bg-red-800 h-full rounded-full" style={{ width: `${p.win_rate}%` }} />
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Head to Head Analyzer */}
          {activeSubTab === "h2h" && (
            <div className="space-y-6">
              <Card className="p-6 border border-slate-100 shadow-sm rounded-2xl bg-white max-w-3xl mx-auto">
                <h2 className="text-base font-bold text-slate-900 mb-4">So sánh lịch sử đối đầu (H2H)</h2>
                
                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Đối tượng A</label>
                    <select
                      value={h2hEntityA}
                      onChange={(e) => setH2hEntityA(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-800"
                    >
                      <option value="">-- Chọn đối thủ A --</option>
                      {comparisonOptions.map((o) => (
                        <option key={o.key} value={o.key}>{o.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Đối tượng B</label>
                    <select
                      value={h2hEntityB}
                      onChange={(e) => setH2hEntityB(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-800"
                    >
                      <option value="">-- Chọn đối thủ B --</option>
                      {comparisonOptions.map((o) => (
                        <option key={o.key} value={o.key}>{o.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={handleRunH2H}
                    disabled={!h2hEntityA || !h2hEntityB || isLoadingH2H}
                    className="bg-red-800 hover:bg-red-950 text-white font-bold px-6 py-2.5 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                  >
                    {isLoadingH2H ? "Đang so sánh..." : "⚔️ Phân tích đối đầu"}
                  </button>
                </div>
              </Card>

              {/* H2H Results display */}
              {h2hResult && (
                <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-200">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <StatCard
                      label="Tổng trận đối đầu"
                      value={h2hResult.total_played}
                      tone="default"
                    />
                    <StatCard
                      label={`Số trận ${getEntityDisplayName(h2hEntityA).split("] ").pop()} thắng`}
                      value={`${h2hResult.a_wins} (${h2hResult.a_win_rate}%)`}
                      tone="success"
                    />
                    <StatCard
                      label={`Số trận ${getEntityDisplayName(h2hEntityB).split("] ").pop()} thắng`}
                      value={`${h2hResult.b_wins} (${h2hResult.b_win_rate}%)`}
                      tone="warning"
                    />
                  </div>

                  {/* Win comparison bar */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
                    <h3 className="text-sm font-bold text-slate-800 text-center mb-4">So sánh tương quan thắng bại</h3>
                    
                    <div className="flex justify-between text-xs font-bold text-slate-500 mb-2">
                      <span>{getEntityDisplayName(h2hEntityA).split("] ").pop()}</span>
                      <span>{getEntityDisplayName(h2hEntityB).split("] ").pop()}</span>
                    </div>

                    <div className="w-full bg-slate-100 rounded-full h-6 overflow-hidden flex shadow-inner">
                      {h2hResult.total_played > 0 ? (
                        <>
                          <div 
                            className="bg-emerald-600 h-full text-white font-black text-xs flex items-center justify-center transition-all"
                            style={{ width: `${h2hResult.a_win_rate}%` }}
                          >
                            {h2hResult.a_wins > 0 && `${h2hResult.a_win_rate}%`}
                          </div>
                          <div 
                            className="bg-indigo-600 h-full text-white font-black text-xs flex items-center justify-center transition-all"
                            style={{ width: `${h2hResult.b_win_rate}%` }}
                          >
                            {h2hResult.b_wins > 0 && `${h2hResult.b_win_rate}%`}
                          </div>
                        </>
                      ) : (
                        <div className="w-full text-slate-400 text-xs font-semibold flex items-center justify-center">Chưa có trận nào đấu chéo</div>
                      )}
                    </div>
                  </div>

                  {/* List of matched H2H games */}
                  <div className="space-y-4">
                    <h3 className="font-bold text-slate-900 text-sm">Danh sách các trận đấu lịch sử</h3>
                    {h2hResult.matches.length === 0 ? (
                      <EmptyState title="Không có lịch sử" description="Hai đối tượng này chưa từng đối mặt trực tiếp." />
                    ) : (
                      <div className="grid gap-4 md:grid-cols-2">
                        {h2hResult.matches.map((m) => {
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
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}
