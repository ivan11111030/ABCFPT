import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const createSocketClient = () => {
  if (socket) {
    return socket;
  }

  const socketUrl = typeof window !== "undefined" 
    ? (window as any).NEXT_PUBLIC_SOCKET_SERVER_URL || "http://localhost:4000"
    : "http://localhost:4000";

  socket = io(socketUrl, {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
    autoConnect: true,
  });

  return socket;
};
