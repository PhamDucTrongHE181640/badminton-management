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
  score_history?: [number, number][];
  duration_seconds?: number;
  longest_run_a?: number;
  longest_run_b?: number;
  undo_count?: number;
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
  const [activeTab, setActiveTab] = useState<"live" | "matchmaker" | "quick" | "history" | "players">("live");
  
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

  // Set detailed analytics tracking states
  const [setStartTime, setSetStartTime] = useState<number>(0);
  const [undoCount, setUndoCount] = useState<number>(0);
  const [scoreHistoryList, setScoreHistoryList] = useState<[number, number][]>([]);

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
  const [offlineMatches, setOfflineMatches] = useState<any[]>([]);

  // Matchmaker State
  const [sessionPlayers, setSessionPlayers] = useState<{ key: string; name: string }[]>([]);
  const [matchmakerPlayersStatus, setMatchmakerPlayersStatus] = useState<any[]>([]);
  const [suggestedMatchup, setSuggestedMatchup] = useState<any | null>(null);
  const [matchmakerMatchType, setMatchmakerMatchType] = useState<"singles" | "doubles">("doubles");
  const [matchmakerError, setMatchmakerError] = useState("");
  const [isGeneratingMatchup, setIsGeneratingMatchup] = useState(false);

  // Player Management State
  const [allPlayers, setAllPlayers] = useState<any[]>([]);
  const [isLoadingAllPlayers, setIsLoadingAllPlayers] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<any | null>(null);
  const [editPlayerName, setEditPlayerName] = useState("");
  const [editPlayerEmail, setEditPlayerEmail] = useState("");
  const [editPlayerPhone, setEditPlayerPhone] = useState("");
  const [editPlayerError, setEditPlayerError] = useState("");
  const [isSavingPlayerEdit, setIsSavingPlayerEdit] = useState(false);
  const [isSavingMatch, setIsSavingMatch] = useState(false);
  const [quickSetCount, setQuickSetCount] = useState<number>(2);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDualView, setIsDualView] = useState(false);
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);

  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState<"success" | "danger" | "warning" | "">("");

  // Set Point / Match Point Alert Evaluation
  const getTargetScore = (scoreA: number, scoreB: number) => {
    if (scoreA < 20 || scoreB < 20) return 21;
    const maxScore = Math.max(scoreA, scoreB);
    if (maxScore >= 29) return 30;
    const diff = Math.abs(scoreA - scoreB);
    if (diff >= 2) return maxScore;
    return maxScore + 1;
  };

  const currentTargetScore = getTargetScore(currentA, currentB);

  const isSetPointLiveA = currentA >= 20 && currentA > currentB && currentA === currentTargetScore - 1;
  const isSetPointLiveB = currentB >= 20 && currentB > currentA && currentB === currentTargetScore - 1;

  const isMatchPointLiveA = isSetPointLiveA && (setsWonA === 1 || setScores.length === 2);
  const isMatchPointLiveB = isSetPointLiveB && (setsWonB === 1 || setScores.length === 2);

  const lastScore = scoreHistory[scoreHistory.length - 1];
  const justWonPointA = lastScore ? currentA > lastScore.a : false;
  const justWonPointB = lastScore ? currentB > lastScore.b : false;

  const loadAllPlayers = async () => {
    setIsLoadingAllPlayers(true);
    try {
      const res = await apiFetch<any[]>("/api/v1/player/scorekeeper/all-players");
      setAllPlayers(res);
    } catch (err) {
      console.error("Lỗi lấy danh sách người chơi", err);
    } finally {
      setIsLoadingAllPlayers(false);
    }
  };

  const handleSavePlayerEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlayer) return;
    setEditPlayerError("");
    const name = editPlayerName.trim();
    const email = editPlayerEmail.trim().toLowerCase();

    if (!name) {
      setEditPlayerError("Tên người dùng không được để trống");
      return;
    }
    if (!email || !email.includes("@")) {
      setEditPlayerError("Email không hợp lệ");
      return;
    }

    setIsSavingPlayerEdit(true);
    try {
      await apiFetch(`/api/v1/player/scorekeeper/players/${editingPlayer.id}`, {
        method: "PUT",
        body: JSON.stringify({
          full_name: name,
          email: email,
          phone: editPlayerPhone.trim() || null
        })
      });
      
      showStatus("Cập nhật thông tin người chơi thành công!", "success");
      setEditingPlayer(null);
      void loadAllPlayers();
    } catch (err: any) {
      setEditPlayerError(err?.message || "Không thể cập nhật thông tin.");
    } finally {
      setIsSavingPlayerEdit(false);
    }
  };

  useEffect(() => {
    if (activeTab === "history") {
      loadHistory();
      loadOfflineMatches();
    } else if (activeTab === "players") {
      void loadAllPlayers();
    }
  }, [activeTab]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Lắng nghe phím mũi tên để tăng điểm số bên trái và bên phải
  useEffect(() => {
    if (!isLiveActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable ||
        activeSearchField
      ) {
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        addPoint(swapped ? "B" : "A");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        addPoint(swapped ? "A" : "B");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isLiveActive, swapped, activeSearchField, currentA, currentB, scoreHistory, setsWonA, setsWonB, setScores, intervalAnnounced]);

  // Helper để tính toán chuỗi điểm liên tiếp dài nhất từ lịch sử điểm số
  const calculateLongestRuns = (historyList: [number, number][]) => {
    let longestRunA = 0;
    let longestRunB = 0;
    let currentRunA = 0;
    let currentRunB = 0;

    for (let i = 0; i < historyList.length; i++) {
      const prev = i === 0 ? [0, 0] : historyList[i - 1];
      const curr = historyList[i];

      if (curr[0] > prev[0]) {
        // Đội A ghi điểm
        currentRunA++;
        currentRunB = 0;
        if (currentRunA > longestRunA) {
          longestRunA = currentRunA;
        }
      } else if (curr[1] > prev[1]) {
        // Đội B ghi điểm
        currentRunB++;
        currentRunA = 0;
        if (currentRunB > longestRunB) {
          longestRunB = currentRunB;
        }
      }
    }
    return { longestRunA, longestRunB };
  };

  // Phục hồi trạng thái trận đấu từ localStorage khi tải trang
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("netup_live_match_state");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setMatchType(parsed.matchType || "doubles");
          setTaP1(parsed.taP1 || { id: "", name: "" });
          setTaP2(parsed.taP2 || { id: "", name: "" });
          setTbP1(parsed.tbP1 || { id: "", name: "" });
          setTbP2(parsed.tbP2 || { id: "", name: "" });
          setCurrentA(parsed.currentA || 0);
          setCurrentB(parsed.currentB || 0);
          setSetsWonA(parsed.setsWonA || 0);
          setSetsWonB(parsed.setsWonB || 0);
          setSetScores(parsed.setScores || []);
          setScoreHistory(parsed.scoreHistory || []);
          setRedoHistory(parsed.redoHistory || []);
          setSwapped(parsed.swapped || false);
          setIntervalAnnounced(parsed.intervalAnnounced || false);
          
          setSetStartTime(parsed.setStartTime || 0);
          setUndoCount(parsed.undoCount || 0);
          setScoreHistoryList(parsed.scoreHistoryList || []);

          setIsLiveActive(true);
          setActiveTab("live");
        } catch (e) {
          console.error("Lỗi phục hồi điểm số từ localStorage:", e);
        }
      }
    }
  }, []);

  // Lưu trạng thái trận đấu vào localStorage khi có bất kỳ thay đổi nào
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (isLiveActive) {
        const matchState = {
          matchType,
          taP1,
          taP2,
          tbP1,
          tbP2,
          currentA,
          currentB,
          setsWonA,
          setsWonB,
          setScores,
          scoreHistory,
          redoHistory,
          swapped,
          intervalAnnounced,
          setStartTime,
          undoCount,
          scoreHistoryList
        };
        localStorage.setItem("netup_live_match_state", JSON.stringify(matchState));
      }
    }
  }, [
    isLiveActive,
    matchType,
    taP1,
    taP2,
    tbP1,
    tbP2,
    currentA,
    currentB,
    setsWonA,
    setsWonB,
    setScores,
    scoreHistory,
    redoHistory,
    swapped,
    intervalAnnounced,
    setStartTime,
    undoCount,
    scoreHistoryList
  ]);

  // Hook tự động quản lý thời điểm bắt đầu trận đấu và bắt đầu hiệp đấu mới
  useEffect(() => {
    if (isLiveActive) {
      if (setStartTime === 0) {
        setSetStartTime(Date.now());
      }
    } else {
      setSetStartTime(0);
      setUndoCount(0);
      setScoreHistoryList([]);
    }
  }, [isLiveActive]);

  useEffect(() => {
    if (isLiveActive && setScores.length > 0) {
      setSetStartTime(Date.now());
      setUndoCount(0);
      setScoreHistoryList([]);
    }
  }, [setScores.length]);

  // Cơ chế tự động đăng xuất khi treo máy (Idle Timeout) 10 phút
  useEffect(() => {
    if (typeof window === "undefined") return;

    let timeoutId: NodeJS.Timeout;

    const resetIdleTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      
      // Chỉ tự động đăng xuất nếu không có trận đấu trực tiếp nào đang diễn ra
      timeoutId = setTimeout(async () => {
        if (!isLiveActive) {
          console.log("Không có hoạt động trong 10 phút. Tự động đăng xuất.");
          try {
            await apiFetch("/api/v1/auth/logout", {
              method: "POST",
              body: JSON.stringify({ refresh_token: null }),
            });
          } catch (err) {
            console.error("Lỗi tự động đăng xuất:", err);
          } finally {
            window.location.href = "/";
          }
        }
      }, 10 * 60 * 1000);
    };

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((event) => {
      window.addEventListener(event, resetIdleTimer);
    });

    resetIdleTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach((event) => {
        window.removeEventListener(event, resetIdleTimer);
      });
    };
  }, [isLiveActive]);

  const fetchAutocomplete = async (queryStr: string) => {
    setIsSearching(true);
    try {
      const res = await apiFetch<AutocompleteUser[]>(`/api/v1/player/scorekeeper/players?q=${encodeURIComponent(queryStr)}`);
      setSearchResults(res);
    } catch (err) {
      console.error("Lỗi tìm kiếm người chơi:", err);
    } finally {
      setIsSearching(false);
    }
  };

  // Tự động tải danh sách người chơi mặc định ngay khi mở Modal chọn người chơi
  useEffect(() => {
    if (activeSearchField) {
      setSearchQuery("");
      void fetchAutocomplete("");
    }
  }, [activeSearchField]);

  // Tìm kiếm có debounce khi người dùng nhập từ khóa
  useEffect(() => {
    if (!activeSearchField) return;
    const timer = setTimeout(() => {
      void fetchAutocomplete(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, activeSearchField]);

  const loadOfflineMatches = () => {
    if (typeof window === "undefined") return;
    const savedQueue = localStorage.getItem("netup_offline_matches_queue");
    if (savedQueue) {
      try {
        setOfflineMatches(JSON.parse(savedQueue));
      } catch (e) {
        console.error("Lỗi đọc hàng đợi ngoại tuyến:", e);
        setOfflineMatches([]);
      }
    } else {
      setOfflineMatches([]);
    }
  };

  const saveMatchOffline = (payload: any) => {
    try {
      const savedQueue = localStorage.getItem("netup_offline_matches_queue");
      const queue = savedQueue ? JSON.parse(savedQueue) : [];
      
      const offlineMatchData = {
        id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        match_type: payload.match_type,
        team_a: {
          player1: { id: payload.team_a_player1_id, name: payload.team_a_player1_name },
          player2: payload.team_a_player2_name ? { id: payload.team_a_player2_id, name: payload.team_a_player2_name } : null,
          score: payload.team_a_score
        },
        team_b: {
          player1: { id: payload.team_b_player1_id, name: payload.team_b_player1_name },
          player2: payload.team_b_player2_name ? { id: payload.team_b_player2_id, name: payload.team_b_player2_name } : null,
          score: payload.team_b_score
        },
        sets: payload.sets,
        winner_team: payload.team_a_score > payload.team_b_score ? "A" : "B",
        played_at: payload.played_at || new Date().toISOString(),
        recorder: "Bạn (Ngoại tuyến)",
        isOfflinePending: true,
        payload: payload
      };

      queue.push(offlineMatchData);
      localStorage.setItem("netup_offline_matches_queue", JSON.stringify(queue));
      
      resetLiveMatch();
      setIsLiveActive(false);
      localStorage.removeItem("netup_live_match_state");
      
      showStatus("Mất mạng. Đã lưu tạm trận đấu vào thiết bị!", "warning");
      alert("Thiết bị hiện tại đang ngoại tuyến.\n\nTrận đấu đã được lưu tạm vào bộ nhớ trình duyệt của bạn. Hệ thống sẽ tự động đồng bộ lên máy chủ ngay khi phát hiện có mạng kết nối trở lại!");
      
      loadOfflineMatches();
      setActiveTab("history");
    } catch (e) {
      console.error("Lỗi lưu ngoại tuyến:", e);
      showStatus("Không thể lưu trận đấu ngoại tuyến!", "danger");
    }
  };

  const syncOfflineMatches = async () => {
    if (typeof window === "undefined" || !navigator.onLine) return;
    const savedQueue = localStorage.getItem("netup_offline_matches_queue");
    if (!savedQueue) return;

    try {
      const queue = JSON.parse(savedQueue);
      if (queue.length === 0) return;

      console.log(`Đang đồng bộ ${queue.length} trận đấu ngoại tuyến...`);
      const remainingQueue = [];
      let successCount = 0;

      for (const match of queue) {
        try {
          const payloadToSend = match.payload || {
            match_type: match.match_type,
            team_a_player1_id: match.team_a.player1.id || null,
            team_a_player1_name: match.team_a.player1.name,
            team_a_player2_id: match.team_a.player2?.id || null,
            team_a_player2_name: match.team_a.player2?.name || null,
            team_b_player1_id: match.team_b.player1.id || null,
            team_b_player1_name: match.team_b.player1.name,
            team_b_player2_id: match.team_b.player2?.id || null,
            team_b_player2_name: match.team_b.player2?.name || null,
            sets: match.sets,
            team_a_score: match.team_a.score,
            team_b_score: match.team_b.score,
            played_at: match.played_at
          };

          await apiFetch("/api/v1/player/scorekeeper/matches", {
            method: "POST",
            body: JSON.stringify(payloadToSend)
          });
          successCount++;
        } catch (err) {
          console.error("Lỗi đồng bộ một trận đấu ngoại tuyến:", err);
          remainingQueue.push(match);
        }
      }

      if (successCount > 0) {
        showStatus(`Đồng bộ thành công ${successCount} trận đấu ngoại tuyến lên hệ thống!`, "success");
        void loadHistory();
      }

      if (remainingQueue.length > 0) {
        localStorage.setItem("netup_offline_matches_queue", JSON.stringify(remainingQueue));
      } else {
        localStorage.removeItem("netup_offline_matches_queue");
      }
      loadOfflineMatches();
    } catch (e) {
      console.error("Lỗi xử lý hàng đợi ngoại tuyến:", e);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      void syncOfflineMatches();
    };

    window.addEventListener("online", handleOnline);
    
    if (navigator.onLine) {
      void syncOfflineMatches();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  const loadHistory = async () => {
    setIsLoadingMatches(true);
    try {
      const res = await apiFetch<any[]>("/api/v1/player/scorekeeper/matches");
      setMatches(res);
    } catch (err) {
      console.error("Lỗi tải lịch sử đấu:", err);
    } finally {
      setIsLoadingMatches(false);
    }
  };

  const loadMatchmakerPlayCounts = async (playersList: { key: string; name: string }[]) => {
    if (playersList.length === 0) {
      setMatchmakerPlayersStatus([]);
      return;
    }
    try {
      const res = await apiFetch<any>("/api/v1/player/matchmaker/suggest", {
        method: "POST",
        body: JSON.stringify({
          active_players: playersList.map((p) => p.key),
          match_type: matchmakerMatchType,
        }),
      });
      if (res?.players_status) {
        setMatchmakerPlayersStatus(res.players_status);
      }
    } catch (err) {
      console.error("Lỗi cập nhật lượt đấu hôm nay", err);
    }
  };

  useEffect(() => {
    if (activeTab === "matchmaker" && sessionPlayers.length > 0) {
      void loadMatchmakerPlayCounts(sessionPlayers);
    }
  }, [activeTab, sessionPlayers.length, matchmakerMatchType]);

  const handleGenerateMatchup = async () => {
    setMatchmakerError("");
    setSuggestedMatchup(null);
    const numRequired = matchmakerMatchType === "doubles" ? 4 : 2;
    if (sessionPlayers.length < numRequired) {
      setMatchmakerError(`Cần tối thiểu ${numRequired} người chơi hoạt động để chia đội.`);
      return;
    }
    setIsGeneratingMatchup(true);
    try {
      const res = await apiFetch<any>("/api/v1/player/matchmaker/suggest", {
        method: "POST",
        body: JSON.stringify({
          active_players: sessionPlayers.map((p) => p.key),
          match_type: matchmakerMatchType,
        }),
      });
      setSuggestedMatchup(res.suggested);
      if (res.players_status) {
        setMatchmakerPlayersStatus(res.players_status);
      }
    } catch (err: any) {
      setMatchmakerError(err?.message || "Không thể đề xuất đội hình.");
    } finally {
      setIsGeneratingMatchup(false);
    }
  };

  const handleStartSuggestedMatch = () => {
    if (!suggestedMatchup) return;
    const teamA = suggestedMatchup.team_a;
    const teamB = suggestedMatchup.team_b;

    if (matchmakerMatchType === "doubles") {
      setTaP1({ id: teamA[0].key.startsWith("id:") ? teamA[0].key.split(":")[1] : "", name: teamA[0].name });
      setTaP2({ id: teamA[1].key.startsWith("id:") ? teamA[1].key.split(":")[1] : "", name: teamA[1].name });
      setTbP1({ id: teamB[0].key.startsWith("id:") ? teamB[0].key.split(":")[1] : "", name: teamB[0].name });
      setTbP2({ id: teamB[1].key.startsWith("id:") ? teamB[1].key.split(":")[1] : "", name: teamB[1].name });
    } else {
      setTaP1({ id: teamA[0].key.startsWith("id:") ? teamA[0].key.split(":")[1] : "", name: teamA[0].name });
      setTaP2({ id: "", name: "" });
      setTbP1({ id: teamB[0].key.startsWith("id:") ? teamB[0].key.split(":")[1] : "", name: teamB[0].name });
      setTbP2({ id: "", name: "" });
    }

    setMatchType(matchmakerMatchType);
    resetLiveMatch();
    setIsLiveActive(true);
    setActiveTab("live");
    speakText("Trận đấu bắt đầu.");
  };

  const handleSelectUser = (user: AutocompleteUser) => {
    if (activeSearchField === "matchmaker") {
      const playerKey = user.id ? `id:${user.id}` : `name:${user.full_name}`;
      if (sessionPlayers.some((p) => p.key === playerKey)) {
        alert("Người chơi này đã có mặt trong danh sách sân!");
        return;
      }
      const nextPlayers = [...sessionPlayers, { key: playerKey, name: user.full_name }];
      setSessionPlayers(nextPlayers);
      void loadMatchmakerPlayCounts(nextPlayers);
      
      setActiveSearchField(null);
      setSearchQuery("");
      setSearchResults([]);
      return;
    }

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
    let email = guestEmail.trim().toLowerCase();
    
    if (!name) {
      setGuestError("Họ tên không được để trống");
      return;
    }

    if (!email) {
      const slug = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const rand = Math.random().toString(36).substring(2, 7);
      email = `guest_${slug}_${rand}@netup.guest`;
    } else if (!email.includes("@")) {
      setGuestError("Email không hợp lệ");
      return;
    }

    const isDuplicate = 
      (activeSearchField === "matchmaker" && sessionPlayers.some((p) => p.name.toLowerCase() === name.toLowerCase())) ||
      (activeSearchField !== "matchmaker" && (
        (activeSearchField !== "taP1" && taP1.name.toLowerCase() === name.toLowerCase()) ||
        (activeSearchField !== "taP2" && taP2.name.toLowerCase() === name.toLowerCase()) ||
        (activeSearchField !== "tbP1" && tbP1.name.toLowerCase() === name.toLowerCase()) ||
        (activeSearchField !== "tbP2" && tbP2.name.toLowerCase() === name.toLowerCase())
      ));
      
    if (isDuplicate) {
      setGuestError("Người chơi này đã được chọn ở vị trí khác hoặc đã có trong danh sách sân!");
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
      if (activeSearchField === "matchmaker") {
        const playerKey = `id:${res.id}`;
        const nextPlayers = [...sessionPlayers, { key: playerKey, name: res.full_name }];
        setSessionPlayers(nextPlayers);
        void loadMatchmakerPlayCounts(nextPlayers);
      }
      
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

    const newHistory = [...scoreHistoryList, [nextA, nextB] as [number, number]];
    setScoreHistoryList(newHistory);

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
      
      const { longestRunA, longestRunB } = calculateLongestRuns(newHistory);
      const newSets = [
        ...setScores, 
        { 
          team_a: nextA, 
          team_b: nextB,
          score_history: newHistory,
          duration_seconds: setStartTime > 0 ? Math.floor((Date.now() - setStartTime) / 1000) : 0,
          longest_run_a: longestRunA,
          longest_run_b: longestRunB,
          undo_count: undoCount
        }
      ];
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

  const toggleFullscreen = () => {
    if (typeof window === "undefined") return;
    if (!document.fullscreenElement) {
      const container = document.getElementById("live-scoreboard-fullscreen-container");
      if (container) {
        container.requestFullscreen().catch((err) => {
          console.error("Lỗi bật toàn màn hình:", err);
        });
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch((err) => {
          console.error("Lỗi thoát toàn màn hình:", err);
        });
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

    setScoreHistoryList(scoreHistoryList.slice(0, -1));
    setUndoCount(prev => prev + 1);

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

    setScoreHistoryList([...scoreHistoryList, [next.a, next.b] as [number, number]]);
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

    // Tự động gộp hiệp đấu dở dang vào danh sách gửi đi và tính điểm hiệp thắng
    const finalSets = [...setScores];
    let finalWonA = setsWonA;
    let finalWonB = setsWonB;
    if (currentA > 0 || currentB > 0) {
      const { longestRunA, longestRunB } = calculateLongestRuns(scoreHistoryList);
      finalSets.push({
        team_a: currentA,
        team_b: currentB,
        score_history: scoreHistoryList,
        duration_seconds: setStartTime > 0 ? Math.floor((Date.now() - setStartTime) / 1000) : 0,
        longest_run_a: longestRunA,
        longest_run_b: longestRunB,
        undo_count: undoCount
      });
      if (currentA > currentB) {
        finalWonA += 1;
      } else if (currentB > currentA) {
        finalWonB += 1;
      }
    }

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
      sets: finalSets,
      team_a_score: finalWonA,
      team_b_score: finalWonB,
      played_at: new Date().toISOString()
    };

    const isOffline = typeof window !== "undefined" && !navigator.onLine;
    if (isOffline) {
      saveMatchOffline(payload);
      return;
    }

    setIsSavingMatch(true);
    try {
      await apiFetch("/api/v1/player/scorekeeper/matches", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      showStatus("Lưu kết quả trận đấu thành công!", "success");
      resetLiveMatch();
      setIsLiveActive(false);
      localStorage.removeItem("netup_live_match_state"); // Xóa trạng thái lưu trữ live
      setActiveTab("history");
    } catch (err: any) {
      console.error("Lỗi khi lưu trận đấu trực tiếp:", err);
      if (err?.status === 401) {
        alert("Phiên làm việc đã hết hạn!\n\nHệ thống sẽ mở một tab mới để bạn đăng nhập lại. Sau khi đăng nhập thành công, hãy quay lại đây và nhấn 'Lưu' để lưu điểm số.");
        window.open("/api/v1/auth/google/start", "_blank");
      } else {
        console.log("Gặp lỗi mạng hoặc kết nối. Đang chuyển đổi sang lưu trữ ngoại tuyến...");
        saveMatchOffline(payload);
      }
    } finally {
      setIsSavingMatch(false);
    }
  };

  const resetLiveMatch = (keepPlayers = false) => {
    setCurrentA(0);
    setCurrentB(0);
    setSetsWonA(0);
    setSetsWonB(0);
    setSetScores([]);
    setScoreHistory([]);
    setRedoHistory([]);
    setIntervalAnnounced(false);
    setSetStartTime(0);
    setUndoCount(0);
    setScoreHistoryList([]);
    if (!keepPlayers) {
      setTaP1({ id: "", name: "" });
      setTaP2({ id: "", name: "" });
      setTbP1({ id: "", name: "" });
      setTbP2({ id: "", name: "" });
    }
    if (typeof window !== "undefined") {
      localStorage.removeItem("netup_live_match_state");
    }
  };

  const handleSaveQuickMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameA1 = taP1.name.trim() || "Người chơi A1";
    const nameB1 = tbP1.name.trim() || "Người chơi B1";
    const nameA2 = matchType === "doubles" ? (taP2.name.trim() || "Người chơi A2") : null;
    const nameB2 = matchType === "doubles" ? (tbP2.name.trim() || "Người chơi B2") : null;

    const setsToSave: SetScore[] = [];
    setsToSave.push({ team_a: parseInt(quickSet1A) || 0, team_b: parseInt(quickSet1B) || 0 });
    
    if (quickSetCount >= 2) {
      setsToSave.push({ team_a: parseInt(quickSet2A) || 0, team_b: parseInt(quickSet2B) || 0 });
    }
    if (quickSetCount === 3) {
      setsToSave.push({ team_a: parseInt(quickSet3A) || 0, team_b: parseInt(quickSet3B) || 0 });
    }

    // Calculate sets won
    let quickWonA = 0;
    let quickWonB = 0;
    setsToSave.forEach((s) => {
      if (s.team_a > s.team_b) quickWonA++;
      else if (s.team_b > s.team_a) quickWonB++;
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

    setIsSavingMatch(true);
    try {
      await apiFetch("/api/v1/player/scorekeeper/matches", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      showStatus("Lưu kết quả trận đấu nhanh thành công!", "success");
      setQuickSet1A("0");
      setQuickSet1B("0");
      setQuickSet2A("0");
      setQuickSet2B("0");
      setQuickSet3A("0");
      setQuickSet3B("0");
      setQuickSetCount(2);
      setActiveTab("history");
    } catch (err: any) {
      console.error("Lỗi khi lưu trận đấu nhanh:", err);
      if (err?.status === 401) {
        alert("Phiên làm việc đã hết hạn!\n\nHệ thống sẽ mở một tab mới để bạn đăng nhập lại. Sau khi đăng nhập thành công, hãy quay lại đây và nhấn 'Lưu' để lưu điểm số.");
        window.open("/api/v1/auth/google/start", "_blank");
      } else {
        alert(errorMessage(err, "Lưu kết quả nhanh thất bại. Vui lòng kiểm tra lại kết nối."));
        showStatus(errorMessage(err, "Lưu kết quả nhanh thất bại"), "danger");
      }
    } finally {
      setIsSavingMatch(false);
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

            // SVG dimensions
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
          onClick={() => { setActiveTab("live"); }}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition shrink-0 cursor-pointer ${activeTab === "live" ? "border-red-800 text-red-800" : "border-transparent text-slate-500 hover:text-slate-900"}`}
        >
          🏸 Trọng tài đếm điểm
        </button>
        <button
          onClick={() => { setActiveTab("matchmaker"); }}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition shrink-0 cursor-pointer ${activeTab === "matchmaker" ? "border-red-800 text-red-800" : "border-transparent text-slate-500 hover:text-slate-900"}`}
        >
          🤝 Chia đội thông minh
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
        <button
          onClick={() => { setActiveTab("players"); }}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition shrink-0 cursor-pointer ${activeTab === "players" ? "border-red-800 text-red-800" : "border-transparent text-slate-500 hover:text-slate-900"}`}
        >
          👥 Quản lý người chơi
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
                    Email (Không bắt buộc)
                  </label>
                  <input
                    type="email"
                    className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-red-800"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder="khach_vang_lai@domain.com (Nếu muốn)"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Nếu để trống, hệ thống sẽ tự tạo email ẩn danh để lưu lịch sử đấu và gợi ý lần sau.
                  </p>
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
                  {searchQuery.trim() && (
                    <button
                      type="button"
                      onClick={() => {
                        const typedName = searchQuery.trim();
                        const isDuplicate = 
                          (activeSearchField === "matchmaker" && sessionPlayers.some((p) => p.name.toLowerCase() === typedName.toLowerCase())) ||
                          (activeSearchField !== "matchmaker" && (
                            (activeSearchField !== "taP1" && taP1.name.toLowerCase() === typedName.toLowerCase()) ||
                            (activeSearchField !== "taP2" && taP2.name.toLowerCase() === typedName.toLowerCase()) ||
                            (activeSearchField !== "tbP1" && tbP1.name.toLowerCase() === typedName.toLowerCase()) ||
                            (activeSearchField !== "tbP2" && tbP2.name.toLowerCase() === typedName.toLowerCase())
                          ));
                          
                        if (isDuplicate) {
                          alert("Người chơi này đã được chọn hoặc đã có trong danh sách sân!");
                          return;
                        }

                        if (activeSearchField === "taP1") setTaP1({ id: "", name: typedName });
                        if (activeSearchField === "taP2") setTaP2({ id: "", name: typedName });
                        if (activeSearchField === "tbP1") setTbP1({ id: "", name: typedName });
                        if (activeSearchField === "tbP2") setTbP2({ id: "", name: typedName });
                        if (activeSearchField === "matchmaker") {
                          const playerKey = `name:${typedName}`;
                          const nextPlayers = [...sessionPlayers, { key: playerKey, name: typedName }];
                          setSessionPlayers(nextPlayers);
                          void loadMatchmakerPlayCounts(nextPlayers);
                        }
                        setActiveSearchField(null);
                        setSearchQuery("");
                      }}
                      className="w-full mb-2 flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      <span>✍️ Dùng tên nhập trực tiếp: "{searchQuery}"</span>
                      <span className="text-red-800">Chọn →</span>
                    </button>
                  )}

                  {isSearching ? (
                    <p className="text-xs text-slate-400 text-center py-4">Đang tải...</p>
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
                    <div className="text-center py-4">
                      <p className="text-xs text-slate-400">Không tìm thấy thành viên phù hợp</p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 text-center py-4">Chưa có người chơi nào trong danh sách. Hãy nhập tên ở trên.</p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Configuration Form (Used for both Quick Record and starting Live Match) */}
      {(!isLiveActive || activeTab === "quick") && activeTab !== "history" && activeTab !== "matchmaker" && (
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
                onClick={() => { setIsLiveActive(true); resetLiveMatch(true); speakText("Trận đấu bắt đầu."); }}
                className="bg-red-800 hover:bg-red-950 text-white font-bold px-6 py-3 rounded-xl shadow-xs hover:scale-102 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                🎮 Bắt đầu làm Trọng tài
              </button>
            </div>
          ) : (
            <form onSubmit={handleSaveQuickMatch} className="mt-6 border-t border-slate-100 pt-6">
              <h3 className="font-bold text-slate-900 text-sm mb-4">Nhập điểm số các hiệp</h3>
              <div className="space-y-4">
                {/* Chọn số hiệp thi đấu */}
                <div className="mb-4">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Số hiệp thi đấu
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setQuickSetCount(num)}
                        className={`px-4 py-2 text-xs font-bold rounded-xl border transition cursor-pointer ${
                          quickSetCount === num
                            ? "bg-red-800 border-red-800 text-white shadow-sm"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {num} Hiệp
                      </button>
                    ))}
                  </div>
                </div>

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
                {quickSetCount >= 2 && (
                  <div className="flex gap-4 items-center max-w-sm animate-in slide-in-from-top-2 duration-150">
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
                )}

                {/* Set 3 */}
                {quickSetCount === 3 && (
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
                  disabled={isSavingMatch || !taP1.name || !tbP1.name || (matchType === "doubles" && (!taP2.name || !tbP2.name))}
                  className="bg-red-800 hover:bg-red-950 text-white font-bold px-6 py-3 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed animate-in"
                >
                  {isSavingMatch ? "Đang lưu..." : "💾 Lưu kết quả thi đấu"}
                </button>
              </div>
            </form>
          )}
        </Card>
      )}

      {/* Smart Matchmaker Interface */}
      {activeTab === "matchmaker" && !isLiveActive && (
        <Card className="p-6 mb-8 max-w-5xl mx-auto border border-slate-100 shadow-sm rounded-2xl bg-white space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>🤝 Chia đội thông minh & Xếp lượt đấu</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">Hệ thống sẽ xếp lượt cho những ai chơi ít trận nhất và chia cặp có trình độ cân bằng nhất.</p>
            </div>
            
            <button
              onClick={() => { setActiveSearchField("matchmaker"); setSearchQuery(""); }}
              className="bg-red-800 hover:bg-red-900 text-white px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              ➕ Thêm người chơi vào sân
            </button>
          </div>

          {matchmakerError && (
            <Notice tone="danger">{matchmakerError}</Notice>
          )}

          <div className="grid gap-6 md:grid-cols-12">
            {/* Left side: Player Pool */}
            <div className="md:col-span-5 space-y-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Thành viên đang chờ trên sân ({sessionPlayers.length})
              </h3>
              
              {sessionPlayers.length === 0 ? (
                <div className="border border-dashed border-slate-200 rounded-2xl p-8 text-center text-slate-400">
                  <p className="text-xs">Chưa có người chơi nào.</p>
                  <p className="text-[10px] mt-1">Bấm nút "Thêm người chơi vào sân" ở trên để tạo danh sách.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {sessionPlayers.map((player) => {
                    const status = matchmakerPlayersStatus.find((s) => s.key === player.key);
                    const todayPlayed = status?.today_played ?? 0;
                    const strength = status?.strength ?? 1000;
                    
                    return (
                      <div
                        key={player.key}
                        className="flex items-center justify-between p-3 border border-slate-100 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-slate-900 truncate">{player.name}</p>
                            <span className={`text-[9px] px-1.5 py-0.2 font-extrabold rounded-sm uppercase tracking-wide shrink-0 ${player.key.startsWith("id:") ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-orange-50 text-orange-700 border border-orange-100"}`}>
                              {player.key.startsWith("id:") ? "Thành viên" : "Khách"}
                            </span>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-400 mt-1">
                            <span>Sức mạnh: <strong className="text-slate-600 font-bold">{strength} ELO</strong></span>
                            <span>Tỷ lệ thắng: <strong className="text-slate-600 font-bold">{status?.win_rate ?? 50}%</strong></span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {/* Play count badge */}
                          <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
                            todayPlayed === 0 
                              ? "bg-emerald-100 text-emerald-800" 
                              : todayPlayed <= 2 
                                ? "bg-amber-100 text-amber-800" 
                                : "bg-rose-100 text-rose-800"
                          }`}>
                            {todayPlayed} trận
                          </span>
                          
                          <button
                            onClick={() => {
                              const nextPlayers = sessionPlayers.filter((p) => p.key !== player.key);
                              setSessionPlayers(nextPlayers);
                              void loadMatchmakerPlayCounts(nextPlayers);
                              if (suggestedMatchup) setSuggestedMatchup(null);
                            }}
                            className="p-1 hover:bg-slate-200 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                            title="Xóa người này khỏi sân"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right side: Suggested matchup / balancing controls */}
            <div className="md:col-span-7 border-t md:border-t-0 md:border-l border-slate-100 pt-6 md:pt-0 md:pl-6 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Chế độ chia cặp</label>
                  <div className="flex gap-2 max-w-xs">
                    <button
                      type="button"
                      onClick={() => { setMatchmakerMatchType("singles"); setSuggestedMatchup(null); }}
                      className={`flex-1 py-1.5 px-3 rounded-lg border text-xs font-bold transition cursor-pointer ${matchmakerMatchType === "singles" ? "bg-red-50 border-red-200 text-red-800" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                    >
                      🏸 Đấu Đơn (1 vs 1)
                    </button>
                    <button
                      type="button"
                      onClick={() => { setMatchmakerMatchType("doubles"); setSuggestedMatchup(null); }}
                      className={`flex-1 py-1.5 px-3 rounded-lg border text-xs font-bold transition cursor-pointer ${matchmakerMatchType === "doubles" ? "bg-red-50 border-red-200 text-red-800" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                    >
                      👥 Đấu Đôi (2 vs 2)
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGenerateMatchup}
                  disabled={isGeneratingMatchup || sessionPlayers.length < (matchmakerMatchType === "doubles" ? 4 : 2)}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition cursor-pointer disabled:opacity-50"
                >
                  {isGeneratingMatchup ? "Đang tính toán đội hình..." : "🎲 Cân bằng & Đề xuất cặp đấu"}
                </button>
              </div>

              {suggestedMatchup ? (
                <div className="border border-red-100 bg-red-50/10 rounded-2xl p-5 space-y-4 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Đội hình cân bằng nhất đề xuất:</span>
                    <span className="text-xs font-black text-emerald-800 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-lg">
                      Độ lệch: {suggestedMatchup.strength_diff} ELO
                    </span>
                  </div>

                  {/* Sân đấu mô phỏng */}
                  <div className="grid grid-cols-2 gap-4 border border-slate-200 rounded-2xl bg-white p-4 relative overflow-hidden shadow-xs">
                    <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-yellow-400 pointer-events-none" />
                    
                    {/* Đội A */}
                    <div className="space-y-3 text-center">
                      <p className="text-[10px] font-bold text-emerald-700 uppercase bg-emerald-50 py-0.5 rounded-md">Đội A</p>
                      <div className="space-y-1.5">
                        {suggestedMatchup.team_a.map((player: any) => (
                          <div key={player.key} className="bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                            <p className="text-xs font-bold text-slate-800 truncate">{player.name}</p>
                            <p className="text-[9px] text-slate-400 mt-0.5">{player.strength} ELO ({player.today_played} trận)</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Đội B */}
                    <div className="space-y-3 text-center">
                      <p className="text-[10px] font-bold text-indigo-700 uppercase bg-indigo-50 py-0.5 rounded-md">Đội B</p>
                      <div className="space-y-1.5">
                        {suggestedMatchup.team_b.map((player: any) => (
                          <div key={player.key} className="bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                            <p className="text-xs font-bold text-slate-800 truncate">{player.name}</p>
                            <p className="text-[9px] text-slate-400 mt-0.5">{player.strength} ELO ({player.today_played} trận)</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-500 leading-relaxed bg-amber-50/40 border border-amber-100/60 p-3 rounded-xl">
                    ℹ️ <strong>Thuật toán ưu tiên lượt đấu:</strong> Đã ưu tiên những thành viên chưa được chơi hoặc chơi ít trận nhất trong hôm nay lên sân trước, sau đó sắp xếp chéo để đảm bảo chênh lệch trình độ giữa 2 đội là nhỏ nhất.
                  </div>

                  <button
                    onClick={handleStartSuggestedMatch}
                    className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3 px-4 rounded-xl text-sm transition shadow-sm hover:scale-101 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    🏸 Bắt đầu thi đấu ngay
                  </button>
                </div>
              ) : (
                !isGeneratingMatchup && (
                  <div className="border border-dashed border-slate-200 rounded-2xl p-10 text-center text-slate-400">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" className="w-10 h-10 mx-auto text-slate-300 mb-3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                    </svg>
                    <p className="text-xs">Chưa có đề xuất nào được tạo.</p>
                    <p className="text-[10px] mt-1">Chọn tối thiểu {matchmakerMatchType === "doubles" ? "4" : "2"} đấu thủ và bấm "Đề xuất cặp đấu" để bắt đầu.</p>
                  </div>
                )
              )}
            </div>
          </div>
        </Card>
      )}


      {/* Live Scoreboard Active Layout */}
      {isLiveActive && activeTab === "live" && (
        <div className="space-y-6">
          {setScores.length > 0 && !isFullscreen && (
            <div className="flex gap-2 justify-center py-2 bg-slate-50 border border-slate-100 rounded-xl">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider self-center mr-2">Kết quả các hiệp:</span>
              {setScores.map((set, idx) => (
                <span key={idx} className="bg-white border border-slate-200 px-3 py-1 rounded-lg text-xs font-black text-slate-800 shadow-2xs">
                  Hiệp {idx + 1}: <span className="text-emerald-700">{set.team_a}</span> - <span className="text-indigo-700">{set.team_b}</span>
                </span>
              ))}
            </div>
          )}

          {/* Fullscreen Scoreboard Wrapper */}
          <div
            id="live-scoreboard-fullscreen-container"
            className={`flex flex-col ${
              isFullscreen
                ? "fixed inset-0 z-[9999] w-screen h-screen bg-slate-950 p-6 justify-between overflow-y-auto"
                : "space-y-6"
            }`}
          >
            {/* Header Action controls */}
            {!isDualView && (
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
                    onClick={toggleFullscreen}
                    className="bg-slate-800 border border-slate-700 hover:bg-slate-700 px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer text-slate-200"
                  >
                    📺 Toàn màn hình
                  </button>

                  <button
                    onClick={() => setIsDualView(!isDualView)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      isDualView 
                        ? "bg-amber-600 border border-amber-500 text-white hover:bg-amber-500" 
                        : "bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300"
                    }`}
                    title="Chế độ đối diện gập 180°"
                  >
                    🔄 Đối diện (180°)
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
            )}
            {isDualView ? (
              /* DUAL-VIEW (180° SPLIT) SCOREBOARD */
              <div className="flex-1 flex flex-col justify-between gap-4 min-h-[500px]">
                {/* 1. PLAYERS DISPLAY (ROTATED 180 DEG) - TAKES UP 100% AVAILABLE HEIGHT */}
                <div 
                  className="rotate-180 flex-1 grid grid-cols-2 gap-4 rounded-2xl overflow-hidden border-2 border-slate-800 bg-slate-950 p-4"
                >
                  {/* Left Column in Code (Rotates to RIGHT of screen, visually the LEFT side of laptop) */}
                  <div 
                    onClick={() => addPoint(swapped ? "B" : "A")}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      adjustScore(swapped ? "B" : "A", -1);
                    }}
                    className={`flex flex-col justify-center items-center rounded-xl p-6 transition cursor-pointer select-none ${
                      (swapped ? justWonPointA : justWonPointB)
                        ? "bg-orange-600 text-white hover:bg-orange-500"
                        : "bg-slate-900/70 text-slate-300 hover:bg-slate-800/60"
                    } ${
                      (swapped ? isMatchPointLiveA : isMatchPointLiveB)
                        ? "ring-4 ring-red-500 bg-red-950/20 animate-pulse"
                        : (swapped ? isSetPointLiveA : isSetPointLiveB)
                          ? "ring-4 ring-amber-500 bg-amber-950/20 animate-pulse"
                          : ""
                    }`}
                  >
                    {(swapped ? isMatchPointLiveA : isMatchPointLiveB) && (
                      <span className="px-2.5 py-0.5 bg-red-600 text-white text-[10px] font-black rounded-md animate-bounce mb-2 uppercase tracking-wider shadow-sm">
                        Match Point
                      </span>
                    )}
                    {(swapped ? isSetPointLiveA : isSetPointLiveB) && !(swapped ? isMatchPointLiveA : isMatchPointLiveB) && (
                      <span className="px-2.5 py-0.5 bg-amber-500 text-slate-900 text-[10px] font-black rounded-md animate-bounce mb-2 uppercase tracking-wider shadow-sm">
                        Set Point
                      </span>
                    )}
                    <span className="text-sm uppercase font-black opacity-60 tracking-widest mb-4">
                      {swapped ? "Đội A" : "Đội B"}
                    </span>
                    <span className="text-[200px] md:text-[320px] lg:text-[450px] font-black leading-none drop-shadow-2xl">
                      {swapped ? currentA : currentB}
                    </span>
                    <span className="text-sm font-semibold truncate max-w-full opacity-80 mt-4">
                      {swapped ? taP1.name : tbP1.name} {matchType === "doubles" && `& ${swapped ? taP2.name : tbP2.name}`}
                    </span>
                  </div>

                  {/* Right Column in Code (Rotates to LEFT of screen, visually the RIGHT side of laptop) */}
                  <div 
                    onClick={() => addPoint(swapped ? "A" : "B")}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      adjustScore(swapped ? "A" : "B", -1);
                    }}
                    className={`flex flex-col justify-center items-center rounded-xl p-6 transition cursor-pointer select-none ${
                      (swapped ? justWonPointB : justWonPointA)
                        ? "bg-orange-600 text-white hover:bg-orange-500"
                        : "bg-slate-900/70 text-slate-300 hover:bg-slate-800/60"
                    } ${
                      (swapped ? isMatchPointLiveB : isMatchPointLiveA)
                        ? "ring-4 ring-red-500 bg-red-950/20 animate-pulse"
                        : (swapped ? isSetPointLiveB : isSetPointLiveA)
                          ? "ring-4 ring-amber-500 bg-amber-950/20 animate-pulse"
                          : ""
                    }`}
                  >
                    {(swapped ? isMatchPointLiveB : isMatchPointLiveA) && (
                      <span className="px-2.5 py-0.5 bg-red-600 text-white text-[10px] font-black rounded-md animate-bounce mb-2 uppercase tracking-wider shadow-sm">
                        Match Point
                      </span>
                    )}
                    {(swapped ? isSetPointLiveB : isSetPointLiveA) && !(swapped ? isMatchPointLiveB : isMatchPointLiveA) && (
                      <span className="px-2.5 py-0.5 bg-amber-500 text-slate-900 text-[10px] font-black rounded-md animate-bounce mb-2 uppercase tracking-wider shadow-sm">
                        Set Point
                      </span>
                    )}
                    <span className="text-sm uppercase font-black opacity-60 tracking-widest mb-4">
                      {swapped ? "Đội B" : "Đội A"}
                    </span>
                    <span className="text-[200px] md:text-[320px] lg:text-[450px] font-black leading-none drop-shadow-2xl">
                      {swapped ? currentB : currentA}
                    </span>
                    <span className="text-sm font-semibold truncate max-w-full opacity-80 mt-4">
                      {swapped ? tbP1.name : taP1.name} {matchType === "doubles" && `& ${swapped ? tbP2.name : taP2.name}`}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* Sân đấu chính - Chia 2 bên */
              <div className={`grid gap-4 md:grid-cols-2 relative rounded-3xl overflow-hidden shadow-2xl border-4 border-slate-900 ${isFullscreen ? "flex-1 my-2" : "min-h-[420px]"}`}>
                {/* Netline dividing the court */}
                <div className="hidden md:block absolute top-0 bottom-0 left-1/2 w-1 bg-yellow-400/90 z-20 shadow-lg pointer-events-none" />

                {/* Left Court Side */}
                <div
                  onClick={() => addPoint(swapped ? "B" : "A")}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    adjustScore(swapped ? "B" : "A", -1);
                  }}
                  className={`flex flex-col justify-between p-6 transition duration-200 cursor-pointer select-none relative ${
                    (swapped ? justWonPointB : justWonPointA)
                      ? "bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white"
                      : "bg-gradient-to-br from-slate-900 to-slate-950 hover:from-slate-800 hover:to-slate-900 text-slate-200"
                  } ${
                    (swapped ? isMatchPointLiveB : isMatchPointLiveA)
                      ? "ring-4 ring-red-500 animate-pulse"
                      : (swapped ? isSetPointLiveB : isSetPointLiveA)
                        ? "ring-4 ring-amber-500 animate-pulse"
                        : ""
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
                    {(swapped ? isMatchPointLiveB : isMatchPointLiveA) && (
                      <span className="px-2.5 py-0.5 bg-red-600 text-white text-[10px] font-black rounded-md animate-bounce mb-2 uppercase tracking-wider shadow-sm">
                        Match Point
                      </span>
                    )}
                    {(swapped ? isSetPointLiveB : isSetPointLiveA) && !(swapped ? isMatchPointLiveB : isMatchPointLiveA) && (
                      <span className="px-2.5 py-0.5 bg-amber-500 text-slate-900 text-[10px] font-black rounded-md animate-bounce mb-2 uppercase tracking-wider shadow-sm">
                        Set Point
                      </span>
                    )}
                    <span className="text-[120px] md:text-[180px] lg:text-[240px] font-black tracking-tight leading-none drop-shadow-md">
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
                  onContextMenu={(e) => {
                    e.preventDefault();
                    adjustScore(swapped ? "A" : "B", -1);
                  }}
                  className={`flex flex-col justify-between p-6 transition duration-200 cursor-pointer select-none relative ${
                    (swapped ? justWonPointA : justWonPointB)
                      ? "bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white"
                      : "bg-gradient-to-br from-slate-900 to-slate-950 hover:from-slate-800 hover:to-slate-900 text-slate-200"
                  } ${
                    (swapped ? isMatchPointLiveA : isMatchPointLiveB)
                      ? "ring-4 ring-red-500 animate-pulse"
                      : (swapped ? isSetPointLiveA : isSetPointLiveB)
                        ? "ring-4 ring-amber-500 animate-pulse"
                        : ""
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
                    {(swapped ? isMatchPointLiveA : isMatchPointLiveB) && (
                      <span className="px-2.5 py-0.5 bg-red-600 text-white text-[10px] font-black rounded-md animate-bounce mb-2 uppercase tracking-wider shadow-sm">
                        Match Point
                      </span>
                    )}
                    {(swapped ? isSetPointLiveA : isSetPointLiveB) && !(swapped ? isMatchPointLiveA : isMatchPointLiveB) && (
                      <span className="px-2.5 py-0.5 bg-amber-500 text-slate-900 text-[10px] font-black rounded-md animate-bounce mb-2 uppercase tracking-wider shadow-sm">
                        Set Point
                      </span>
                    )}
                    <span className="text-[120px] md:text-[180px] lg:text-[240px] font-black tracking-tight leading-none drop-shadow-md">
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
            )}

            {/* Action buttons save/reset */}
            <div className={`flex flex-wrap justify-between items-center gap-4 pt-4 ${isFullscreen ? "border-t border-slate-800" : "border-t border-slate-100"}`}>
              {isDualView ? (
                <>
                  {/* Div 1 (Left): All function buttons merged (including Trận mới & Lưu trận đấu) */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Voice Assistant */}
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

                    {/* Đảo bên sân */}
                    <button
                      onClick={() => setSwapped(!swapped)}
                      className="bg-slate-800 border border-slate-700 hover:bg-slate-700 px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer text-slate-200"
                    >
                      🔄 Đảo Bên Sân
                    </button>

                    {/* Toàn màn hình */}
                    <button
                      onClick={toggleFullscreen}
                      className="bg-slate-800 border border-slate-700 hover:bg-slate-700 px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer text-slate-200"
                    >
                      📺 Toàn màn hình
                    </button>

                    {/* Đối diện 180 */}
                    <button
                      onClick={() => setIsDualView(!isDualView)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        isDualView 
                          ? "bg-amber-600 border border-amber-500 text-white hover:bg-amber-500" 
                          : "bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300"
                      }`}
                    >
                      🔄 Đối diện (180°)
                    </button>

                    {/* Hoàn tác */}
                    <button
                      onClick={undoPoint}
                      disabled={scoreHistory.length === 0}
                      className="bg-slate-800 border border-slate-700 hover:bg-slate-700 px-3.5 py-1.5 rounded-xl text-xs font-bold transition disabled:opacity-30 cursor-pointer text-slate-200"
                    >
                      ↩ Hoàn tác
                    </button>

                    {/* Làm lại */}
                    <button
                      onClick={redoPoint}
                      disabled={redoHistory.length === 0}
                      className="bg-slate-800 border border-slate-700 hover:bg-slate-700 px-3.5 py-1.5 rounded-xl text-xs font-bold transition disabled:opacity-30 cursor-pointer text-slate-200"
                    >
                      ↪ Làm lại
                    </button>

                    {/* Hủy trận */}
                    <button
                      onClick={() => { if (confirm("Bạn muốn hủy trận đấu trực tiếp này?")) { setIsLiveActive(false); resetLiveMatch(); } }}
                      className="bg-rose-950 border border-rose-900 text-rose-300 hover:bg-rose-900 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      Hủy trận
                    </button>

                    {/* Trận mới */}
                    <button
                      onClick={() => { if (confirm("Bạn có chắc chắn muốn làm mới điểm số hiệp này?")) resetLiveMatch(true); }}
                      className="px-4 py-2.5 border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      🔄 Trận mới
                    </button>

                    {/* Xác nhận & Lưu */}
                    <button
                      onClick={handleSaveLiveMatch}
                      disabled={isSavingMatch || (setScores.length === 0 && currentA === 0 && currentB === 0)}
                      className="bg-red-800 hover:bg-red-950 text-white font-bold px-6 py-2.5 rounded-xl shadow-xs hover:scale-102 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSavingMatch ? "Đang lưu..." : "💾 Xác nhận & Lưu trận đấu"}
                    </button>
                  </div>

                  {/* Div 2 (Right): Compact scoreboard for referee - Styled with larger elements */}
                  <div className="flex items-center gap-4 bg-slate-800 border border-slate-700 px-5 py-2.5 rounded-xl shadow-xs text-slate-200">
                    {/* Left Team Small Controller */}
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-400 truncate max-w-[100px]">
                        {swapped ? "Đội B" : "Đội A"}
                      </span>
                      <button
                        onClick={() => adjustScore(swapped ? "B" : "A", -1)}
                        className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-slate-600 transition flex items-center justify-center cursor-pointer text-sm font-bold"
                      >
                        -
                      </button>
                      <span className={`text-2xl font-black w-8 text-center rounded ${
                        (swapped ? justWonPointB : justWonPointA)
                          ? "bg-orange-500 text-white px-1"
                          : "text-emerald-400"
                      }`}>
                        {swapped ? currentB : currentA}
                      </span>
                      <button
                        onClick={() => addPoint(swapped ? "B" : "A")}
                        className="w-8 h-8 rounded-lg bg-emerald-700 hover:bg-emerald-600 transition flex items-center justify-center cursor-pointer text-sm font-bold"
                      >
                        +
                      </button>
                    </div>

                    <span className="text-slate-600 font-bold text-sm">|</span>

                    {/* Right Team Small Controller */}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => addPoint(swapped ? "A" : "B")}
                        className="w-8 h-8 rounded-lg bg-indigo-700 hover:bg-indigo-600 transition flex items-center justify-center cursor-pointer text-sm font-bold"
                      >
                        +
                      </button>
                      <span className={`text-2xl font-black w-8 text-center rounded ${
                        (swapped ? justWonPointA : justWonPointB)
                          ? "bg-orange-500 text-white px-1"
                          : "text-indigo-400"
                      }`}>
                        {swapped ? currentA : currentB}
                      </span>
                      <button
                        onClick={() => adjustScore(swapped ? "A" : "B", -1)}
                        className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-slate-600 transition flex items-center justify-center cursor-pointer text-sm font-bold"
                      >
                        -
                      </button>
                      <span className="text-xs font-bold text-slate-400 truncate max-w-[100px]">
                        {swapped ? "Đội A" : "Đội B"}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                /* Standard layout (Div 1: Exit Fullscreen on Left, Div 2: New/Save on Right) */
                <>
                  <div>
                    {isFullscreen && (
                      <button
                        onClick={toggleFullscreen}
                        className="px-4 py-2.5 border border-slate-700 bg-slate-800 text-slate-200 rounded-xl text-xs font-bold hover:bg-slate-700 transition cursor-pointer"
                      >
                        📺 Thoát Fullscreen
                      </button>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => { if (confirm("Bạn có chắc chắn muốn làm mới điểm số hiệp này?")) resetLiveMatch(true); }}
                      className={`px-4 py-2.5 border rounded-xl text-xs font-bold transition cursor-pointer ${
                        isFullscreen 
                          ? "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700" 
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      🔄 Trận mới
                    </button>
                    <button
                      onClick={handleSaveLiveMatch}
                      disabled={isSavingMatch || (setScores.length === 0 && currentA === 0 && currentB === 0)}
                      className="bg-red-800 hover:bg-red-950 text-white font-bold px-6 py-2.5 rounded-xl shadow-xs hover:scale-102 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSavingMatch ? "Đang lưu..." : "💾 Xác nhận & Lưu trận đấu"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Matches List History tab */}
      {activeTab === "history" && (
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-900">Lịch sử các trận đấu đã ghi nhận</h2>
          {isLoadingMatches ? (
            <p className="text-sm text-slate-400 text-center py-10">Đang tải lịch sử trận đấu...</p>
          ) : (matches.length + offlineMatches.length) === 0 ? (
            <EmptyState
              title="Chưa có trận đấu nào được lưu"
              description="Hãy bắt đầu đếm điểm trực tiếp hoặc ghi kết quả nhanh ở các tab phía trên."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {[...offlineMatches, ...matches].map((m) => {
                const isSingles = m.match_type === "singles";
                const isWonA = m.winner_team === "A";
                const formattedDate = new Date(m.played_at).toLocaleString("vi-VN", {
                  year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit"
                });

                return (
                  <div 
                    key={m.id} 
                    className={`rounded-2xl border p-5 shadow-xs space-y-4 hover:border-slate-300 transition cursor-pointer select-none bg-white ${
                      expandedMatchId === m.id ? "border-slate-400 ring-2 ring-slate-100" : "border-slate-200/60"
                    }`}
                    onClick={() => setExpandedMatchId(expandedMatchId === m.id ? null : m.id)}
                  >
                    <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${isSingles ? "bg-amber-50 text-amber-800 border border-amber-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
                            {isSingles ? "Đấu Đơn" : "Đấu Đôi"}
                          </span>
                          {m.isOfflinePending && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-orange-50 text-orange-700 border border-orange-200 animate-pulse">
                              ⏳ Ngoại tuyến
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1.5 font-medium">Thời gian: {formattedDate}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 italic">
                          Ghi bởi: <span className="font-bold text-slate-600">{m.recorder}</span>
                        </span>
                        <span className="text-slate-300">|</span>
                        <span className="text-xs font-bold text-red-800 flex items-center gap-1">
                          {expandedMatchId === m.id ? "▲ Thu gọn" : "📊 Chi tiết"}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 items-center">
                      {/* Đội A */}
                      <div className={`space-y-1.5 ${isWonA ? "font-bold text-slate-900" : "text-slate-500"}`}>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${isWonA ? "bg-yellow-400" : "bg-slate-300"}`} />
                          <Link
                            href={`/player/scorekeeper/player?key=${encodeURIComponent(m.team_a.player1.id ? `id:${m.team_a.player1.id}` : `name:${m.team_a.player1.name}`)}`}
                            className="truncate block max-w-[130px] hover:text-red-800 hover:underline text-xs"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {m.team_a.player1.name}
                          </Link>
                        </div>
                        {!isSingles && m.team_a.player2 && (
                          <div className="flex items-center gap-1.5 pl-3.5 min-w-0">
                            <Link
                              href={`/player/scorekeeper/player?key=${encodeURIComponent(m.team_a.player2.id ? `id:${m.team_a.player2.id}` : `name:${m.team_a.player2.name}`)}`}
                              className="truncate block max-w-[130px] hover:text-red-800 hover:underline text-[10px] text-slate-400"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {m.team_a.player2.name}
                            </Link>
                          </div>
                        )}
                        <p className="text-xl font-black mt-2 text-emerald-700 pl-3.5">{m.team_a.score} <span className="text-xs font-normal text-slate-400">hiệp thắng</span></p>
                      </div>

                      {/* Đội B */}
                      <div className={`space-y-1.5 ${!isWonA ? "font-bold text-slate-900" : "text-slate-500"}`}>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${!isWonA ? "bg-yellow-400" : "bg-slate-300"}`} />
                          <Link
                            href={`/player/scorekeeper/player?key=${encodeURIComponent(m.team_b.player1.id ? `id:${m.team_b.player1.id}` : `name:${m.team_b.player1.name}`)}`}
                            className="truncate block max-w-[130px] hover:text-red-800 hover:underline text-xs"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {m.team_b.player1.name}
                          </Link>
                        </div>
                        {!isSingles && m.team_b.player2 && (
                          <div className="flex items-center gap-1.5 pl-3.5 min-w-0">
                            <Link
                              href={`/player/scorekeeper/player?key=${encodeURIComponent(m.team_b.player2.id ? `id:${m.team_b.player2.id}` : `name:${m.team_b.player2.name}`)}`}
                              className="truncate block max-w-[130px] hover:text-red-800 hover:underline text-[10px] text-slate-400"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {m.team_b.player2.name}
                            </Link>
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

                    {/* Chi tiết phân tích nâng cao (Vẽ biểu đồ & Bảng so sánh hiệu suất) */}
                    {expandedMatchId === m.id && (
                      <div className="space-y-4 pt-3 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                        {renderPerformanceTable(m.sets, m.team_a.player1.name, m.team_b.player1.name)}
                        {renderMomentumChart(m.sets, m.team_a.player1.name, m.team_b.player1.name)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Player Management tab */}
      {activeTab === "players" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Danh sách & Quản lý người chơi</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Quản lý hồ sơ thành viên câu lạc bộ và khách chơi. Cập nhật Email để liên kết đồng bộ lịch sử đấu.
              </p>
            </div>
          </div>

          {isLoadingAllPlayers ? (
            <p className="text-sm text-slate-400 text-center py-10">Đang tải danh sách người chơi...</p>
          ) : allPlayers.length === 0 ? (
            <EmptyState
              title="Chưa có người chơi nào"
              description="Hãy thêm người chơi mới hoặc tạo khách từ tab Trọng tài."
            />
          ) : (
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-100">
                      <th className="px-6 py-3">Họ và tên</th>
                      <th className="px-6 py-3">Email</th>
                      <th className="px-6 py-3">Số điện thoại</th>
                      <th className="px-6 py-3">Phân loại</th>
                      <th className="px-6 py-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                    {allPlayers.map((player) => (
                      <tr key={player.id} className="hover:bg-slate-50/50 transition">
                        <td className="px-6 py-4 font-bold text-slate-900">{player.full_name}</td>
                        <td className="px-6 py-4 font-medium">
                          {player.is_guest ? (
                            <span className="text-slate-400 italic">Chưa liên kết (Ẩn danh)</span>
                          ) : (
                            <span className="text-slate-600">{player.email}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-slate-500">{player.phone || "-"}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${player.is_guest ? "bg-slate-100 text-slate-500 border border-slate-200" : "bg-emerald-50 text-emerald-800 border border-emerald-200"}`}>
                            {player.is_guest ? "Khách" : "Thành viên"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right flex justify-end gap-2">
                          <Link
                            href={`/player/scorekeeper/player?key=${encodeURIComponent(player.is_guest ? `name:${player.full_name}` : `id:${player.id}`)}`}
                            className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold px-3 py-1 rounded-xl transition cursor-pointer flex items-center justify-center"
                          >
                            📊 Lịch sử
                          </Link>
                          <button
                            onClick={() => {
                              setEditingPlayer(player);
                              setEditPlayerName(player.full_name);
                              setEditPlayerEmail(player.is_guest ? "" : player.email);
                              setEditPlayerPhone(player.phone || "");
                              setEditPlayerError("");
                            }}
                            className="bg-red-50 hover:bg-red-100 border border-red-100 text-red-800 text-xs font-bold px-3 py-1 rounded-xl transition cursor-pointer"
                          >
                            ✏️ Sửa
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Edit Player Modal Overlay */}
          {editingPlayer && (
            <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-[110]">
              <div className="bg-white rounded-2xl p-5 w-full max-w-md shadow-2xl border border-slate-100">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-slate-900">
                    Chỉnh sửa hồ sơ: {editingPlayer.full_name}
                  </h3>
                  <button
                    onClick={() => { setEditingPlayer(null); setEditPlayerError(""); }}
                    className="text-slate-400 hover:text-slate-700 text-sm cursor-pointer"
                  >
                    Hủy
                  </button>
                </div>

                <form onSubmit={handleSavePlayerEdit} className="space-y-4">
                  {editPlayerError && (
                    <p className="text-xs text-rose-600 font-bold bg-rose-50 border border-rose-100 rounded-lg p-2">
                      {editPlayerError}
                    </p>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Họ tên *
                    </label>
                    <input
                      type="text"
                      className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-red-800"
                      value={editPlayerName}
                      onChange={(e) => setEditPlayerName(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Email liên kết *
                    </label>
                    <input
                      type="email"
                      className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-red-800"
                      value={editPlayerEmail}
                      onChange={(e) => setEditPlayerEmail(e.target.value)}
                      placeholder="nvdung@gmail.com"
                      required
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      {editingPlayer.is_guest 
                        ? "Điền Email thật (Gmail) của họ để nâng cấp tài khoản Khách này thành Thành viên chính thức, giúp đồng bộ hóa lịch sử đấu khi họ đăng nhập."
                        : "Email dùng để đăng nhập và đồng bộ lịch sử đấu."}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Số điện thoại
                    </label>
                    <input
                      type="tel"
                      className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-red-800"
                      value={editPlayerPhone}
                      onChange={(e) => setEditPlayerPhone(e.target.value)}
                      placeholder="Ví dụ: 0912345678"
                    />
                  </div>

                  <div className="flex gap-2 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setEditingPlayer(null)}
                      className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl cursor-pointer"
                    >
                      Đóng
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingPlayerEdit}
                      className="px-4 py-2 text-xs font-bold text-white bg-red-800 hover:bg-red-900 rounded-xl disabled:opacity-50 cursor-pointer"
                    >
                      {isSavingPlayerEdit ? "Đang lưu..." : "Lưu thay đổi"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
