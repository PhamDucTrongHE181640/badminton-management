"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Target, MapPin, Users, Dna, Circle, Activity, CircleDashed } from "lucide-react";

import { Badge, Button, Card, Notice, inputClassName } from "@/components/ui";
import { API_BASE_URL, apiFetch } from "@/lib/http";
import { errorMessage } from "@/lib/format";

type Sport = "Pickleball" | "Badminton" | "Tennis" | "Football";

type SkillTierSummary = {
  visible_skill_tier: string;
  matches_played: number;
  wins: number;
  losses: number;
  draws: number;
  updated_at: string | null;
  has_assessment: boolean;
};

type AssessmentSubmitResponse = {
  assessment_id: string;
  visible_skill_tier: string;
  elo_delta: number;
};

// Mock stock videos for the AI simulation to make it offline-friendly and beautiful
const sportDemoVideos: Record<Sport, string> = {
  Pickleball: "https://assets.mixkit.co/videos/preview/mixkit-tennis-player-hitting-a-ball-in-slow-motion-23132-large.mp4", // mixkit tennis as close match for racket sports
  Badminton: "https://assets.mixkit.co/videos/preview/mixkit-playing-badminton-in-a-hall-34352-large.mp4",
  Tennis: "https://assets.mixkit.co/videos/preview/mixkit-tennis-player-hitting-a-ball-in-slow-motion-23132-large.mp4",
  Football: "https://assets.mixkit.co/videos/preview/mixkit-soccer-player-kicking-a-ball-in-a-stadium-11805-large.mp4"
};

// Stepper states
type QuizQuestion = {
  id: string;
  question: string;
  options: Array<{ label: string; value: number }>;
};

const quizQuestionsBySport: Record<Sport, QuizQuestion[]> = {
  Pickleball: [
    {
      id: "experience",
      question: "Bạn đã chơi Pickleball bao lâu rồi?",
      options: [
        { label: "Mới bắt đầu (Dưới 1 tháng)", value: 1 },
        { label: "Từ 1 - 3 tháng", value: 2 },
        { label: "Từ 3 - 6 tháng", value: 3 },
        { label: "Từ 6 - 12 tháng", value: 4 },
        { label: "Trên 12 tháng", value: 5 }
      ]
    },
    {
      id: "frequency",
      question: "Tần suất ra sân luyện tập hoặc thi đấu của bạn?",
      options: [
        { label: "Thỉnh thoảng (Dưới 1 buổi/tuần)", value: 1 },
        { label: "Trung bình (1 - 2 buổi/tuần)", value: 2 },
        { label: "Đều đặn (3 - 4 buổi/tuần)", value: 3 },
        { label: "Thường xuyên (Trên 4 buổi/tuần)", value: 4 }
      ]
    },
    {
      id: "playstyle",
      question: "Lối chơi hoặc kỹ thuật sở trường của bạn?",
      options: [
        { label: "Chỉ đánh giải trí, chưa có kỹ thuật rõ ràng", value: 1 },
        { label: "Thiên về kiểm soát bóng, gác vợt bền bỉ", value: 2 },
        { label: "Thiên về tấn công, smash/đập bóng mạnh mẽ", value: 3 },
        { label: "Linh hoạt di chuyển, công thủ toàn diện", value: 4 }
      ]
    }
  ],
  Badminton: [
    {
      id: "experience",
      question: "Bạn đã chơi Cầu lông bao lâu rồi?",
      options: [
        { label: "Mới bắt đầu (Dưới 1 tháng)", value: 1 },
        { label: "Từ 1 - 3 tháng", value: 2 },
        { label: "Từ 3 - 6 tháng", value: 3 },
        { label: "Từ 6 - 12 tháng", value: 4 },
        { label: "Trên 12 tháng", value: 5 }
      ]
    },
    {
      id: "frequency",
      question: "Tần suất chơi Cầu lông của bạn?",
      options: [
        { label: "Thỉnh thoảng (Dưới 1 buổi/tuần)", value: 1 },
        { label: "Trung bình (1 - 2 buổi/tuần)", value: 2 },
        { label: "Đều đặn (3 - 4 buổi/tuần)", value: 3 },
        { label: "Thường xuyên (Trên 4 buổi/tuần)", value: 4 }
      ]
    },
    {
      id: "playstyle",
      question: "Đâu là kỹ thuật sở trường của bạn?",
      options: [
        { label: "Chỉ chơi casual, chưa có kỹ thuật smash", value: 1 },
        { label: "Thiên về thủ cầu, phông cầu sâu cuối sân", value: 2 },
        { label: "Thiên về đập cầu tấn công dồn dập", value: 3 },
        { label: "Điều cầu linh hoạt, bỏ nhỏ lưới hiểm hóc", value: 4 }
      ]
    }
  ],
  Tennis: [
    {
      id: "experience",
      question: "Bạn đã chơi Tennis bao lâu rồi?",
      options: [
        { label: "Mới bắt đầu (Dưới 1 tháng)", value: 1 },
        { label: "Từ 1 - 3 tháng", value: 2 },
        { label: "Từ 3 - 6 tháng", value: 3 },
        { label: "Từ 6 - 12 tháng", value: 4 },
        { label: "Trên 12 tháng", value: 5 }
      ]
    },
    {
      id: "frequency",
      question: "Tần suất chơi Tennis của bạn?",
      options: [
        { label: "Thỉnh thoảng (Dưới 1 buổi/tuần)", value: 1 },
        { label: "Trung bình (1 - 2 buổi/tuần)", value: 2 },
        { label: "Đều đặn (3 - 4 buổi/tuần)", value: 3 },
        { label: "Thường xuyên (Trên 4 buổi/tuần)", value: 4 }
      ]
    },
    {
      id: "playstyle",
      question: "Kỹ năng Tennis tốt nhất của bạn?",
      options: [
        { label: "Mới tập đánh qua lại cơ bản", value: 1 },
        { label: "Forehand/Backhand cuối sân ổn định", value: 2 },
        { label: "Giao bóng mạnh mẽ và lên lưới tấn công", value: 3 },
        { label: "Điều bóng thông minh, bền bỉ cuối sân", value: 4 }
      ]
    }
  ],
  Football: [
    {
      id: "experience",
      question: "Bạn đã chơi Bóng đá bao lâu rồi?",
      options: [
        { label: "Mới bắt đầu", value: 1 },
        { label: "Dưới 1 năm", value: 2 },
        { label: "Từ 1 - 3 năm", value: 3 },
        { label: "Từ 3 - 5 năm", value: 4 },
        { label: "Trên 5 năm", value: 5 }
      ]
    },
    {
      id: "frequency",
      question: "Tần suất chơi Bóng đá của bạn?",
      options: [
        { label: "Thỉnh thoảng (Dưới 1 trận/tuần)", value: 1 },
        { label: "Trung bình (1 - 2 trận/tuần)", value: 2 },
        { label: "Đều đặn (3 - 4 trận/tuần)", value: 3 },
        { label: "Thường xuyên (Trên 4 trận/tuần)", value: 4 }
      ]
    },
    {
      id: "playstyle",
      question: "Vị trí sở trường của bạn?",
      options: [
        { label: "Thủ môn hoặc chỉ đá vui", value: 1 },
        { label: "Hậu vệ (đánh chặn, bọc lót cơ bắp)", value: 2 },
        { label: "Tiền vệ (kiến thiết, cầm nhịp kỹ thuật)", value: 3 },
        { label: "Tiền đạo (dứt điểm, tốc độ nhạy bén)", value: 4 }
      ]
    }
  ]
};

