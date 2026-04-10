import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const createSocketClient = () => {
  if (socket) {
    return socket;
  }

  socket = io(process.env.SOCKET_SERVER_URL || "http://localhost:4000", {
    transports: ["websocket"],
    autoConnect: true,
  });

  return socket;
};
