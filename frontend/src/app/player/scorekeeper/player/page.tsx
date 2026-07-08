"use client";

import { useEffect, useState, useMemo, Suspense, Fragment } from "react";
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

  // States for filtering and sorting match history table
  const [filterType, setFilterType] = useState<"all" | "singles" | "doubles">("all");
  const [filterResult, setFilterResult] = useState<"all" | "win" | "loss">("all");
  const [searchName, setSearchName] = useState("");
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "closest" | "dominant" | "duration_desc" | "duration_asc">("date_desc");
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);

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
  const filteredMatches = useMemo(() => {
    if (!data?.matches) return [];

    let result = [...data.matches];

    // 1. Lọc theo thể thức đấu (Đơn/Đôi)
    if (filterType !== "all") {
      result = result.filter(m => m.match_type === filterType);
    }

    // 2. Lọc theo kết quả Thắng/Thua của người chơi đang xem
    if (filterResult !== "all") {
      result = result.filter(m => {
        const ta_p1_id = m.team_a.player1.id;
        const ta_p1_name = m.team_a.player1.name;
        const ta_p2_id = m.team_a.player2?.id;
        const ta_p2_name = m.team_a.player2?.name;
        
        const tb_p1_id = m.team_b.player1.id;
        const tb_p1_name = m.team_b.player1.name;
        const tb_p2_id = m.team_b.player2?.id;
        const tb_p2_name = m.team_b.player2?.name;

        const isPlayerInTeamA = 
          ta_p1_id === rawKey.replace("id:", "") || 
          ta_p1_name.toLowerCase() === rawKey.replace("name:", "").toLowerCase() ||
          (ta_p2_id && ta_p2_id === rawKey.replace("id:", "")) ||
          (ta_p2_name && ta_p2_name.toLowerCase() === rawKey.replace("name:", "").toLowerCase());

        const isWinnerA = m.winner_team === "A";
        const isPlayerWinner = (isPlayerInTeamA && isWinnerA) || (!isPlayerInTeamA && !isWinnerA);

        return filterResult === "win" ? isPlayerWinner : !isPlayerWinner;
      });
    }

    // 3. Lọc theo tìm kiếm tên đồng đội hoặc đối thủ
    if (searchName.trim()) {
      const q = searchName.toLowerCase().trim();
      result = result.filter(m => {
        const ta1 = m.team_a.player1.name.toLowerCase();
        const ta2 = m.team_a.player2?.name?.toLowerCase() || "";
        const tb1 = m.team_b.player1.name.toLowerCase();
        const tb2 = m.team_b.player2?.name?.toLowerCase() || "";
        return ta1.includes(q) || ta2.includes(q) || tb1.includes(q) || tb2.includes(q);
      });
    }

    // Hàm phụ trợ tính tổng thời lượng thi đấu trận (giây)
    const getMatchDuration = (match: any) => {
      if (!match.sets || !Array.isArray(match.sets)) return 0;
      return match.sets.reduce((sum: number, s: any) => sum + (s.duration_seconds || 0), 0);
    };

    // Hàm phụ trợ tính độ sát nút của trận đấu (tổng chênh lệch điểm số các set)
    const getMatchScoreGap = (match: any) => {
      if (!match.sets || !Array.isArray(match.sets)) return 0;
      return match.sets.reduce((sum: number, s: any) => sum + Math.abs(s.team_a - s.team_b), 0);
    };

    // 4. Sắp xếp danh sách trận đấu
    result.sort((x, y) => {
      if (sortBy === "date_desc") {
        return new Date(y.played_at).getTime() - new Date(x.played_at).getTime();
      }
      if (sortBy === "date_asc") {
        return new Date(x.played_at).getTime() - new Date(y.played_at).getTime();
      }
      if (sortBy === "closest") {
        return getMatchScoreGap(x) - getMatchScoreGap(y);
      }
      if (sortBy === "dominant") {
        return getMatchScoreGap(y) - getMatchScoreGap(x);
      }
      if (sortBy === "duration_desc") {
        return getMatchDuration(y) - getMatchDuration(x);
      }
      if (sortBy === "duration_asc") {
        return getMatchDuration(x) - getMatchDuration(y);
      }
      return 0;
    });

    return result;
  }, [data, filterType, filterResult, searchName, sortBy, rawKey]);

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

  const formatDuration = (seconds?: number) => {
    if (seconds === undefined || seconds === null) return "-";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins} phút ${secs} giây`;
    }
    return `${secs} giây`;
  };

  const renderMomentumChart = (sets: any[], teamAName: string, teamBName: string) => {
    return (
      <div className="space-y-6 pt-4 border-t border-slate-100">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <span>📈 Biểu đồ diễn biến điểm số (Momentum)</span>
        </h4>
        <div className="grid gap-4 sm:grid-cols-2">
          {sets.map((set, setIdx) => {
            const history = set.score_history;
            if (!history || !Array.isArray(history) || history.length === 0) {
              return (
                <div key={setIdx} className="text-xs text-slate-400 italic bg-slate-50 border border-slate-100 rounded-2xl p-4 text-center flex flex-col items-center justify-center min-h-[120px]">
                  <span>Hiệp {setIdx + 1} ({set.team_a} - {set.team_b})</span>
                  <span className="text-[10px] mt-1 text-slate-300">Không có dữ liệu tiến trình điểm</span>
                </div>
              );
            }

            const width = 500;
            const height = 220;
            const padding = 35;
            const chartWidth = width - padding * 2;
            const chartHeight = height - padding * 2;

            const xMax = history.length;
            const yMax = Math.max(set.team_a, set.team_b, 21);

            const pointsA: [number, number][] = [[0, 0]];
            const pointsB: [number, number][] = [[0, 0]];
            history.forEach((pts, idx) => {
              if (Array.isArray(pts) && pts.length === 2) {
                pointsA.push([idx + 1, pts[0]]);
                pointsB.push([idx + 1, pts[1]]);
              }
            });

            const getX = (x: number) => padding + (x / xMax) * chartWidth;
            const getY = (y: number) => padding + chartHeight - (y / yMax) * chartHeight;

            let pathA = "";
            let pathB = "";
            pointsA.forEach((p, idx) => {
              const x = getX(p[0]);
              const y = getY(p[1]);
              if (idx === 0) pathA += `M ${x} ${y}`;
              else pathA += ` L ${x} ${y}`;
            });
            pointsB.forEach((p, idx) => {
              const x = getX(p[0]);
              const y = getY(p[1]);
              if (idx === 0) pathB += `M ${x} ${y}`;
              else pathB += ` L ${x} ${y}`;
            });

            return (
              <div key={setIdx} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-white space-y-3 shadow-inner">
                <p className="text-xs font-black text-slate-350 flex justify-between">
                  <span>Hiệp {setIdx + 1}</span>
                  <span className="text-slate-400 font-bold bg-slate-800 px-2 py-0.5 rounded text-[10px]">{set.team_a} - {set.team_b}</span>
                </p>
                <div className="relative">
                  <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
                    {/* Grid lines */}
                    {Array.from({ length: 5 }).map((_, i) => {
                      const yVal = Math.round((yMax / 4) * i);
                      const y = getY(yVal);
                      return (
                        <g key={i}>
                          <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#1e293b" strokeDasharray="3" />
                          <text x={padding - 10} y={y + 3} fill="#475569" className="text-[10px] font-black" textAnchor="end">{yVal}</text>
                        </g>
                      );
                    })}
                    {/* X axis labels */}
                    <text x={getX(0)} y={height - padding + 15} fill="#475569" className="text-[10px] font-black" textAnchor="middle">0</text>
                    <text x={getX(Math.round(xMax / 2))} y={height - padding + 15} fill="#475569" className="text-[10px] font-black" textAnchor="middle">Giữa hiệp</text>
                    <text x={getX(xMax)} y={height - padding + 15} fill="#475569" className="text-[10px] font-black" textAnchor="middle">Chung cuộc</text>

                    {/* Line paths */}
                    <path d={pathA} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    <path d={pathB} fill="none" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                    {/* Dots at the end */}
                    <circle cx={getX(xMax)} cy={getY(set.team_a)} r="5" fill="#10b981" stroke="#ffffff" strokeWidth="1" />
                    <circle cx={getX(xMax)} cy={getY(set.team_b)} r="5" fill="#6366f1" stroke="#ffffff" strokeWidth="1" />
                  </svg>
                </div>
                <div className="flex gap-4 justify-center text-[10px] pt-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-1 bg-emerald-500 rounded-full" />
                    <span className="text-slate-400 font-bold max-w-[100px] truncate">{teamAName}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-1 bg-indigo-500 rounded-full" />
                    <span className="text-slate-400 font-bold max-w-[100px] truncate">{teamBName}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderPerformanceTable = (sets: any[], teamAName: string, teamBName: string) => {
    const hasStats = sets.some(s => s.duration_seconds !== undefined || s.longest_run_a !== undefined);
    if (!hasStats) return null;

    return (
      <div className="space-y-3 pt-4 border-t border-slate-100">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">📊 So sánh hiệu suất theo hiệp</h4>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/50 shadow-3xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-600 font-black border-b border-slate-200">
                <th className="px-4 py-2.5">Chỉ số thống kê</th>
                {sets.map((_, idx) => (
                  <th key={idx} className="px-4 py-2.5 text-center">Hiệp {idx + 1}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700 font-medium">
              <tr className="hover:bg-slate-100/30 transition">
                <td className="px-4 py-2.5 font-bold text-slate-800">Tỷ số hiệp</td>
                {sets.map((s, idx) => (
                  <td key={idx} className="px-4 py-2.5 text-center font-black">
                    <span className="text-emerald-700">{s.team_a}</span> - <span className="text-indigo-700">{s.team_b}</span>
                  </td>
                ))}
              </tr>
              <tr className="hover:bg-slate-100/30 transition">
                <td className="px-4 py-2.5 font-bold text-slate-800">Thời lượng đấu</td>
                {sets.map((s, idx) => (
                  <td key={idx} className="px-4 py-2.5 text-center text-slate-500">
                    {formatDuration(s.duration_seconds)}
                  </td>
                ))}
              </tr>
              <tr className="hover:bg-slate-100/30 transition">
                <td className="px-4 py-2.5 font-bold text-slate-800">Chuỗi ăn điểm dài nhất</td>
                {sets.map((s, idx) => (
                  <td key={idx} className="px-4 py-2.5 text-center">
                    <div className="flex justify-center items-center gap-1">
                      <span className="text-emerald-700 font-extrabold">{s.longest_run_a ?? "-"}</span>
                      <span className="text-slate-300">/</span>
                      <span className="text-indigo-700 font-extrabold">{s.longest_run_b ?? "-"}</span>
                    </div>
                  </td>
                ))}
              </tr>
              <tr className="hover:bg-slate-100/30 transition">
                <td className="px-4 py-2.5 font-bold text-slate-800">Sửa điểm (Undo)</td>
                {sets.map((s, idx) => (
                  <td key={idx} className="px-4 py-2.5 text-center text-slate-500">
                    {s.undo_count ?? 0} lần
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-slate-400 italic">
          * Chuỗi điểm hiển thị: <span className="text-emerald-700 font-bold">{teamAName}</span> / <span className="text-indigo-700 font-bold">{teamBName}</span>.
        </p>
      </div>
    );
  };

  const formatMatchTimePeriod = (playedAtStr: string, sets: any[]) => {
    const endTime = new Date(playedAtStr);
    
    const totalDurationSeconds = sets && Array.isArray(sets)
      ? sets.reduce((sum, s) => sum + (s.duration_seconds || 0), 0)
      : 0;

    const formattedDate = endTime.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit"
    });

    const formatTime = (date: Date) => {
      return date.toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      });
    };

    const endTimeStr = formatTime(endTime);

    if (totalDurationSeconds > 0) {
      const startTime = new Date(endTime.getTime() - totalDurationSeconds * 1000);
      const startTimeStr = formatTime(startTime);
      const totalMinutes = Math.ceil(totalDurationSeconds / 60);
      return {
        timeRange: `${startTimeStr} - ${endTimeStr}`,
        date: formattedDate,
        durationStr: `${totalMinutes} phút`
      };
    }

    return {
      timeRange: endTimeStr,
      date: formattedDate,
      durationStr: null
    };
  };

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
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Lịch sử đấu chi tiết (Đảm bảo minh bạch)</h3>
              <p className="text-xs text-slate-400">Danh sách các trận đấu mà đấu thủ này trực tiếp tham gia</p>
            </div>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg font-bold border border-slate-200 shrink-0 self-start sm:self-center">
              Đang hiển thị: {filteredMatches.length} / {data.matches.length} trận
            </span>
          </div>

          {/* Bộ lọc & Sắp xếp */}
          <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-center shadow-3xs">
            {/* Tìm kiếm tên */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Tìm đối thủ / đồng đội</label>
              <input
                type="text"
                placeholder="Nhập tên người chơi..."
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-red-800 text-slate-750 font-semibold"
              />
            </div>

            {/* Thể thức */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Thể thức</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none text-slate-750 font-semibold cursor-pointer"
              >
                <option value="all">Tất cả thể thức</option>
                <option value="singles">Đấu Đơn</option>
                <option value="doubles">Đấu Đôi</option>
              </select>
            </div>

            {/* Kết quả */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Kết quả</label>
              <select
                value={filterResult}
                onChange={(e) => setFilterResult(e.target.value as any)}
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none text-slate-750 font-semibold cursor-pointer"
              >
                <option value="all">Tất cả kết quả</option>
                <option value="win">Thắng cuộc</option>
                <option value="loss">Thua cuộc</option>
              </select>
            </div>

            {/* Sắp xếp */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Sắp xếp theo</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none text-slate-750 font-semibold cursor-pointer"
              >
                <option value="date_desc">Mới nhất</option>
                <option value="date_asc">Cũ nhất</option>
                <option value="closest">Trận sát nút nhất</option>
                <option value="dominant">Trận áp đảo nhất</option>
                <option value="duration_desc">Thời lượng lâu nhất</option>
                <option value="duration_asc">Thời lượng nhanh nhất</option>
              </select>
            </div>
          </div>

          {/* Bảng kết quả */}
          {filteredMatches.length === 0 ? (
            <EmptyState 
              title="Không tìm thấy trận đấu nào phù hợp" 
              description="Hãy thử thay đổi bộ lọc hoặc từ khóa tìm kiếm tên đối thủ/đồng đội khác." 
            />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 text-slate-500 font-black border-b border-slate-200/80">
                    <th className="px-4 py-3 min-w-[110px]">Thời gian</th>
                    <th className="px-4 py-3">Thể thức</th>
                    <th className="px-4 py-3 text-right">Đội A</th>
                    <th className="px-4 py-3 text-center min-w-[90px]">Tỷ số</th>
                    <th className="px-4 py-3 text-left">Đội B</th>
                    <th className="px-4 py-3 text-center">Kết quả</th>
                    <th className="px-4 py-3 text-center">Phân tích</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-semibold">
                  {filteredMatches.map((m) => {
                    const isSingles = m.match_type === "singles";
                    const isWonA = m.winner_team === "A";

                    const ta_p1_id = m.team_a.player1.id;
                    const ta_p1_name = m.team_a.player1.name;
                    const ta_p2_id = m.team_a.player2?.id;
                    const ta_p2_name = m.team_a.player2?.name;

                    const isPlayerInTeamA = 
                      ta_p1_id === rawKey.replace("id:", "") || 
                      ta_p1_name.toLowerCase() === rawKey.replace("name:", "").toLowerCase() ||
                      (ta_p2_id && ta_p2_id === rawKey.replace("id:", "")) ||
                      (ta_p2_name && ta_p2_name.toLowerCase() === rawKey.replace("name:", "").toLowerCase());

                    const isPlayerWinner = (isPlayerInTeamA && isWonA) || (!isPlayerInTeamA && !isWonA);
                    
                    const { timeRange, date, durationStr } = formatMatchTimePeriod(m.played_at, m.sets);

                    return (
                      <Fragment key={m.id}>
                        <tr 
                          onClick={() => setExpandedMatchId(expandedMatchId === m.id ? null : m.id)}
                          className={`hover:bg-slate-50/55 transition cursor-pointer select-none ${
                            expandedMatchId === m.id ? "bg-slate-50/40" : ""
                          }`}
                        >
                          {/* Thời gian */}
                          <td className="px-4 py-3.5">
                            <p className="text-slate-900 font-bold">{timeRange}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5 font-medium">{date} {durationStr && `· ${durationStr}`}</p>
                          </td>

                          {/* Thể thức */}
                          <td className="px-4 py-3.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                              isSingles ? "bg-amber-50 text-amber-800 border border-amber-200" : "bg-red-50 text-red-800 border border-red-200"
                            }`}>
                              {isSingles ? "Đơn" : "Đôi"}
                            </span>
                          </td>

                          {/* Đội A */}
                          <td className="px-4 py-3.5 text-right">
                            <div className="space-y-0.5 max-w-[150px] ml-auto">
                              <p className={`truncate text-slate-800 ${isWonA ? "font-black" : "text-slate-500 font-medium"}`}>
                                {m.team_a.player1.name}
                              </p>
                              {!isSingles && m.team_a.player2 && (
                                <p className={`truncate text-[10px] ${isWonA ? "text-slate-600 font-bold" : "text-slate-400 font-medium"}`}>
                                  {m.team_a.player2.name}
                                </p>
                              )}
                            </div>
                          </td>

                          {/* Tỷ số */}
                          <td className="px-4 py-3.5 text-center">
                            <div className="inline-flex flex-col items-center">
                              <span className="text-xs font-black">
                                <span className="text-emerald-700">{m.team_a.score}</span> - <span className="text-indigo-700">{m.team_b.score}</span>
                              </span>
                              <span className="text-[9px] text-slate-400 font-medium mt-0.5 tracking-tight">
                                ({m.sets.map((s: any) => `${s.team_a}-${s.team_b}`).join(", ")})
                              </span>
                            </div>
                          </td>

                          {/* Đội B */}
                          <td className="px-4 py-3.5 text-left">
                            <div className="space-y-0.5 max-w-[150px]">
                              <p className={`truncate text-slate-800 ${!isWonA ? "font-black" : "text-slate-500 font-medium"}`}>
                                {m.team_b.player1.name}
                              </p>
                              {!isSingles && m.team_b.player2 && (
                                <p className={`truncate text-[10px] ${!isWonA ? "text-slate-600 font-bold" : "text-slate-400 font-medium"}`}>
                                  {m.team_b.player2.name}
                                </p>
                              )}
                            </div>
                          </td>

                          {/* Kết quả */}
                          <td className="px-4 py-3.5 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                              isPlayerWinner 
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200" 
                                : "bg-slate-100 text-slate-500 border border-slate-200"
                            }`}>
                              {isPlayerWinner ? "Thắng" : "Thua"}
                            </span>
                          </td>

                          {/* Phân tích */}
                          <td className="px-4 py-3.5 text-center">
                            <span className="text-xs font-bold text-red-800 flex items-center justify-center">
                              {expandedMatchId === m.id ? "▲" : "📊"}
                            </span>
                          </td>
                        </tr>

                        {/* Mở rộng phân tích */}
                        {expandedMatchId === m.id && (
                          <tr className="bg-slate-50/40">
                            <td colSpan={7} className="px-5 py-4 border-t border-b border-slate-100">
                              <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
                                {renderPerformanceTable(m.sets, m.team_a.player1.name, m.team_b.player1.name)}
                                {renderMomentumChart(m.sets, m.team_a.player1.name, m.team_b.player1.name)}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
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