export default function PlayerAssessmentPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<SkillTierSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Stepper UI Step State
  // 1: Start, 2: Choose Sport, 3: Quiz questions, 4: Upload/Select Video, 5: Upload Success, 6: AI Analyzing, 7: AI Highlight Details, 8: Final Result, 9: Radar searching, 10: Complete
  const [step, setStep] = useState(1);
  const [selectedSport, setSelectedSport] = useState<Sport>("Pickleball");
  
  // Quiz states
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  
  // Video states
  const [uploadedVideo, setUploadedVideo] = useState<File | null>(null);
  const [useSampleVideo, setUseSampleVideo] = useState(false);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string>("");
  
  // Simulated processing values
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStepText, setAnalysisStepText] = useState("Khởi tạo tiến trình...");
  
  // Calculated Result States
  const [computedElo, setComputedElo] = useState(1000);
  const [computedTier, setComputedTier] = useState<"Beginner" | "Intermediate" | "Advanced">("Intermediate");
  const [scores, setScores] = useState({
    technical: 75,
    movement: 70,
    reflection: 72,
    tactical: 68,
    stamina: 70
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Load user data on startup
  async function loadUserSummary() {
    setIsLoading(true);
    try {
      const skillTier = await apiFetch<SkillTierSummary>("/api/v1/player/skill-tier", { credentials: "include" });
      setSummary(skillTier);
    } catch (caught) {
      setSummary(null);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadUserSummary();
  }, []);

  const currentQuestions = useMemo(() => {
    return quizQuestionsBySport[selectedSport];
  }, [selectedSport]);

  const totalQuizSteps = currentQuestions.length;

  const currentQuestion = currentQuestions[currentQuizIndex];

  // Handle choosing sport
  const handleSportSelect = (sport: Sport) => {
    setSelectedSport(sport);
    setQuizAnswers({});
    setCurrentQuizIndex(0);
    setStep(3); // Go to Quiz questions
  };

  // Handle answering quiz option
  const handleQuizAnswer = (value: number) => {
    const questionKey = currentQuestion.id;
    setQuizAnswers(prev => ({ ...prev, [questionKey]: value }));

    if (currentQuizIndex < totalQuizSteps - 1) {
      setCurrentQuizIndex(prev => prev + 1);
    } else {
      // Calculate mock results based on quiz answers
      const expValue = quizAnswers["experience"] || value;
      const freqValue = quizAnswers["frequency"] || 2;
      const styleValue = quizAnswers["playstyle"] || 2;

      // Base scores
      let baseTechnical = 50 + expValue * 8 + styleValue * 2;
      let baseMovement = 45 + freqValue * 10 + styleValue * 3;
      let baseReflection = 50 + expValue * 6 + styleValue * 4;
      let baseTactical = 40 + expValue * 10 + freqValue * 2;
      let baseStamina = 40 + freqValue * 12 + expValue * 2;

      // Cap at 100
      const technical = Math.min(Math.max(baseTechnical, 30), 98);
      const movement = Math.min(Math.max(baseMovement, 30), 96);
      const reflection = Math.min(Math.max(baseReflection, 30), 97);
      const tactical = Math.min(Math.max(baseTactical, 30), 95);
      const stamina = Math.min(Math.max(baseStamina, 30), 99);

      // Determine Tier and ELO
      let tier: "Beginner" | "Intermediate" | "Advanced" = "Intermediate";
      let elo = 1200;

      if (expValue <= 2) {
        tier = "Beginner";
        elo = 800 + Math.round((technical + stamina) * 2.2);
      } else if (expValue >= 5 || (expValue >= 4 && freqValue >= 3)) {
        tier = "Advanced";
        elo = 1350 + Math.round((technical + tactical + reflection) * 0.9);
      } else {
        tier = "Intermediate";
        elo = 1100 + Math.round((technical + movement + tactical) * 0.7);
      }

      setScores({ technical, movement, reflection, tactical, stamina });
      setComputedElo(elo);
      setComputedTier(tier);

      setStep(4); // Go to Video upload/selection
    }
  };

  // Handle Video file change
  const handleVideoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      setUploadedVideo(file);
      setUseSampleVideo(false);
      setVideoPreviewUrl(URL.createObjectURL(file));
      setStep(5);
    }
  };

  // Handle selecting sample video
  const handleSelectSample = () => {
    setUseSampleVideo(true);
    setUploadedVideo(null);
    setVideoPreviewUrl(sportDemoVideos[selectedSport]);
    setStep(5);
  };

  // Start analysis processing
  const startAnalysis = () => {
    setStep(6);
    setAnalysisProgress(0);
    setAnalysisStepText("Đang nén và chuẩn bị video...");

    const intervals = [
      { progress: 15, text: "Nhận diện vận động viên trên sân..." },
      { progress: 45, text: "AI đang trích xuất tư thế (Pose Tracking)..." },
      { progress: 70, text: "Đang phân tích góc đập và bộ chân di chuyển..." },
      { progress: 90, text: "Đối chiếu kỹ năng với bộ ELO tiêu chuẩn..." },
      { progress: 100, text: "Hoàn tất báo cáo đánh giá trình độ!" }
    ];

    let currentIntervalIdx = 0;
    
    const intervalTimer = setInterval(() => {
      setAnalysisProgress(prev => {
        const target = intervals[currentIntervalIdx].progress;
        if (prev < target) {
          return prev + 1;
        } else {
          if (prev >= 100) {
            clearInterval(intervalTimer);
            // Go to Step 7 (AI Highlight detail page)
            setTimeout(() => {
              setStep(7);
            }, 500);
            return 100;
          }
          setAnalysisStepText(intervals[currentIntervalIdx].text);
          currentIntervalIdx = Math.min(currentIntervalIdx + 1, intervals.length - 1);
          return prev + 1;
        }
      });
    }, 50);
  };

  // Canvas Pose overlay loop logic (Step 7 animation)
  useEffect(() => {
    if (step !== 7) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = canvas.width = 480;
    let height = canvas.height = 270;

    // Simulated skeleton keypoints
    const renderSkeleton = (time: number) => {
      ctx.clearRect(0, 0, width, height);

      // Pulse green colors for AI grid effect
      ctx.strokeStyle = "rgba(16, 185, 129, 0.15)";
      ctx.lineWidth = 1;
      // Grid lines
      for (let i = 0; i < width; i += 30) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, height);
        ctx.stroke();
      }
      for (let j = 0; j < height; j += 30) {
        ctx.beginPath();
        ctx.moveTo(0, j);
        ctx.lineTo(width, j);
        ctx.stroke();
      }

      // Compute dynamic positions based on sine wave
      const centerX = width / 2 + Math.sin(time / 200) * 40;
      const centerY = height / 2 + Math.cos(time / 300) * 15 + 10;

      const joints = {
        head: { x: centerX, y: centerY - 45 },
        neck: { x: centerX, y: centerY - 30 },
        shoulderR: { x: centerX - 22, y: centerY - 25 },
        shoulderL: { x: centerX + 22, y: centerY - 25 },
        elbowR: { x: centerX - 35 + Math.sin(time / 150) * 15, y: centerY - 5 },
        elbowL: { x: centerX + 35, y: centerY - 5 },
        handR: { x: centerX - 42 + Math.sin(time / 150) * 25, y: centerY + 15 + Math.cos(time / 150) * 15 },
        handL: { x: centerX + 45, y: centerY + 15 },
        hipR: { x: centerX - 14, y: centerY + 20 },
        hipL: { x: centerX + 14, y: centerY + 20 },
        kneeR: { x: centerX - 18 + Math.cos(time / 200) * 8, y: centerY + 55 },
        kneeL: { x: centerX + 18, y: centerY + 55 },
        footR: { x: centerX - 20 + Math.cos(time / 200) * 12, y: centerY + 90 },
        footL: { x: centerX + 20, y: centerY + 90 }
      };

      // Draw bounding box
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(centerX - 50, centerY - 60, 100, 160);
      
      // Draw label
      ctx.fillStyle = "#10b981";
      ctx.font = "bold 9px sans-serif";
      ctx.fillText("PLAYER: ACTIVE", centerX - 45, centerY - 66);
      ctx.fillText(`CONFIDENCE: 94.6%`, centerX - 45, centerY + 112);

      // Draw bones
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";

      const drawBone = (j1: { x: number; y: number }, j2: { x: number; y: number }) => {
        ctx.beginPath();
        ctx.moveTo(j1.x, j1.y);
        ctx.lineTo(j2.x, j2.y);
        ctx.stroke();
      };

      // Spine & Shoulders
      drawBone(joints.head, joints.neck);
      drawBone(joints.neck, joints.shoulderR);
      drawBone(joints.neck, joints.shoulderL);
      drawBone(joints.shoulderR, joints.shoulderL);
      drawBone(joints.shoulderR, joints.hipR);
      drawBone(joints.shoulderL, joints.hipL);
      drawBone(joints.hipR, joints.hipL);

      // Arms
      drawBone(joints.shoulderR, joints.elbowR);
      drawBone(joints.elbowR, joints.handR);
      drawBone(joints.shoulderL, joints.elbowL);
      drawBone(joints.elbowL, joints.handL);

      // Legs
      drawBone(joints.hipR, joints.kneeR);
      drawBone(joints.kneeR, joints.footR);
      drawBone(joints.hipL, joints.kneeL);
      drawBone(joints.kneeL, joints.footL);

      // Draw Joint points
      ctx.fillStyle = "#ef4444";
      Object.values(joints).forEach(joint => {
        ctx.beginPath();
        ctx.arc(joint.x, joint.y, 4, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw racket path lines
      ctx.strokeStyle = "rgba(245, 158, 11, 0.6)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const t = time - i * 30;
        const hx = width / 2 + Math.sin(t / 200) * 40 - 42 + Math.sin(t / 150) * 25;
        const hy = height / 2 + Math.cos(t / 300) * 15 + 10 + 15 + Math.cos(t / 150) * 15;
        if (i === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.stroke();

      animationFrameId = requestAnimationFrame(renderSkeleton);
    };

    renderSkeleton(0);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [step]);

  // Save the assessment result to Backend actual DB
  const saveAssessmentToBackend = async () => {
    setIsLoading(true);
    setError("");
    try {
      // Backend expects structured range value questions, we mapping quiz to standard keys
      const mappingAnswers: Record<string, number> = {
        weekly_sessions: Math.min((quizAnswers["frequency"] || 2) * 2, 7),
        experience_years: Math.min((quizAnswers["experience"] || 2) * 2, 10),
        racket_control: Math.round(scores.technical / 20),
        footwork: Math.round(scores.movement / 20),
        stamina: Math.round(scores.stamina / 20),
        match_reading: Math.round(scores.tactical / 20)
      };

      await apiFetch<AssessmentSubmitResponse>(
        "/api/v1/player/assessments",
        {
          method: "POST",
          credentials: "include",
          body: JSON.stringify({
            sport: selectedSport === "Pickleball" ? "Tennis" : selectedSport, // fallback Pickleball to Tennis on backend standard db if not supported
            form_version: "v1_simulation",
            answers: mappingAnswers
          })
        }
      );
      
      setStep(8); // Show Final Results Screen
    } catch (caught) {
      setError(errorMessage(caught, "Không thể đồng bộ kết quả lên máy chủ."));
      setStep(8); // Still let them see results local
    } finally {
      setIsLoading(false);
    }
  };

  // Simulated radar sweep (Step 9 animation)
  const startRadarSearching = () => {
    setStep(9);
    setTimeout(() => {
      // Complete search and route
      setStep(10);
      setTimeout(() => {
        router.push("/player/discovery?mode=matchmaking");
      }, 1500);
    }, 3500);
  };

  // Helper values for drawing Radar SVG chart
  const radarPath = useMemo(() => {
    const center = 100;
    const rMax = 80;
    const angles = [-90, -18, 54, 126, 198].map(deg => (deg * Math.PI) / 180);
    
    // Technical, Movement, Reflection, Tactical, Stamina
    const dataValues = [
      scores.stamina,
      scores.reflection,
      scores.tactical,
      scores.technical,
      scores.movement
    ];

    const points = angles.map((angle, idx) => {
      const radius = (dataValues[idx] / 100) * rMax;
      const x = center + radius * Math.cos(angle);
      const y = center + radius * Math.sin(angle);
      return `${x},${y}`;
    });

    return points.join(" ");
  }, [scores]);

  const radarGridPaths = useMemo(() => {
    const center = 100;
    const rMax = 80;
    const angles = [-90, -18, 54, 126, 198].map(deg => (deg * Math.PI) / 180);
    
    const grids = [0.25, 0.5, 0.75, 1];
    return grids.map(gridRatio => {
      const points = angles.map(angle => {
        const radius = gridRatio * rMax;
        const x = center + radius * Math.cos(angle);
        const y = center + radius * Math.sin(angle);
        return `${x},${y}`;
      });
      return points.join(" ");
    });
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {error && <Notice tone="danger" className="mb-6">{error}</Notice>}

      {/* STEP 1: WELCOME SCREEN */}
      {step === 1 && (
        <Card className="max-w-xl mx-auto overflow-hidden border border-slate-200/80 shadow-xl rounded-3xl p-0">
          <div className="bg-[#b00c14] text-white p-8 text-center space-y-3 relative overflow-hidden">
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.4)_0,transparent_70%)]" />
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 font-heading text-lg font-bold">N</span>
            <h2 className="font-heading text-2xl font-extrabold tracking-tight">AI Skill Assessment</h2>
            <p className="text-xs text-red-100 max-w-sm mx-auto">
              Hệ thống phân tích thông minh của NetUp giúp khởi tạo trình độ và ghép sân chính xác nhất cho bạn.
            </p>
          </div>
          <div className="p-7 space-y-6">
            <div className="text-center space-y-2">
              <h3 className="font-heading text-lg font-bold text-slate-900">Tìm đối thủ phù hợp với trình độ của bạn</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                Trả lời nhanh trắc nghiệm và tải lên video/chọn video mẫu để AI phân tích ELO, radar kỹ năng ban đầu.
              </p>
            </div>

            <div className="grid gap-3.5">
              {[
                { icon: <Target className="h-6 w-6 text-emerald-600" />, title: "Ghép đối thủ cùng trình độ", desc: "Không lo lệch trình khi tham gia phòng ghép đối ELO." },
                { icon: <MapPin className="h-6 w-6 text-sky-600" />, title: "Sân chơi chất lượng, giá tốt", desc: "Đề xuất cụm sân gần bạn có cơ sở vật chất tương ứng." },
                { icon: <Users className="h-6 w-6 text-amber-600" />, title: "Cộng đồng thể thao văn minh", desc: "Môi trường kết nối bạn chơi có văn hóa thể thao cao." }
              ].map(item => (
                <div key={item.title} className="flex gap-3 bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
                  <div className="shrink-0 pt-0.5">{item.icon}</div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">{item.title}</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full flex h-11 items-center justify-center rounded-2xl bg-[#b00c14] hover:bg-[#900a10] text-sm font-bold text-white transition cursor-pointer shadow-md"
            >
              Bắt đầu ngay ➔
            </button>
            
            {summary?.has_assessment && (
              <p className="text-center text-[11px] text-slate-400">
                Bạn đã có cấp độ ELO. Việc đánh giá lại sẽ cập nhật dữ liệu kỹ năng mới của bạn.
              </p>
            )}
          </div>
        </Card>
      )}

      {/* STEP 2: CHOOSE SPORT */}
      {step === 2 && (
        <div className="max-w-xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <span className="text-xs font-bold text-[#b00c14] uppercase tracking-wider">Bước 1 / 4</span>
            <h2 className="font-heading text-2xl font-extrabold text-slate-900">Bạn thường chơi môn nào?</h2>
            <p className="text-xs text-slate-500">Chọn môn thể thao bạn muốn thực hiện đánh giá kỹ năng ngay.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { id: "Pickleball", icon: <CircleDashed className="h-7 w-7 text-lime-600" />, label: "Pickleball", desc: "Môn thể thao xu hướng cực hot", color: "hover:border-lime-500 hover:bg-lime-50/30" },
              { id: "Badminton", icon: <Circle className="h-7 w-7 text-rose-600" />, label: "Cầu lông", desc: "Chơi nhanh, đòi hỏi phản xạ cao", color: "hover:border-rose-500 hover:bg-rose-50/30" },
              { id: "Tennis", icon: <Dna className="h-7 w-7 text-sky-600" />, label: "Tennis", desc: "Sân rộng, đòi hỏi kỹ thuật chuẩn", color: "hover:border-sky-500 hover:bg-sky-50/30" },
              { id: "Football", icon: <Activity className="h-7 w-7 text-emerald-600" />, label: "Bóng đá", desc: "Môn thể thao vua phối hợp đồng đội", color: "hover:border-emerald-500 hover:bg-emerald-50/30" }
            ].map(sportItem => (
              <button
                key={sportItem.id}
                onClick={() => handleSportSelect(sportItem.id as Sport)}
                className={`p-5 rounded-3xl border border-slate-200 bg-white text-left transition duration-200 cursor-pointer shadow-sm ${sportItem.color} flex flex-col justify-between h-40`}
              >
                <div className="bg-slate-50 h-12 w-12 rounded-2xl flex items-center justify-center border border-slate-100">
                  {sportItem.icon}
                </div>
                <div>
                  <h3 className="font-heading font-bold text-slate-900 text-sm">{sportItem.label}</h3>
                  <p className="text-[10px] text-slate-400 font-semibold mt-1 leading-snug">{sportItem.desc}</p>
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={() => setStep(1)}
            className="w-full text-center text-xs font-bold text-slate-500 hover:text-slate-800 transition py-2"
          >
            Quay lại trang chủ
          </button>
        </div>
      )}

      {/* STEP 3: QUIZ QUESTIONS */}
      {step === 3 && currentQuestion && (
        <div className="max-w-lg mx-auto space-y-6">
          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase">
              <span>Môn: {selectedSport}</span>
              <span>{currentQuizIndex + 1} / {totalQuizSteps}</span>
            </div>
            
            {/* Custom progress bar */}
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#b00c14] transition-all duration-300"
                style={{ width: `${((currentQuizIndex + 1) / totalQuizSteps) * 100}%` }}
              />
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-lg space-y-6">
            <h3 className="font-heading text-lg font-extrabold text-slate-900 text-center leading-snug">
              {currentQuestion.question}
            </h3>

            <div className="grid gap-3">
              {currentQuestion.options.map(option => (
                <button
                  key={option.label}
                  onClick={() => handleQuizAnswer(option.value)}
                  className="w-full text-left p-4.5 rounded-2xl border border-slate-200/80 bg-white hover:border-[#b00c14] hover:bg-red-50/20 text-xs font-bold text-slate-800 transition cursor-pointer shadow-3xs hover:shadow-2xs active:bg-red-50/40"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => {
              if (currentQuizIndex > 0) {
                setCurrentQuizIndex(prev => prev - 1);
              } else {
                setStep(2);
              }
            }}
            className="w-full text-center text-xs font-bold text-slate-500 hover:text-slate-800 transition py-2"
          >
            Quay lại
          </button>
        </div>
      )}

      {/* STEP 4: VIDEO UPLOAD / SELECT SAMPLE */}
      {step === 4 && (
        <div className="max-w-xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <span className="text-xs font-bold text-[#b00c14] uppercase tracking-wider">Bước 3 / 4</span>
            <h2 className="font-heading text-2xl font-extrabold text-slate-900">Đánh giá kỹ thuật của bạn</h2>
            <p className="text-xs text-slate-500">
              Hãy tải lên video cá nhân hoặc lựa chọn video mẫu tương tự kỹ thuật hiện tại của bạn để mô phỏng phân tích.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            
            {/* Box 1: Real upload */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-md flex flex-col justify-between gap-4">
              <div className="space-y-2">
                <span className="text-xl">📤</span>
                <h3 className="font-heading font-bold text-slate-900 text-sm">Tải lên video của bạn</h3>
                <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                  Tải lên 1 video ngắn (15-60 giây) quay lại pha xử lý bóng/cầu thực tế của bạn trên sân.
                </p>
              </div>
              
              <div className="relative">
                <input
                  type="file"
                  id="video-upload-file"
                  accept="video/*"
                  onChange={handleVideoUpload}
                  className="sr-only"
                />
                <label
                  htmlFor="video-upload-file"
                  className="w-full flex h-10 items-center justify-center rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-700 transition cursor-pointer text-center"
                >
                  Chọn video từ thiết bị
                </label>
              </div>
            </div>

            {/* Box 2: Use sample video (Recommended fallback) */}
            <div className="bg-white p-5 rounded-3xl border border-[#b00c14]/40 bg-red-50/10 shadow-md flex flex-col justify-between gap-4">
              <div className="space-y-2">
                <span className="text-xl text-red-600">⚡</span>
                <h3 className="font-heading font-bold text-slate-900 text-sm">Sử dụng video mẫu</h3>
                <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                  Trường hợp chưa có sẵn video, bạn có thể sử dụng video mô hình chuẩn được tối ưu của môn {selectedSport}.
                </p>
              </div>

              <button
                onClick={handleSelectSample}
                className="w-full flex h-10 items-center justify-center rounded-xl bg-[#b00c14] hover:bg-[#900a10] text-xs font-bold text-white transition cursor-pointer text-center"
              >
                Chọn video mẫu {selectedSport}
              </button>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-[11px] text-slate-500 space-y-1.5 leading-relaxed">
            <p className="font-bold text-slate-700">Yêu cầu chất lượng video (nếu tải lên):</p>
            <p>• Thời lượng tối ưu: 15 - 60 giây, quay toàn thân rõ nét di chuyển chân.</p>
            <p>• Dung lượng tối đa: 200MB. Hỗ trợ định dạng MP4, MOV, AVI.</p>
          </div>

          <button
            onClick={() => setStep(3)}
            className="w-full text-center text-xs font-bold text-slate-500 hover:text-slate-800 transition py-2"
          >
            Quay lại
          </button>
        </div>
      )}

      {/* STEP 5: UPLOAD SUCCESS */}
      {step === 5 && (
        <Card className="max-w-md mx-auto border border-slate-200/80 shadow-xl rounded-3xl p-6 space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 text-xl font-bold">✓</div>
            <h2 className="font-heading text-xl font-extrabold text-slate-900">Xác nhận video thành công!</h2>
            <p className="text-xs text-slate-400 font-semibold">Video đã sẵn sàng để hệ thống phân tích kỹ năng của bạn.</p>
          </div>

          {/* Video Preview Card */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 flex gap-3 p-3 items-center">
            {videoPreviewUrl ? (
              <video 
                src={videoPreviewUrl} 
                className="h-16 w-20 rounded-lg object-cover bg-black"
                muted
                playsInline
              />
            ) : (
              <div className="h-16 w-20 rounded-lg bg-slate-200 flex items-center justify-center text-lg">📹</div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-800 truncate">
                {useSampleVideo ? `video_mau_${selectedSport.toLowerCase()}.mp4` : (uploadedVideo?.name || "my_video.mp4")}
              </p>
              <p className="text-[10px] text-slate-400 font-bold mt-1">
                {useSampleVideo ? "Video mẫu chất lượng cao" : `${((uploadedVideo?.size || 0) / 1024 / 1024).toFixed(1)} MB · MP4 format`}
              </p>
              <span className="inline-flex mt-1.5 px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 text-[9px] font-bold border border-emerald-100">Đã tải lên</span>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <button
              onClick={startAnalysis}
              className="w-full flex h-11 items-center justify-center rounded-2xl bg-[#b00c14] hover:bg-[#900a10] text-sm font-bold text-white transition cursor-pointer shadow-md"
            >
              Đánh giá trình độ ➔
            </button>
            <button
              onClick={() => setStep(4)}
              className="w-full flex h-11 items-center justify-center rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-sm font-bold text-slate-700 transition cursor-pointer"
            >
              Chọn video khác
            </button>
          </div>
        </Card>
      )}

      {/* STEP 6: AI ANALYZING PROGRESS */}
      {step === 6 && (
        <Card className="max-w-md mx-auto border border-slate-200/80 shadow-xl rounded-3xl p-8 space-y-8 text-center">
          <div className="space-y-2">
            <h2 className="font-heading text-xl font-extrabold text-slate-900">Hệ thống đang phân tích...</h2>
            <p className="text-xs text-slate-400 font-semibold">Vui lòng chờ trong giây lát để trích xuất dữ liệu.</p>
          </div>

          {/* Radial animated progress indicator */}
          <div className="relative h-32 w-32 mx-auto flex items-center justify-center">
            {/* SVG Ring */}
            <svg className="h-full w-full -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="56"
                fill="transparent"
                stroke="#f1f5f9"
                strokeWidth="8"
              />
              <circle
                cx="64"
                cy="64"
                r="56"
                fill="transparent"
                stroke="#b00c14"
                strokeWidth="8"
                strokeDasharray={351.8}
                strokeDashoffset={351.8 - (351.8 * analysisProgress) / 100}
                strokeLinecap="round"
                className="transition-all duration-75"
              />
            </svg>
            <span className="absolute text-2xl font-black text-slate-800">{analysisProgress}%</span>
          </div>

          {/* Checklist boxes */}
          <div className="text-left max-w-xs mx-auto space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Trạng thái AI phân tích</p>
            {[
              { val: 15, label: "Nhận diện người chơi" },
              { val: 45, label: "Vẽ khung xương động tác" },
              { val: 70, label: "Phân tích chuyển động chân" },
              { val: 90, label: "Tính toán trình độ kỹ thuật" }
            ].map(item => {
              const isDone = analysisProgress >= item.val;
              return (
                <div key={item.label} className="flex items-center gap-2 text-xs">
                  <span className={`h-4.5 w-4.5 rounded-full flex items-center justify-center text-[10px] font-bold border ${
                    isDone ? "bg-emerald-50 border-emerald-200 text-emerald-600" : "bg-white border-slate-200 text-slate-300"
                  }`}>
                    {isDone ? "✓" : ""}
                  </span>
                  <span className={isDone ? "font-bold text-slate-800" : "text-slate-400"}>{item.label}</span>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-slate-500 font-semibold animate-pulse">{analysisStepText}</p>
        </Card>
      )}

      {/* STEP 7: AI HIGHLIGHT DETAIL (SKELETON POSE OVERLAY) */}
      {step === 7 && (
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <span className="text-xs font-bold text-[#b00c14] uppercase tracking-wider">Phân tích kỹ năng chi tiết</span>
            <h2 className="font-heading text-2xl font-extrabold text-slate-900">Xem lại phân tích động tác (AI Overlay)</h2>
            <p className="text-xs text-slate-500">Mô hình AI trích xuất các điểm nổi bật từ chuyển động cơ thể của bạn.</p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            
            {/* Left: Video with Skeleton Canvas Overlay */}
            <div className="relative rounded-3xl overflow-hidden bg-black aspect-video border border-slate-850 shadow-2xl flex items-center justify-center">
              {/* Actual Video tag (runs in background) */}
              <video
                ref={videoRef}
                src={videoPreviewUrl}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover opacity-60"
              />
              
              {/* Overlay Canvas drawing the Pose bones */}
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none z-10"
              />

              {/* Decorative AI box */}
              <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-xs text-emerald-400 text-[10px] font-mono font-bold px-2 py-1 rounded border border-emerald-500/30 uppercase tracking-widest animate-pulse">
                REC ● Pose Estimation
              </div>
            </div>

            {/* Right: Technical Scores breakdown */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-lg space-y-6 flex flex-col justify-between">
              <div>
                <h3 className="font-heading font-extrabold text-slate-900 text-base">Điểm số 4 khía cạnh kỹ thuật</h3>
                <p className="text-xs text-slate-400 mt-1 font-semibold">AI phân tích và chấm điểm dựa trên bộ chân di chuyển và vung vợt.</p>
                
                <div className="grid grid-cols-2 gap-4 mt-5">
                  {[
                    { label: "Kỹ thuật", val: scores.technical, desc: "Tư thế vung vợt, tiếp xúc cầu", color: "bg-rose-50 text-rose-700 border-rose-100" },
                    { label: "Di chuyển", val: scores.movement, desc: "Bộ chân linh hoạt, nhịp đỡ bóng", color: "bg-sky-50 text-sky-700 border-sky-100" },
                    { label: "Phản xạ", val: scores.reflection, desc: "Độ nhạy bén khi đối thủ ép bóng", color: "bg-amber-50 text-amber-800 border-amber-100" },
                    { label: "Chiến thuật", val: scores.tactical, desc: "Tầm nhìn chọn điểm rơi dứt điểm", color: "bg-purple-50 text-purple-700 border-purple-100" }
                  ].map(scoreItem => (
                    <div key={scoreItem.label} className={`p-3.5 rounded-2xl border ${scoreItem.color} space-y-1.5`}>
                      <p className="text-[10px] font-bold uppercase tracking-wider">{scoreItem.label}</p>
                      <div className="flex items-baseline justify-between">
                        <span className="text-2xl font-black">{scoreItem.val}</span>
                        <span className="text-[10px] opacity-70">/100</span>
                      </div>
                      <p className="text-[9px] font-medium leading-snug opacity-80">{scoreItem.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Feedback Note */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <span>🤖</span> Nhận xét thông minh từ AI:
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                  Bạn có kỹ thuật phông cầu và bộ chân di chuyển linh hoạt. Tuy nhiên cần chú ý rướn người sớm hơn trong các pha bóng dài ở góc biên. Lối chơi thiên về kiểm soát thế trận của bạn rất thích hợp cho việc ghép đôi!
                </p>
              </div>

              <button
                onClick={saveAssessmentToBackend}
                disabled={isLoading}
                className="w-full flex h-11 items-center justify-center rounded-2xl bg-[#b00c14] hover:bg-[#900a10] text-sm font-bold text-white transition cursor-pointer shadow-md disabled:opacity-50"
              >
                {isLoading ? "Đang đồng bộ kết quả..." : "Xem kết quả xếp hạng ➔"}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* STEP 8: FINAL RESULT ( radar chart, ELO, Badge) */}
      {step === 8 && (
        <div className="max-w-xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full uppercase tracking-wider">Đánh giá hoàn tất</span>
            <h2 className="font-heading text-2xl font-extrabold text-slate-900">Báo cáo năng lực thể thao</h2>
            <p className="text-xs text-slate-500">Mức trình độ và thứ hạng được cập nhật thành công vào thông tin người chơi của bạn.</p>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden grid md:grid-cols-2">
            
            {/* Radial Radar chart SVG Column */}
            <div className="p-6 bg-slate-50/50 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-slate-150">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Biểu đồ kĩ năng radar</p>
              
              <div className="relative w-48 h-48">
                <svg className="w-full h-full" viewBox="0 0 200 200">
                  {/* Grid rings */}
                  {radarGridPaths.map((points, idx) => (
                    <polygon
                      key={idx}
                      points={points}
                      fill="none"
                      stroke="#e2e8f0"
                      strokeWidth="1.2"
                    />
                  ))}
                  
                  {/* Axis lines */}
                  {[-90, -18, 54, 126, 198].map((deg, idx) => {
                    const angle = (deg * Math.PI) / 180;
                    const x = 100 + 80 * Math.cos(angle);
                    const y = 100 + 80 * Math.sin(angle);
                    return (
                      <line
                        key={idx}
                        x1="100"
                        y1="100"
                        x2={x}
                        y2={y}
                        stroke="#e2e8f0"
                        strokeWidth="1.2"
                      />
                    );
                  })}

                  {/* Filled Skill Polygon */}
                  <polygon
                    points={radarPath}
                    fill="rgba(176, 12, 20, 0.22)"
                    stroke="#b00c14"
                    strokeWidth="2.5"
                    className="transition-all duration-300"
                  />

                  {/* Text Labels */}
                  {/* Technical, Movement, Reflection, Tactical, Stamina */}
                  <text x="100" y="10" fill="#64748b" fontSize="8" fontWeight="bold" textAnchor="middle">THỂ LỰC</text>
                  <text x="190" y="93" fill="#64748b" fontSize="8" fontWeight="bold" textAnchor="start">PHẢN XẠ</text>
                  <text x="160" y="190" fill="#64748b" fontSize="8" fontWeight="bold" textAnchor="middle">C.THUẬT</text>
                  <text x="40" y="190" fill="#64748b" fontSize="8" fontWeight="bold" textAnchor="middle">K.THUẬT</text>
                  <text x="10" y="93" fill="#64748b" fontSize="8" fontWeight="bold" textAnchor="end">DI CHUYỂN</text>
                </svg>
              </div>
            </div>

            {/* Overall Tier, ELO & CTA Column */}
            <div className="p-6 flex flex-col justify-between gap-6">
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Trình độ đề xuất</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-3xl">🏆</span>
                    <div>
                      <h3 className="font-heading text-xl font-extrabold text-[#b00c14]">{computedTier}</h3>
                      <p className="text-[10px] text-slate-500 font-bold">Top 38% người chơi tại hệ thống</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Hệ số ELO</p>
                    <p className="text-lg font-black text-slate-800 mt-0.5">{computedElo}</p>
                    <span className="text-[9px] text-emerald-600 font-bold">+50 Elo ban đầu</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Môn thi đấu</p>
                    <p className="text-lg font-black text-slate-800 mt-0.5">{selectedSport}</p>
                    <span className="text-[9px] text-slate-400 font-medium">Standard ELO</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  onClick={startRadarSearching}
                  className="w-full flex h-11 items-center justify-center rounded-2xl bg-[#b00c14] hover:bg-[#900a10] text-sm font-bold text-white transition cursor-pointer shadow-md"
                >
                  Tìm đối thủ phù hợp ➔
                </button>
                <button
                  onClick={() => setStep(2)}
                  className="w-full flex h-11 items-center justify-center rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-sm font-bold text-slate-500 transition cursor-pointer"
                >
                  Đánh giá lại
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* STEP 9: RADAR MATCH SEARCHING (Sweeping animation) */}
      {step === 9 && (
        <Card className="max-w-md mx-auto border border-slate-200/80 shadow-xl rounded-3xl p-8 space-y-8 text-center relative overflow-hidden bg-slate-950 text-white">
          {/* Animated radar grid */}
          <div className="absolute inset-0 opacity-10 bg-[linear-gradient(rgba(18,186,128,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(18,186,128,0.2)_1px,transparent_1px)] bg-[size:20px_20px]" />
          
          <div className="space-y-2 relative z-10">
            <h2 className="font-heading text-xl font-extrabold tracking-tight">Đang quét tìm đối thủ...</h2>
            <p className="text-xs text-slate-400">AI đang quét tìm các phòng ghép và sân bóng trống có ELO tương thích.</p>
          </div>

          {/* Sweeping Radar Graphic */}
          <div className="relative h-44 w-44 mx-auto border border-emerald-500/20 rounded-full flex items-center justify-center">
            {/* Concentric rings */}
            <div className="absolute h-32 w-32 border border-emerald-500/30 rounded-full" />
            <div className="absolute h-20 w-20 border border-emerald-500/40 rounded-full" />
            <div className="absolute h-8 w-8 border border-emerald-500/50 rounded-full" />
            
            {/* Rotating radar sweep line */}
            <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,rgba(16,185,129,0.35)_0deg,transparent_180deg)] animate-spin" style={{ animationDuration: "2.5s" }} />

            {/* Glowing dots appearing randomly */}
            <div className="absolute top-10 left-12 h-2.5 w-2.5 bg-emerald-400 rounded-full shadow-lg shadow-emerald-500/60 animate-ping" />
            <div className="absolute bottom-12 right-10 h-2 w-2 bg-emerald-400 rounded-full shadow-lg shadow-emerald-500/60 animate-ping" style={{ animationDelay: "0.8s" }} />
            <span className="text-xl relative z-10 bg-emerald-950 border border-emerald-500/40 h-10 w-10 rounded-full flex items-center justify-center">N</span>
          </div>

          <div className="text-left max-w-xs mx-auto space-y-2 bg-slate-900/50 p-4 rounded-2xl border border-slate-800 text-xs text-slate-300 relative z-10 font-semibold">
            <div className="flex justify-between">
              <span className="text-slate-400">Mức trình độ ELO:</span>
              <span className="text-emerald-400 font-bold">{computedElo} ({computedTier})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Bộ lọc khu vực:</span>
              <span>Hòa Lạc, Hà Nội</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Môn thể thao:</span>
              <span>{selectedSport}</span>
            </div>
          </div>
        </Card>
      )}

      {/* STEP 10: MATCH SEARCH COMPLETED */}
      {step === 10 && (
        <Card className="max-w-md mx-auto border border-slate-200/80 shadow-xl rounded-3xl p-8 space-y-6 text-center bg-slate-950 text-white">
          <div className="space-y-2">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-950 border border-emerald-500/40 text-emerald-400 text-xl font-bold">✓</div>
            <h2 className="font-heading text-xl font-extrabold">Đã tìm thấy phòng phù hợp!</h2>
            <p className="text-xs text-slate-400">Hệ thống đang chuyển bạn đến danh sách Xếp đối vãng lai để ghép trận đấu phù hợp.</p>
          </div>

          {/* Glowing matching metrics */}
          <div className="p-4 bg-emerald-950/20 border border-emerald-500/20 rounded-2xl flex flex-col gap-1 items-center justify-center">
            <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Kế hoạch thi đấu đề xuất</p>
            <p className="text-lg font-black text-white mt-1">Tìm thấy 12 phòng ghép đối</p>
            <p className="text-xs text-slate-400 font-semibold mt-0.5">Khoảng cách ELO phù hợp từ 1000 - 1300</p>
          </div>

          <p className="text-[11px] text-slate-500 font-semibold animate-pulse">Tự động chuyển hướng sau 2 giây...</p>
        </Card>
      )}
    </div>
  );
}
