import { io, Socket } from "socket.io-client";
import { getSocketServerUrl } from "@/src/lib/realtimeConfig";

let socket: Socket | null = null;

export const createSocketClient = (): Socket => {
  if (socket) {
    return socket;
  }

  if (typeof window === "undefined") {
    // Return a stub during SSR to avoid connection attempts
    return {
      on: () => {},
      off: () => {},
      emit: () => {},
      connect: () => {},
      disconnect: () => {},
      connected: false,
    } as unknown as Socket;
  }

  const serverUrl = getSocketServerUrl();
  console.log("[Socket] Connecting to:", serverUrl);

  socket = io(serverUrl, {
    // Keep the control connection on polling. Render's proxy can accept the
    // initial handshake but intermittently fails the WebSocket upgrade, which
    // makes the live button report a connection error even though the server
    // is healthy. Stream chunks are small enough for Socket.IO polling.
    transports: ["polling"],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    withCredentials: false,
    upgrade: false,
    rememberUpgrade: false,
  });

  const client = socket;

  // Add connection logging
  client.on("connect", () => {
    console.log("[Socket] Connected successfully, ID:", client.id);
  });

  socket.on("connect_error", (error: Error) => {
    console.error("[Socket] Connection error:", error.message);
  });

  socket.on("disconnect", (reason: string) => {
    console.log("[Socket] Disconnected:", reason);
  });

  socket.on("error", (error: unknown) => {
    console.error("[Socket] Error:", error);
  });

  return socket;
};
