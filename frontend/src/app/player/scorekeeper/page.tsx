"use client";

import { useEffect, useState, useRef } from "react";
import { Card, PageHero, Notice, StatCard, EmptyState, ButtonLink } from "@/components/ui";
import { apiFetch } from "@/lib/http";
import { errorMessage } from "@/lib/format";
import Link from "next/link";

type AutocompleteUser = {
  id: string;
  full_name: string;
  avatar_url: string | null;
};

type SetScore = {
  team_a: number;
  team_b: number;
};

const numberToVietnamese = (num: number): string => {
  const words = [
    "không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín", "mười",
    "mười một", "mười hai", "mười ba", "mười bốn", "mười lăm", "mười sáu", "mười bảy", "mười tám", "mười chín", "hai mươi",
    "hai mốt", "hai hai", "hai ba", "hai tư", "hai lăm", "hai sáu", "hai bảy", "hai tám", "hai chín", "ba mươi"
  ];
  return words[num] || num.toString();
};

export default function ScorekeeperPage() {
  const [activeTab, setActiveTab] = useState<"live" | "quick" | "history">("live");
  
  // Players configuration state
  const [matchType, setMatchType] = useState<"singles" | "doubles">("doubles");
  const [taP1, setTaP1] = useState({ id: "", name: "" });
  const [taP2, setTaP2] = useState({ id: "", name: "" });
  const [tbP1, setTbP1] = useState({ id: "", name: "" });
  const [tbP2, setTbP2] = useState({ id: "", name: "" });

  const [activeSearchField, setActiveSearchField] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<AutocompleteUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Quick Guest Registration State
  const [isAddingGuest, setIsAddingGuest] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [isSavingGuest, setIsSavingGuest] = useState(false);
  const [guestError, setGuestError] = useState("");

  // Live Scoreboard State
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [setScores, setSetScores] = useState<SetScore[]>([]); // completed sets
  const [currentA, setCurrentA] = useState(0);
  const [currentB, setCurrentB] = useState(0);
  const [setsWonA, setSetsWonA] = useState(0);
  const [setsWonB, setSetsWonB] = useState(0);
  const [swapped, setSwapped] = useState(false); // Court side swap toggle
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  
  // History stack for Undo/Redo
  const [scoreHistory, setScoreHistory] = useState<{ a: number; b: number }[]>([]);
  const [redoHistory, setRedoHistory] = useState<{ a: number; b: number }[]>([]);
  const [intervalAnnounced, setIntervalAnnounced] = useState(false);

  // Quick Record State
  const [quickPlayedAt, setQuickPlayedAt] = useState("");
  const [quickSet1A, setQuickSet1A] = useState("0");
  const [quickSet1B, setQuickSet1B] = useState("0");
  const [quickSet2A, setQuickSet2A] = useState("0");
  const [quickSet2B, setQuickSet2B] = useState("0");
  const [quickSet3A, setQuickSet3A] = useState("0");
  const [quickSet3B, setQuickSet3B] = useState("0");
  const [quickUseSet3, setQuickUseSet3] = useState(false);

  // Matches list state
  const [matches, setMatches] = useState<any[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);

  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState<"success" | "danger" | "warning" | "">("");

  useEffect(() => {
    if (activeTab === "history") {
      loadHistory();
    }
  }, [activeTab]);

  // Autocomplete fetcher
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await apiFetch<AutocompleteUser[]>(`/api/v1/player/scorekeeper/players?q=${encodeURIComponent(searchQuery)}`);
        setSearchResults(res);
      } catch (err) {
        console.error("Lỗi tìm kiếm người chơi", err);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadHistory = async () => {
    setIsLoadingMatches(true);
    try {
      const res = await apiFetch<any[]>("/api/v1/player/scorekeeper/matches");
      setMatches(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingMatches(false);
    }
  };

  const handleSelectUser = (user: AutocompleteUser) => {
    const isSelected = 
      (activeSearchField !== "taP1" && taP1.id === user.id) ||
      (activeSearchField !== "taP2" && taP2.id === user.id) ||
      (activeSearchField !== "tbP1" && tbP1.id === user.id) ||
      (activeSearchField !== "tbP2" && tbP2.id === user.id);
      
    if (isSelected && user.id) {
      alert("Người chơi này đã được chọn ở vị trí khác!");
      return;
    }

    if (activeSearchField === "taP1") setTaP1({ id: user.id, name: user.full_name });
    if (activeSearchField === "taP2") setTaP2({ id: user.id, name: user.full_name });
    if (activeSearchField === "tbP1") setTbP1({ id: user.id, name: user.full_name });
    if (activeSearchField === "tbP2") setTbP2({ id: user.id, name: user.full_name });
    
    setActiveSearchField(null);
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleSaveGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuestError("");
    const name = guestName.trim();
    const email = guestEmail.trim().toLowerCase();
    
    if (!name) {
      setGuestError("Họ tên không được để trống");
      return;
    }
    if (!email || !email.includes("@")) {
      setGuestError("Email không hợp lệ");
      return;
    }

    const isDuplicate = 
      (activeSearchField !== "taP1" && taP1.name.toLowerCase() === name.toLowerCase()) ||
      (activeSearchField !== "taP2" && taP2.name.toLowerCase() === name.toLowerCase()) ||
      (activeSearchField !== "tbP1" && tbP1.name.toLowerCase() === name.toLowerCase()) ||
      (activeSearchField !== "tbP2" && tbP2.name.toLowerCase() === name.toLowerCase());
      
    if (isDuplicate) {
      setGuestError("Người chơi này đã được chọn ở vị trí khác!");
      return;
    }
    
    setIsSavingGuest(true);
    try {
      const res = await apiFetch<{ id: string; full_name: string }>("/api/v1/player/scorekeeper/quick-register-player", {
        method: "POST",
        body: JSON.stringify({
          full_name: name,
          email: email,
          phone: guestPhone.trim() || null
        })
      });
      
      // Select the newly created user
      if (activeSearchField === "taP1") setTaP1({ id: res.id, name: res.full_name });
      if (activeSearchField === "taP2") setTaP2({ id: res.id, name: res.full_name });
      if (activeSearchField === "tbP1") setTbP1({ id: res.id, name: res.full_name });
      if (activeSearchField === "tbP2") setTbP2({ id: res.id, name: res.full_name });
      
      // Reset & Close
      setActiveSearchField(null);
      setSearchQuery("");
      setSearchResults([]);
      setIsAddingGuest(false);
      setGuestName("");
      setGuestEmail("");
      setGuestPhone("");
    } catch (err: any) {
      setGuestError(err?.message || "Không thể tạo thành viên mới");
    } finally {
      setIsSavingGuest(false);
    }
  };

  const speakText = (text: string) => {
    if (!voiceEnabled || typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "vi-VN";
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  };

  // Live points increment
  const addPoint = (team: "A" | "B") => {
    setScoreHistory([...scoreHistory, { a: currentA, b: currentB }]);
    setRedoHistory([]); // clear redo

    let nextA = currentA;
    let nextB = currentB;

    if (team === "A") {
      nextA = currentA + 1;
      setCurrentA(nextA);
    } else {
      nextB = currentB + 1;
      setCurrentB(nextB);
    }

    // Voice announcement
    // Let's swap the announce names based on visual position if swapped
    const nameA = taP1.name || "Đội A";
    const nameB = tbP1.name || "Đội B";
    
    // Check match conditions
    const reached21 = nextA >= 21 || nextB >= 21;
    const diff = Math.abs(nextA - nextB);
    const setFinished = (reached21 && diff >= 2) || nextA === 30 || nextB === 30;

    if (setFinished) {
      const isWinnerA = nextA > nextB;
      const winnerName = isWinnerA ? nameA : nameB;
      if (isWinnerA) {
        speakText(`Hiệp đấu kết thúc. ${winnerName} thắng hiệp này, tỷ số ${numberToVietnamese(nextA)} ${numberToVietnamese(nextB)}`);
      } else {
        speakText(`Hiệp đấu kết thúc. ${winnerName} thắng hiệp này, tỷ số ${numberToVietnamese(nextB)} ${numberToVietnamese(nextA)}`);
      }
      
      const newSets = [...setScores, { team_a: nextA, team_b: nextB }];
      setSetScores(newSets);

      const newSetsWonA = isWinnerA ? setsWonA + 1 : setsWonA;
      const newSetsWonB = !isWinnerA ? setsWonB + 1 : setsWonB;
      setSetsWonA(newSetsWonA);
      setSetsWonB(newSetsWonB);

      setCurrentA(0);
      setCurrentB(0);
      setScoreHistory([]);
      setRedoHistory([]);
      setIntervalAnnounced(false);

      // Check if match won
      if (newSetsWonA >= 2 || newSetsWonB >= 2) {
        speakText(`Trận đấu kết thúc! Xin chúc mừng ${newSetsWonA >= 2 ? nameA : nameB} đã dành chiến thắng chung cuộc.`);
      }
    } else {
      // Normal point call
      const isIntervalPoint = (nextA === 11 || nextB === 11);
      if (isIntervalPoint && !intervalAnnounced && ((nextA === 11 && nextB < 11) || (nextB === 11 && nextA < 11))) {
        setIntervalAnnounced(true);
        if (nextA === 11) {
          speakText(`Đổi sân kỹ thuật mười một điểm. ${nameA} dẫn trước mười một ${numberToVietnamese(nextB)}`);
        } else {
          speakText(`Đổi sân kỹ thuật mười một điểm. ${nameB} dẫn trước mười một ${numberToVietnamese(nextA)}`);
        }
      } else {
        if (team === "A") {
          speakText(`${numberToVietnamese(nextA)} ${numberToVietnamese(nextB)}`);
        } else {
          speakText(`${numberToVietnamese(nextB)} ${numberToVietnamese(nextA)}`);
        }
      }
    }
  };

  const undoPoint = () => {
    if (scoreHistory.length === 0) return;
    const last = scoreHistory[scoreHistory.length - 1];
    setRedoHistory([...redoHistory, { a: currentA, b: currentB }]);
    setCurrentA(last.a);
    setCurrentB(last.b);
    setScoreHistory(scoreHistory.slice(0, -1));

    if (last.a < 11 && last.b < 11) {
      setIntervalAnnounced(false);
    }
  };

  const redoPoint = () => {
    if (redoHistory.length === 0) return;
    const next = redoHistory[redoHistory.length - 1];
    setScoreHistory([...scoreHistory, { a: currentA, b: currentB }]);
    setCurrentA(next.a);
    setCurrentB(next.b);
    setRedoHistory(redoHistory.slice(0, -1));
  };

  const adjustScore = (team: "A" | "B", delta: number) => {
    if (team === "A") {
      setCurrentA(Math.max(0, currentA + delta));
    } else {
      setCurrentB(Math.max(0, currentB + delta));
    }
  };

  const handleSaveLiveMatch = async () => {
    const nameA1 = taP1.name.trim() || "Người chơi A1";
    const nameB1 = tbP1.name.trim() || "Người chơi B1";
    const nameA2 = matchType === "doubles" ? (taP2.name.trim() || "Người chơi A2") : null;
    const nameB2 = matchType === "doubles" ? (tbP2.name.trim() || "Người chơi B2") : null;

    const payload = {
      match_type: matchType,
      team_a_player1_id: taP1.id || null,
      team_a_player1_name: nameA1,
      team_a_player2_id: taP2.id || null,
      team_a_player2_name: nameA2,
      team_b_player1_id: tbP1.id || null,
      team_b_player1_name: nameB1,
      team_b_player2_id: tbP2.id || null,
      team_b_player2_name: nameB2,
      sets: setScores,
      team_a_score: setsWonA,
      team_b_score: setsWonB,
      played_at: new Date().toISOString()
    };

    try {
      await apiFetch("/api/v1/player/scorekeeper/matches", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      showStatus("Lưu kết quả trận đấu thành công!", "success");
      resetLiveMatch();
      setIsLiveActive(false);
      setActiveTab("history");
    } catch (err) {
      showStatus(errorMessage(err, "Lưu kết quả trận đấu thất bại"), "danger");
    }
  };

  const resetLiveMatch = () => {
    setCurrentA(0);
    setCurrentB(0);
    setSetsWonA(0);
    setSetsWonB(0);
    setSetScores([]);
    setScoreHistory([]);
    setRedoHistory([]);
    setIntervalAnnounced(false);
  };

  const handleSaveQuickMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameA1 = taP1.name.trim() || "Người chơi A1";
    const nameB1 = tbP1.name.trim() || "Người chơi B1";
    const nameA2 = matchType === "doubles" ? (taP2.name.trim() || "Người chơi A2") : null;
    const nameB2 = matchType === "doubles" ? (tbP2.name.trim() || "Người chơi B2") : null;

    const setsToSave: SetScore[] = [
      { team_a: parseInt(quickSet1A), team_b: parseInt(quickSet1B) },
      { team_a: parseInt(quickSet2A), team_b: parseInt(quickSet2B) }
    ];
    if (quickUseSet3) {
      setsToSave.push({ team_a: parseInt(quickSet3A), team_b: parseInt(quickSet3B) });
    }

    // Calculate sets won
    let quickWonA = 0;
    let quickWonB = 0;
    setsToSave.forEach((s) => {
      if (s.team_a > s.team_b) quickWonA++;
      else quickWonB++;
    });

    const payload = {
      match_type: matchType,
      team_a_player1_id: taP1.id || null,
      team_a_player1_name: nameA1,
      team_a_player2_id: taP2.id || null,
      team_a_player2_name: nameA2,
      team_b_player1_id: tbP1.id || null,
      team_b_player1_name: nameB1,
      team_b_player2_id: tbP2.id || null,
      team_b_player2_name: nameB2,
      sets: setsToSave,
      team_a_score: quickWonA,
      team_b_score: quickWonB,
      played_at: quickPlayedAt ? new Date(quickPlayedAt).toISOString() : new Date().toISOString()
    };

    try {
      await apiFetch("/api/v1/player/scorekeeper/matches", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      showStatus("Lưu kết quả trận đấu nhanh thành công!", "success");
      setActiveTab("history");
    } catch (err) {
      showStatus(errorMessage(err, "Lưu kết quả nhanh thất bại"), "danger");
    }
  };

  const showStatus = (msg: string, type: "success" | "danger" | "warning") => {
    setStatusMessage(msg);
    setStatusType(type);
    setTimeout(() => {
      setStatusMessage("");
      setStatusType("");
    }, 5000);
  };

  // Determine serve side
  const totalScoreCurrentSet = currentA + currentB;
  const isEvenScore = totalScoreCurrentSet % 2 === 0;

  return (
    <main className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6">
      <PageHero
        eyebrow="Trọng tài"
        title="Trọng tài & Thống kê Cầu lông"
        description="Đếm điểm trực tiếp chuẩn quốc tế BWF và phân tích tỷ lệ thắng kỳ phùng địch thủ."
      />

      {statusMessage && (
        <div className="my-4">
          <Notice tone={statusType === "success" ? "success" : "danger"}>
            {statusMessage}
          </Notice>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-8 overflow-x-auto gap-2">
        <button
          onClick={() => { setActiveTab("live"); setIsLiveActive(false); }}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition shrink-0 cursor-pointer ${activeTab === "live" ? "border-red-800 text-red-800" : "border-transparent text-slate-500 hover:text-slate-900"}`}
        >
          🏸 Trọng tài đếm điểm
        </button>
        <button
          onClick={() => { setActiveTab("quick"); }}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition shrink-0 cursor-pointer ${activeTab === "quick" ? "border-red-800 text-red-800" : "border-transparent text-slate-500 hover:text-slate-900"}`}
        >
          ✏️ Ghi kết quả nhanh
        </button>
        <button
          onClick={() => { setActiveTab("history"); }}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition shrink-0 cursor-pointer ${activeTab === "history" ? "border-red-800 text-red-800" : "border-transparent text-slate-500 hover:text-slate-900"}`}
        >
          📅 Lịch sử trận đấu
        </button>
        <Link
          href="/player/scorekeeper/stats"
          className="ml-auto px-5 py-3 text-sm font-bold text-red-800 hover:text-red-950 flex items-center gap-1.5 shrink-0"
        >
          📊 Thống kê & H2H →
        </Link>
      </div>

      {/* Main Autocomplete Panel */}
      {activeSearchField && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-2xl p-5 w-full max-w-md shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-900">
                {isAddingGuest ? "Tạo thành viên / Khách mới" : "Tìm kiếm thành viên"}
              </h3>
              <button
                onClick={() => {
                  setActiveSearchField(null);
                  setIsAddingGuest(false);
                  setGuestName("");
                  setGuestEmail("");
                  setGuestPhone("");
                  setGuestError("");
                }}
                className="text-slate-400 hover:text-slate-700 text-sm"
              >
                Đóng
              </button>
            </div>

            {isAddingGuest ? (
              <form onSubmit={handleSaveGuest} className="space-y-4">
                {guestError && (
                  <p className="text-xs text-rose-600 font-bold bg-rose-50 border border-rose-100 rounded-lg p-2">
                    {guestError}
                  </p>
                )}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Họ tên *
                  </label>
                  <input
                    type="text"
                    className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-red-800"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Nhập họ tên..."
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Email * (Ưu tiên đúng email để đồng bộ)
                  </label>
                  <input
                    type="email"
                    className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-red-800"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder="khach_vang_lai@domain.com"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Số điện thoại (Tùy chọn)
                  </label>
                  <input
                    type="tel"
                    className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-red-800"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    placeholder="Ví dụ: 0912345678"
                  />
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingGuest(false);
                      setGuestError("");
                    }}
                    className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Quay lại tìm kiếm
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingGuest}
                    className="px-4 py-2 text-xs font-bold text-white bg-red-800 hover:bg-red-900 rounded-xl disabled:opacity-50 cursor-pointer"
                  >
                    {isSavingGuest ? "Đang lưu..." : "Lưu & Chọn"}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <button
                  onClick={() => {
                    setIsAddingGuest(true);
                    setGuestName(searchQuery);
                    setGuestError("");
                  }}
                  className="w-full mb-3 flex items-center justify-center gap-1.5 py-2.5 border border-dashed border-red-200 text-red-800 hover:bg-red-50 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  ➕ Tạo thành viên / Khách mới
                </button>

                <input
                  type="text"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-800 mb-3"
                  placeholder="Nhập tên hoặc email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {isSearching ? (
                    <p className="text-xs text-slate-400 text-center py-4">Đang tìm kiếm...</p>
                  ) : searchResults.length > 0 ? (
                    searchResults.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => handleSelectUser(user)}
                        className="w-full flex items-center gap-3 p-2.5 hover:bg-slate-50 rounded-xl transition text-left cursor-pointer"
                      >
                        <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-xs font-bold text-red-800 overflow-hidden shrink-0">
                          {user.avatar_url ? <img src={user.avatar_url} alt="" className="object-cover w-full h-full" /> : user.full_name[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900 leading-none">{user.full_name}</p>
                        </div>
                      </button>
                    ))
                  ) : searchQuery ? (
                    <div className="text-center py-6">
                      <p className="text-xs text-slate-400">Không tìm thấy thành viên phù hợp</p>
                      <button
                        onClick={() => {
                          const typedName = searchQuery.trim();
                          const isDuplicate = 
                            (activeSearchField !== "taP1" && taP1.name.toLowerCase() === typedName.toLowerCase()) ||
                            (activeSearchField !== "taP2" && taP2.name.toLowerCase() === typedName.toLowerCase()) ||
                            (activeSearchField !== "tbP1" && tbP1.name.toLowerCase() === typedName.toLowerCase()) ||
                            (activeSearchField !== "tbP2" && tbP2.name.toLowerCase() === typedName.toLowerCase());
                            
                          if (isDuplicate) {
                            alert("Người chơi này đã được chọn ở vị trí khác!");
                            return;
                          }

                          if (activeSearchField === "taP1") setTaP1({ id: "", name: typedName });
                          if (activeSearchField === "taP2") setTaP2({ id: "", name: typedName });
                          if (activeSearchField === "tbP1") setTbP1({ id: "", name: typedName });
                          if (activeSearchField === "tbP2") setTbP2({ id: "", name: typedName });
                          setActiveSearchField(null);
                          setSearchQuery("");
                        }}
                        className="mt-2 text-xs text-red-800 font-bold hover:underline cursor-pointer"
                      >
                        Sử dụng tên "{searchQuery}" này
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 text-center py-4">Gõ để hiển thị kết quả gợi ý...</p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Configuration Form (Used for both Quick Record and starting Live Match) */}
      {(!isLiveActive || activeTab === "quick") && activeTab !== "history" && (
        <Card className="p-6 mb-8 max-w-3xl mx-auto border border-slate-100 shadow-sm rounded-2xl bg-white">
          <h2 className="text-lg font-bold text-slate-900 mb-5 flex items-center gap-2">
            <span>⚙️ Thiết lập đội hình đấu</span>
          </h2>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Chế độ thi đấu</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMatchType("singles")}
                  className={`flex-1 py-2 px-4 rounded-xl border text-sm font-bold transition cursor-pointer ${matchType === "singles" ? "bg-red-50 border-red-200 text-red-800" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                >
                  🏸 Đấu Đơn (1 vs 1)
                </button>
                <button
                  type="button"
                  onClick={() => setMatchType("doubles")}
                  className={`flex-1 py-2 px-4 rounded-xl border text-sm font-bold transition cursor-pointer ${matchType === "doubles" ? "bg-red-50 border-red-200 text-red-800" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                >
                  👥 Đấu Đôi (2 vs 2)
                </button>
              </div>
            </div>

            {activeTab === "quick" && (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Thời điểm thi đấu</label>
                <input
                  type="datetime-local"
                  value={quickPlayedAt}
                  onChange={(e) => setQuickPlayedAt(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-red-800"
                />
              </div>
            )}
          </div>

          <div className="grid gap-6 mt-6 sm:grid-cols-2">
            {/* ĐỘI A */}
            <div className="space-y-4 p-4 rounded-2xl bg-emerald-50/40 border border-emerald-100/60">
              <h3 className="font-bold text-emerald-800 text-sm flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                <span>Đội A (Bên trái)</span>
              </h3>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-400 font-medium mb-1">Người chơi 1 *</label>
                  <button
                    type="button"
                    onClick={() => { setActiveSearchField("taP1"); setSearchQuery(taP1.name); }}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-left bg-white text-slate-700 hover:border-slate-300 flex justify-between items-center cursor-pointer"
                  >
                    <span>{taP1.name || "Tìm hoặc điền tên..."}</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase bg-slate-50 border border-slate-100 px-2 py-0.5 rounded">Chọn</span>
                  </button>
                </div>

                {matchType === "doubles" && (
                  <div>
                    <label className="block text-xs text-slate-400 font-medium mb-1">Người chơi 2 *</label>
                    <button
                      type="button"
                      onClick={() => { setActiveSearchField("taP2"); setSearchQuery(taP2.name); }}
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-left bg-white text-slate-700 hover:border-slate-300 flex justify-between items-center cursor-pointer"
                    >
                      <span>{taP2.name || "Tìm hoặc điền tên..."}</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase bg-slate-50 border border-slate-100 px-2 py-0.5 rounded">Chọn</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ĐỘI B */}
            <div className="space-y-4 p-4 rounded-2xl bg-indigo-50/40 border border-indigo-100/60">
              <h3 className="font-bold text-indigo-800 text-sm flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
                <span>Đội B (Bên phải)</span>
              </h3>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-400 font-medium mb-1">Người chơi 1 *</label>
                  <button
                    type="button"
                    onClick={() => { setActiveSearchField("tbP1"); setSearchQuery(tbP1.name); }}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-left bg-white text-slate-700 hover:border-slate-300 flex justify-between items-center cursor-pointer"
                  >
                    <span>{tbP1.name || "Tìm hoặc điền tên..."}</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase bg-slate-50 border border-slate-100 px-2 py-0.5 rounded">Chọn</span>
                  </button>
                </div>

                {matchType === "doubles" && (
                  <div>
                    <label className="block text-xs text-slate-400 font-medium mb-1">Người chơi 2 *</label>
                    <button
                      type="button"
                      onClick={() => { setActiveSearchField("tbP2"); setSearchQuery(tbP2.name); }}
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-left bg-white text-slate-700 hover:border-slate-300 flex justify-between items-center cursor-pointer"
                    >
                      <span>{tbP2.name || "Tìm hoặc điền tên..."}</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase bg-slate-50 border border-slate-100 px-2 py-0.5 rounded">Chọn</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {activeTab === "live" ? (
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                disabled={!taP1.name || !tbP1.name || (matchType === "doubles" && (!taP2.name || !tbP2.name))}
                onClick={() => { setIsLiveActive(true); resetLiveMatch(); speakText("Trận đấu bắt đầu."); }}
                className="bg-red-800 hover:bg-red-950 text-white font-bold px-6 py-3 rounded-xl shadow-xs hover:scale-102 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                🎮 Bắt đầu làm Trọng tài
              </button>
            </div>
          ) : (
            <form onSubmit={handleSaveQuickMatch} className="mt-6 border-t border-slate-100 pt-6">
              <h3 className="font-bold text-slate-900 text-sm mb-4">Nhập điểm số các hiệp</h3>
              <div className="space-y-4">
                {/* Set 1 */}
                <div className="flex gap-4 items-center max-w-sm">
                  <span className="text-xs font-bold text-slate-500 w-16 uppercase">Hiệp 1:</span>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    value={quickSet1A}
                    onChange={(e) => setQuickSet1A(e.target.value)}
                    className="w-20 text-center border border-slate-200 rounded-lg px-2 py-1 text-sm bg-emerald-50/20 font-bold text-emerald-800"
                  />
                  <span className="text-slate-400">-</span>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    value={quickSet1B}
                    onChange={(e) => setQuickSet1B(e.target.value)}
                    className="w-20 text-center border border-slate-200 rounded-lg px-2 py-1 text-sm bg-indigo-50/20 font-bold text-indigo-800"
                  />
                </div>

                {/* Set 2 */}
                <div className="flex gap-4 items-center max-w-sm">
                  <span className="text-xs font-bold text-slate-500 w-16 uppercase">Hiệp 2:</span>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    value={quickSet2A}
                    onChange={(e) => setQuickSet2A(e.target.value)}
                    className="w-20 text-center border border-slate-200 rounded-lg px-2 py-1 text-sm bg-emerald-50/20 font-bold text-emerald-800"
                  />
                  <span className="text-slate-400">-</span>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    value={quickSet2B}
                    onChange={(e) => setQuickSet2B(e.target.value)}
                    className="w-20 text-center border border-slate-200 rounded-lg px-2 py-1 text-sm bg-indigo-50/20 font-bold text-indigo-800"
                  />
                </div>

                {/* Toggle Set 3 */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="useSet3"
                    checked={quickUseSet3}
                    onChange={(e) => setQuickUseSet3(e.target.checked)}
                    className="rounded border-slate-300 text-red-800 focus:ring-red-800 cursor-pointer"
                  />
                  <label htmlFor="useSet3" className="text-xs font-bold text-slate-600 cursor-pointer select-none">
                    Có chơi Hiệp 3 (Quyết định)
                  </label>
                </div>

                {/* Set 3 */}
                {quickUseSet3 && (
                  <div className="flex gap-4 items-center max-w-sm animate-in slide-in-from-top-2 duration-150">
                    <span className="text-xs font-bold text-slate-500 w-16 uppercase">Hiệp 3:</span>
                    <input
                      type="number"
                      min="0"
                      max="30"
                      value={quickSet3A}
                      onChange={(e) => setQuickSet3A(e.target.value)}
                      className="w-20 text-center border border-slate-200 rounded-lg px-2 py-1 text-sm bg-emerald-50/20 font-bold text-emerald-800"
                    />
                    <span className="text-slate-400">-</span>
                    <input
                      type="number"
                      min="0"
                      max="30"
                      value={quickSet3B}
                      onChange={(e) => setQuickSet3B(e.target.value)}
                      className="w-20 text-center border border-slate-200 rounded-lg px-2 py-1 text-sm bg-indigo-50/20 font-bold text-indigo-800"
                    />
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="submit"
                  disabled={!taP1.name || !tbP1.name || (matchType === "doubles" && (!taP2.name || !tbP2.name))}
                  className="bg-red-800 hover:bg-red-950 text-white font-bold px-6 py-3 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  💾 Lưu kết quả thi đấu
                </button>
              </div>
            </form>
          )}
        </Card>
      )}

      {/* Live Scoreboard Active Layout */}
      {isLiveActive && activeTab === "live" && (
        <div className="space-y-6">
          {/* Header Action controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-900 text-white rounded-2xl shadow-md">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-red-800 text-xs font-black rounded-[6px] tracking-wide uppercase">Live</span>
              <h2 className="font-bold text-sm">
                {matchType === "singles"
                  ? `${taP1.name} vs ${tbP1.name}`
                  : `${taP1.name} & ${taP2.name} vs ${tbP1.name} & ${tbP2.name}`}
              </h2>
            </div>

            <div className="flex items-center gap-3">
              {/* Voice toggle */}
              <button
                onClick={() => setVoiceEnabled(!voiceEnabled)}
                className={`p-2 rounded-xl border transition cursor-pointer ${voiceEnabled ? "border-red-500 bg-red-500/20 text-red-400" : "border-slate-700 bg-slate-800 text-slate-400"}`}
                title={voiceEnabled ? "Tắt âm thanh đọc điểm" : "Bật trợ lý đọc điểm"}
              >
                {voiceEnabled ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" x2="17" y1="9" y2="15" /><line x1="17" x2="23" y1="9" y2="15" />
                  </svg>
                )}
              </button>

              <button
                onClick={() => setSwapped(!swapped)}
                className="bg-slate-800 border border-slate-700 hover:bg-slate-700 px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                🔄 Đảo Bên Sân
              </button>

              <button
                onClick={undoPoint}
                disabled={scoreHistory.length === 0}
                className="bg-slate-800 border border-slate-700 hover:bg-slate-700 px-3.5 py-1.5 rounded-xl text-xs font-bold transition disabled:opacity-30 cursor-pointer"
              >
                ↩ Hoàn tác
              </button>

              <button
                onClick={redoPoint}
                disabled={redoHistory.length === 0}
                className="bg-slate-800 border border-slate-700 hover:bg-slate-700 px-3.5 py-1.5 rounded-xl text-xs font-bold transition disabled:opacity-30 cursor-pointer"
              >
                ↪ Làm lại
              </button>

              <button
                onClick={() => { if (confirm("Bạn muốn hủy trận đấu trực tiếp này?")) { setIsLiveActive(false); resetLiveMatch(); } }}
                className="bg-rose-950 border border-rose-900 text-rose-300 hover:bg-rose-900 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Hủy trận
              </button>
            </div>
          </div>

          {/* Set scores display */}
          {setScores.length > 0 && (
            <div className="flex gap-2 justify-center py-2 bg-slate-50 border border-slate-100 rounded-xl">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider self-center mr-2">Kết quả các hiệp:</span>
              {setScores.map((set, idx) => (
                <span key={idx} className="bg-white border border-slate-200 px-3 py-1 rounded-lg text-xs font-black text-slate-800 shadow-2xs">
                  Hiệp {idx + 1}: <span className="text-emerald-700">{set.team_a}</span> - <span className="text-indigo-700">{set.team_b}</span>
                </span>
              ))}
            </div>
          )}

          {/* Sân đấu chính - Chia 2 bên */}
          <div className="grid gap-4 md:grid-cols-2 relative rounded-3xl overflow-hidden shadow-2xl border-4 border-slate-900 min-h-[420px]">
            {/* Netline dividing the court */}
            <div className="hidden md:block absolute top-0 bottom-0 left-1/2 w-1 bg-yellow-400/90 z-20 shadow-lg pointer-events-none" />

            {/* Left Court Side */}
            <div
              onClick={() => addPoint(swapped ? "B" : "A")}
              className={`flex flex-col justify-between p-6 transition duration-200 cursor-pointer select-none relative ${
                swapped 
                  ? "bg-gradient-to-br from-indigo-900 to-indigo-950 hover:from-indigo-800 hover:to-indigo-900 text-indigo-100" 
                  : "bg-gradient-to-br from-emerald-900 to-emerald-950 hover:from-emerald-800 hover:to-emerald-900 text-emerald-100"
              }`}
            >
              {/* Corner Tag */}
              <div className="flex justify-between items-start">
                <span className="px-2.5 py-1 bg-white/10 rounded-lg text-xs font-bold uppercase tracking-wider">
                  {swapped ? "Đội B (Phải)" : "Đội A (Trái)"}
                </span>
                
                {/* Sets won display */}
                <div className="flex gap-1.5">
                  {[1, 2].map((i) => (
                    <span 
                      key={i} 
                      className={`w-3.5 h-3.5 rounded-full border ${
                        (swapped ? setsWonB : setsWonA) >= i 
                          ? "bg-yellow-400 border-yellow-300 shadow-xs" 
                          : "bg-white/10 border-white/20"
                      }`} 
                    />
                  ))}
                </div>
              </div>

              {/* Huge Counter */}
              <div className="text-center my-6 flex flex-col justify-center items-center">
                <span className="text-[120px] font-black tracking-tight leading-none drop-shadow-md">
                  {swapped ? currentB : currentA}
                </span>
                <span className="text-xs uppercase font-bold tracking-widest text-white/40 mt-2">Nhấn bất kỳ để thêm điểm</span>
              </div>

              {/* Player Names Bottom */}
              <div className="flex flex-col gap-1 border-t border-white/10 pt-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0" />
                    <p className="font-extrabold text-sm truncate">{swapped ? tbP1.name : taP1.name}</p>
                  </div>
                  <button
                    onClick={() => setActiveSearchField(swapped ? "tbP1" : "taP1")}
                    className="text-[10px] bg-white/10 hover:bg-white/20 text-white px-2 py-0.5 rounded transition cursor-pointer shrink-0 ml-2"
                  >
                    Đổi
                  </button>
                </div>
                {matchType === "doubles" && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-white/30 shrink-0" />
                      <p className="font-semibold text-xs truncate text-white/70">{swapped ? tbP2.name : taP2.name}</p>
                    </div>
                    <button
                      onClick={() => setActiveSearchField(swapped ? "tbP2" : "taP2")}
                      className="text-[10px] bg-white/10 hover:bg-white/20 text-white px-2 py-0.5 rounded transition cursor-pointer shrink-0 ml-2"
                    >
                      Đổi
                    </button>
                  </div>
                )}
              </div>

              {/* Adjust Panel Overlay */}
              <div className="absolute top-4 right-4 flex gap-1 z-30" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => adjustScore(swapped ? "B" : "A", 1)}
                  className="bg-white/10 hover:bg-white/20 text-white w-7 h-7 rounded-lg text-xs font-bold transition flex items-center justify-center cursor-pointer"
                  title="Cộng 1 điểm"
                >
                  +
                </button>
                <button
                  onClick={() => adjustScore(swapped ? "B" : "A", -1)}
                  className="bg-white/10 hover:bg-white/20 text-white w-7 h-7 rounded-lg text-xs font-bold transition flex items-center justify-center cursor-pointer"
                  title="Trừ 1 điểm"
                >
                  -
                </button>
              </div>
            </div>

            {/* Right Court Side */}
            <div
              onClick={() => addPoint(swapped ? "A" : "B")}
              className={`flex flex-col justify-between p-6 transition duration-200 cursor-pointer select-none relative ${
                swapped 
                  ? "bg-gradient-to-br from-emerald-900 to-emerald-950 hover:from-emerald-800 hover:to-emerald-900 text-emerald-100" 
                  : "bg-gradient-to-br from-indigo-900 to-indigo-950 hover:from-indigo-800 hover:to-indigo-900 text-indigo-100"
              }`}
            >
              {/* Corner Tag */}
              <div className="flex justify-between items-start">
                <span className="px-2.5 py-1 bg-white/10 rounded-lg text-xs font-bold uppercase tracking-wider">
                  {swapped ? "Đội A (Trái)" : "Đội B (Phải)"}
                </span>
                
                {/* Sets won display */}
                <div className="flex gap-1.5">
                  {[1, 2].map((i) => (
                    <span 
                      key={i} 
                      className={`w-3.5 h-3.5 rounded-full border ${
                        (swapped ? setsWonA : setsWonB) >= i 
                          ? "bg-yellow-400 border-yellow-300 shadow-xs" 
                          : "bg-white/10 border-white/20"
                      }`} 
                    />
                  ))}
                </div>
              </div>

              {/* Huge Counter */}
              <div className="text-center my-6 flex flex-col justify-center items-center">
                <span className="text-[120px] font-black tracking-tight leading-none drop-shadow-md">
                  {swapped ? currentA : currentB}
                </span>
                <span className="text-xs uppercase font-bold tracking-widest text-white/40 mt-2">Nhấn bất kỳ để thêm điểm</span>
              </div>

              {/* Player Names Bottom */}
              <div className="flex flex-col gap-1 border-t border-white/10 pt-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0" />
                    <p className="font-extrabold text-sm truncate">{swapped ? taP1.name : tbP1.name}</p>
                  </div>
                  <button
                    onClick={() => setActiveSearchField(swapped ? "taP1" : "tbP1")}
                    className="text-[10px] bg-white/10 hover:bg-white/20 text-white px-2 py-0.5 rounded transition cursor-pointer shrink-0 ml-2"
                  >
                    Đổi
                  </button>
                </div>
                {matchType === "doubles" && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-white/30 shrink-0" />
                      <p className="font-semibold text-xs truncate text-white/70">{swapped ? taP2.name : tbP2.name}</p>
                    </div>
                    <button
                      onClick={() => setActiveSearchField(swapped ? "taP2" : "tbP2")}
                      className="text-[10px] bg-white/10 hover:bg-white/20 text-white px-2 py-0.5 rounded transition cursor-pointer shrink-0 ml-2"
                    >
                      Đổi
                    </button>
                  </div>
                )}
              </div>

              {/* Adjust Panel Overlay */}
              <div className="absolute top-4 right-4 flex gap-1 z-30" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => adjustScore(swapped ? "A" : "B", 1)}
                  className="bg-white/10 hover:bg-white/20 text-white w-7 h-7 rounded-lg text-xs font-bold transition flex items-center justify-center cursor-pointer"
                  title="Cộng 1 điểm"
                >
                  +
                </button>
                <button
                  onClick={() => adjustScore(swapped ? "A" : "B", -1)}
                  className="bg-white/10 hover:bg-white/20 text-white w-7 h-7 rounded-lg text-xs font-bold transition flex items-center justify-center cursor-pointer"
                  title="Trừ 1 điểm"
                >
                  -
                </button>
              </div>
            </div>
          </div>

          {/* Action buttons save/reset */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              onClick={() => { if (confirm("Bạn có chắc chắn muốn làm mới điểm số hiệp này?")) resetLiveMatch(); }}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            >
              🔄 Trận mới
            </button>
            <button
              onClick={handleSaveLiveMatch}
              disabled={setsWonA < 2 && setsWonB < 2}
              className="bg-red-800 hover:bg-red-950 text-white font-bold px-6 py-2.5 rounded-xl shadow-xs hover:scale-102 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              💾 Xác nhận & Lưu trận đấu
            </button>
          </div>
        </div>
      )}

      {/* Matches List History tab */}
      {activeTab === "history" && (
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-900">Lịch sử các trận đấu đã ghi nhận</h2>
          {isLoadingMatches ? (
            <p className="text-sm text-slate-400 text-center py-10">Đang tải lịch sử trận đấu...</p>
          ) : matches.length === 0 ? (
            <EmptyState
              title="Chưa có trận đấu nào được lưu"
              description="Hãy bắt đầu đếm điểm trực tiếp hoặc ghi kết quả nhanh ở các tab phía trên."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {matches.map((m) => {
                const isSingles = m.match_type === "singles";
                const isWonA = m.winner_team === "A";
                const formattedDate = new Date(m.played_at).toLocaleString("vi-VN", {
                  year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit"
                });

                return (
                  <Card key={m.id} className="p-5 border border-slate-200/60 shadow-xs rounded-2xl bg-white space-y-4 hover:border-slate-300 transition">
                    <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                      <div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${isSingles ? "bg-amber-50 text-amber-800 border border-amber-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
                          {isSingles ? "Đấu Đơn" : "Đấu Đôi"}
                        </span>
                        <p className="text-[10px] text-slate-400 mt-1.5 font-medium">Thời gian: {formattedDate}</p>
                      </div>
                      <span className="text-[10px] text-slate-400 italic">
                        Ghi bởi: <span className="font-bold text-slate-600">{m.recorder}</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 items-center">
                      {/* Đội A */}
                      <div className={`space-y-1.5 ${isWonA ? "font-bold text-slate-900" : "text-slate-500"}`}>
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${isWonA ? "bg-yellow-400" : "bg-slate-300"}`} />
                          <span className="truncate block max-w-[130px]">{m.team_a.player1.name}</span>
                        </div>
                        {!isSingles && m.team_a.player2 && (
                          <div className="flex items-center gap-1.5 pl-3.5 text-xs">
                            <span className="truncate block max-w-[130px]">{m.team_a.player2.name}</span>
                          </div>
                        )}
                        <p className="text-xl font-black mt-2 text-emerald-700 pl-3.5">{m.team_a.score} <span className="text-xs font-normal text-slate-400">hiệp thắng</span></p>
                      </div>

                      {/* Đội B */}
                      <div className={`space-y-1.5 ${!isWonA ? "font-bold text-slate-900" : "text-slate-500"}`}>
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${!isWonA ? "bg-yellow-400" : "bg-slate-300"}`} />
                          <span className="truncate block max-w-[130px]">{m.team_b.player1.name}</span>
                        </div>
                        {!isSingles && m.team_b.player2 && (
                          <div className="flex items-center gap-1.5 pl-3.5 text-xs">
                            <span className="truncate block max-w-[130px]">{m.team_b.player2.name}</span>
                          </div>
                        )}
                        <p className="text-xl font-black mt-2 text-indigo-700 pl-3.5">{m.team_b.score} <span className="text-xs font-normal text-slate-400">hiệp thắng</span></p>
                      </div>
                    </div>

                    {/* Sets summary list */}
                    <div className="border-t border-slate-50 pt-3 flex gap-2 flex-wrap">
                      <span className="text-[10px] text-slate-400 font-bold uppercase self-center mr-1">Hiệp đấu:</span>
                      {m.sets.map((s: any, idx: number) => (
                        <span key={idx} className="bg-slate-50 border border-slate-200/50 rounded-lg px-2.5 py-0.5 text-xs text-slate-600 font-semibold shadow-3xs">
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
      )}
    </main>
  );
}
