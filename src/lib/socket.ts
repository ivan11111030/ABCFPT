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

  socket = io(getSocketServerUrl(), {
    // Try WebSocket first, then fall back to polling if WebSocket fails
    transports: ["websocket", "polling"],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    upgrade: true, // Allow upgrade from polling to websocket
    rememberUpgrade: true, // Remember the upgrade for next connection
  });

  return socket;
};
