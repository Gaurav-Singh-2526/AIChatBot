import { io, type Socket } from "socket.io-client";
import { getStoredToken, streamMessage } from "./api";
import type { StreamEvent } from "./types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

let socketInstance: Socket | null = null;
let socketToken: string | null = null;

export function getSocket(): Socket | null {
  if (typeof window === "undefined") return null;
  const token = getStoredToken();
  if (!token) {
    disconnectSocket();
    return null;
  }

  if (socketInstance && socketToken === token) {
    return socketInstance;
  }

  disconnectSocket();
  socketToken = token;
  socketInstance = io(API_BASE, {
    auth: { token },
    transports: ["websocket", "polling"],
    autoConnect: true
  });

  return socketInstance;
}

export function disconnectSocket(): void {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
  socketToken = null;
}

/**
 * Streams a chat message over authenticated Socket.IO when connected,
 * with automatic fallback to HTTP NDJSON streaming if socket is offline.
 */
export async function streamMessageWithSocket({
  chatId,
  content,
  signal,
  onEvent
}: {
  chatId: string;
  content: string;
  signal: AbortSignal;
  onEvent: (event: StreamEvent) => void;
}): Promise<void> {
  const socket = getSocket();

  if (!socket || !socket.connected) {
    return streamMessage({ chatId, content, signal, onEvent });
  }

  const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      socket.off("chat:start", handleStart);
      socket.off("chat:chunk", handleChunk);
      socket.off("chat:done", handleDone);
      socket.off("chat:error", handleError);
      signal.removeEventListener("abort", handleAbort);
    };

    const handleAbort = () => {
      socket.emit("chat:stop", { requestId });
      cleanup();
      const abortErr = new Error("Aborted");
      abortErr.name = "AbortError";
      reject(abortErr);
    };

    const handleStart = (payload: StreamEvent & { requestId?: string }) => {
      if (payload.requestId !== requestId) return;
      onEvent({ ...payload, type: "start" });
    };

    const handleChunk = (payload: StreamEvent & { requestId?: string }) => {
      if (payload.requestId !== requestId) return;
      onEvent({ ...payload, type: "chunk" });
    };

    const handleDone = (payload: StreamEvent & { requestId?: string }) => {
      if (payload.requestId !== requestId) return;
      cleanup();
      onEvent({ ...payload, type: "done" });
      resolve();
    };

    const handleError = (payload: { requestId?: string; message?: string }) => {
      if (payload.requestId && payload.requestId !== requestId) return;
      cleanup();
      reject(new Error(payload.message || "Socket streaming failed"));
    };

    if (signal.aborted) {
      handleAbort();
      return;
    }

    signal.addEventListener("abort", handleAbort, { once: true });
    socket.on("chat:start", handleStart);
    socket.on("chat:chunk", handleChunk);
    socket.on("chat:done", handleDone);
    socket.on("chat:error", handleError);

    socket.emit("chat:send", { requestId, chatId, content });
  });
}
