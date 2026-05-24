"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

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
  return httpBaseUrl.replace("http://", "ws://");
}

export default function PlayerChatRoomPage() {
  const params = useParams<{ poolPostId: string }>();
  const poolPostId = params?.poolPostId ?? "";
  const wsRef = useRef<WebSocket | null>(null);

  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState("Đang khởi tạo room chat...");
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);

  async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
    const payload = response.status === 204 ? null : await response.json();
    if (!response.ok) {
      const detail = payload?.error?.details?.[0];
      throw new Error(detail?.field ? `${detail.field}: ${detail.message}` : payload?.error?.message);
    }
    return payload as T;
  }

  const wsUrl = useMemo(() => toWebSocketUrl(apiBaseUrl), []);

  async function bootstrap() {
    setError("");
    try {
      let activeRoom: ChatRoom | null = null;
      try {
        activeRoom = await apiFetch<ChatRoom>(`/api/v1/player/chat/rooms/by-pool/${poolPostId}`);
      } catch {
        activeRoom = await apiFetch<ChatRoom>("/api/v1/player/chat/rooms", {
          method: "POST",
          body: JSON.stringify({ pool_post_id: poolPostId }),
        });
      }
      setRoom(activeRoom);
      await apiFetch(`/api/v1/player/chat/rooms/${activeRoom.id}/members`, { method: "POST" });
      const history = await apiFetch<ChatMessage[]>(
        `/api/v1/player/chat/rooms/${activeRoom.id}/messages?limit=100`
      );
      setMessages(history);
      setMessage("Đã kết nối room chat.");
    } catch (caught) {
      setRoom(null);
      setMessages([]);
      setError(caught instanceof Error ? caught.message : "Không khởi tạo được room chat");
      setMessage("Không truy cập được room chat");
    }
  }

  useEffect(() => {
    if (!poolPostId) return;
    bootstrap();
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
      setError("Kết nối realtime bị lỗi, bạn vẫn có thể gửi qua REST.");
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
          body: JSON.stringify({ content }),
        });
        setMessages((previous) => [...previous, posted]);
      }
      setDraft("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không gửi được tin nhắn");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-slate-950">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">
              NetUp Pool Chat
            </p>
            <h1 className="mt-2 text-3xl font-semibold">Chat nhóm pool</h1>
            <p className="mt-2 text-sm text-slate-600">{message}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              href="/player/discovery"
            >
              Discovery
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

      {error ? (
        <section className="mx-auto max-w-5xl px-6 pt-6 lg:px-8">
          <p className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        </section>
      ) : null}

      <section className="mx-auto max-w-5xl px-6 py-6 lg:px-8">
        <div className="rounded border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-600">Pool Post: {poolPostId}</p>
          <p className="mt-1 text-sm text-slate-600">
            Room: {room?.id ?? "chưa sẵn sàng"} · Trạng thái: {room?.status ?? "-"}
          </p>
          <div className="mt-4 h-[420px] overflow-y-auto rounded border border-slate-200 bg-slate-50 p-3">
            {messages.length === 0 ? (
              <p className="text-sm text-slate-600">Chưa có tin nhắn.</p>
            ) : (
              <div className="grid gap-2">
                {messages.map((item) => (
                  <article key={item.id} className="rounded border border-slate-200 bg-white p-3">
                    <p className="text-xs uppercase text-slate-500">{item.message_type}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">
                      {item.sender_full_name || item.sender_user_id}
                    </p>
                    <p className="mt-1 text-sm text-slate-700">{item.content}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {new Date(item.created_at).toLocaleString("vi-VN")}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </div>
          <form onSubmit={sendMessage} className="mt-4 flex gap-2">
            <input
              className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Nhập tin nhắn..."
            />
            <button
              className="rounded bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-400"
              disabled={isSending || !room}
            >
              {isSending ? "Đang gửi..." : "Gửi"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
