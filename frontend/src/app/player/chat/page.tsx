"use client";

import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useMemo, useRef, useState } from "react";

import { Badge, Button, ButtonLink, Card, EmptyState, Field, Notice, PageHero, inputClassName } from "@/components/ui";
import { apiFetch, API_BASE_URL } from "@/lib/http";
import { errorMessage, formatFullDateTime } from "@/lib/format";

type ChatRoom = {
  id: string;
  pool_post_id: string;
  session_id: string;
  status: string;
};

type ChatMessage = {
  id: string;
  room_id: string;
  sender_user_id: string;
  sender_full_name: string | null;
  message_type: string;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

function toWebSocketUrl(httpBaseUrl: string): string {
  if (httpBaseUrl.startsWith("https://")) return httpBaseUrl.replace("https://", "wss://");
  if (httpBaseUrl.startsWith("http://")) return httpBaseUrl.replace("http://", "ws://");
  if (typeof window === "undefined") return "";

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}`;
}

function PlayerChatRoomContent() {
  const searchParams = useSearchParams();
  const poolPostId = searchParams.get("poolPostId") ?? "";
  const wsRef = useRef<WebSocket | null>(null);

  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState("Đang chuẩn bị phòng chat pool...");
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);

  const wsUrl = useMemo(() => toWebSocketUrl(API_BASE_URL), []);

  async function bootstrap() {
    if (!poolPostId) {
      setMessage("Hãy mở chat từ một kèo chờ ghép trong trang đặt sân.");
      setRoom(null);
      setMessages([]);
      return;
    }

    setError("");
    try {
      let activeRoom: ChatRoom | null = null;
      try {
        activeRoom = await apiFetch<ChatRoom>(`/api/v1/player/chat/rooms/by-pool/${poolPostId}`, {
          credentials: "include",
        });
      } catch {
        activeRoom = await apiFetch<ChatRoom>("/api/v1/player/chat/rooms", {
          method: "POST",
          credentials: "include",
          body: JSON.stringify({ pool_post_id: poolPostId }),
        });
      }
      setRoom(activeRoom);
      await apiFetch(`/api/v1/player/chat/rooms/${activeRoom.id}/members`, {
        method: "POST",
        credentials: "include",
      });
      const history = await apiFetch<ChatMessage[]>(
        `/api/v1/player/chat/rooms/${activeRoom.id}/messages?limit=100`,
        { credentials: "include" },
      );
      setMessages(history);
      setMessage("Bạn đã vào phòng chat của kèo chờ ghép.");
    } catch (caught) {
      setRoom(null);
      setMessages([]);
      setError(errorMessage(caught, "Không khởi tạo được room chat"));
      setMessage("Không truy cập được room chat.");
    }
  }

  useEffect(() => {
    void bootstrap();
  }, [poolPostId]);

  useEffect(() => {
    if (!room) return;
    const socket = new WebSocket(`${wsUrl}/ws/chat/rooms/${room.id}`);
    wsRef.current = socket;
    socket.onmessage = (event) => {
      const payload = JSON.parse(event.data) as { type: string; message?: ChatMessage };
      const nextMessage = payload.message;
      if (!nextMessage) return;
      setMessages((previous) => [...previous, nextMessage]);
    };
    socket.onerror = () => {
      setError("Kết nối realtime bị lỗi, bạn vẫn có thể gửi tin qua REST.");
    };
    return () => {
      socket.close();
      wsRef.current = null;
    };
  }, [room, wsUrl]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !room) return;
    setIsSending(true);
    setError("");
    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "message", content }));
      } else {
        const posted = await apiFetch<ChatMessage>(`/api/v1/player/chat/rooms/${room.id}/messages`, {
          method: "POST",
          credentials: "include",
          body: JSON.stringify({ content }),
        });
        setMessages((previous) => [...previous, posted]);
      }
      setDraft("");
    } catch (caught) {
      setError(errorMessage(caught, "Không gửi được tin nhắn"));
    } finally {
      setIsSending(false);
    }
  }

  if (!poolPostId) {
    return (
      <EmptyState
        title="Chưa chọn kèo chờ ghép"
        description="Vào trang đặt sân và bấm Chat nhóm trên một kèo pool để mở phòng chat."
        action={<ButtonLink href="/player/discovery/?mode=matchmaking">Tìm kèo chờ ghép</ButtonLink>}
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Chat nhóm"
        title="Trao đổi nhanh với người cùng kèo."
        description={message}
        actions={
          <>
            <ButtonLink href="/player/discovery/?mode=matchmaking" variant="outline">
              Về đặt sân
            </ButtonLink>
            <ButtonLink href="/player/bookings" variant="outline">
              Booking của tôi
            </ButtonLink>
          </>
        }
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-xl font-semibold text-ink">Phòng chat pool</h2>
            <p className="mt-1 text-sm text-slate-600">Pool: {poolPostId}</p>
          </div>
          <Badge tone={room?.status === "active" ? "success" : "neutral"}>
            {room ? room.status : "đang kết nối"}
          </Badge>
        </div>

        <div className="h-[460px] overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-4">
          {messages.length === 0 ? (
            <p className="text-sm text-slate-600">Chưa có tin nhắn. Hãy bắt đầu trao đổi với nhóm.</p>
          ) : (
            <div className="grid gap-3">
              {messages.map((item) => (
                <article key={item.id} className="max-w-[85%] rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {item.sender_full_name || item.sender_user_id}
                    </p>
                    <Badge>{item.message_type}</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{item.content}</p>
                  <p className="mt-2 text-xs text-slate-500">{formatFullDateTime(item.created_at)}</p>
                </article>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={sendMessage} className="flex flex-col gap-3 sm:flex-row">
          <Field label="Tin nhắn" className="flex-1">
            <input
              className={inputClassName}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Nhập nội dung trao đổi..."
            />
          </Field>
          <div className="flex items-end">
            <Button disabled={isSending || !room}>{isSending ? "Đang gửi..." : "Gửi"}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export default function PlayerChatRoomPage() {
  return (
    <Suspense fallback={<EmptyState title="Đang mở chat" description="NetUp đang kết nối phòng chat pool." />}>
      <PlayerChatRoomContent />
    </Suspense>
  );
}
