import { io, Socket } from "socket.io-client";

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

  socket = io(process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || "http://localhost:4000", {
    transports: ["websocket"],
    autoConnect: true,
  });

  return socket;
};
