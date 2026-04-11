import express, { type Request, type Response } from "express";
import http from "http";
import { Server, type Socket } from "socket.io";

const app = express();
const port = Number(process.env.PORT) || 4000;
const server = http.createServer(app);

type StreamActionPayload = {
  rtmpUrl?: string;
  streamKey?: string;
  scene?: string;
  cameraId?: string;
};

type MobileCameraPayload = {
  cameraId?: string;
  cameraName?: string;
  device: string;
  supportedResolutions: string[];
};

type AudioStatusPayload = {
  source: string;
  levelLeft: number;
  levelRight: number;
  peak: boolean;
  bpm: number;
};

const sampleCameras = [
  { id: "camera-01", name: "Stage Wide Camera", protocol: "RTSP", ipAddress: "192.168.1.101", streamUrl: "rtsp://192.168.1.101/live", status: "online", supportsPTZ: false, signalStrength: "good" },
  { id: "camera-02", name: "Lead Singer Close", protocol: "NDI", ipAddress: "192.168.1.102", streamUrl: "ndi://lead-singer", status: "online", supportsPTZ: true, signalStrength: "good" },
  { id: "camera-phone-1", name: "Phone Camera 1", protocol: "WebRTC", ipAddress: "192.168.1.201", streamUrl: "webrtc://192.168.1.201/offer", status: "online", supportsPTZ: false, isMobile: true, enabled: true, signalStrength: "good" },
];
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.get("/status", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

io.on("connection", (socket: Socket) => {
  console.log(`Socket connected: ${socket.id}`);
  socket.emit("device:update", { status: "ready" });
  socket.emit("camera:list", sampleCameras);

  socket.on("control:scene", (scene: { scene: string; cameraId: string; transition: string }) => {
    socket.broadcast.emit("control:scene", scene);
  });

  socket.on("control:slide", (slideIndex: number) => {
    socket.broadcast.emit("control:slide", slideIndex);
  });

  socket.on("control:song", (songId: string) => {
    socket.broadcast.emit("control:song", songId);
  });

  socket.on("control:camera", (cameraId: string) => {
    socket.broadcast.emit("control:camera", cameraId);
  });

  socket.on("control:camera:transition", (transition: string) => {
    socket.broadcast.emit("control:camera:transition", transition);
  });

  socket.on("mobile-camera:join", (mobileCameraData: MobileCameraPayload) => {
    socket.broadcast.emit("mobile-camera:joined", mobileCameraData);
  });

  socket.on("mobile-camera:offer", (offer: RTCSessionDescriptionInit) => {
    socket.broadcast.emit("mobile-camera:offer", offer);
  });

  socket.on("mobile-camera:answer", (answer: RTCSessionDescriptionInit) => {
    socket.broadcast.emit("mobile-camera:answer", answer);
  });

  socket.on("mobile-camera:candidate", (candidate: RTCIceCandidateInit) => {
    socket.broadcast.emit("mobile-camera:candidate", candidate);
  });

  socket.on("mobile-camera:status", (status: { enabled: boolean; signalStrength: string }) => {
    socket.broadcast.emit("mobile-camera:status", status);
  });

  socket.on("stream:start", (payload: StreamActionPayload) => {
    socket.broadcast.emit("stream:started", payload);
  });

  socket.on("stream:stop", (payload: StreamActionPayload) => {
    socket.broadcast.emit("stream:stopped", payload);
  });

  socket.on("stream:toggleOverlay", (payload: { enabled: boolean }) => {
    socket.broadcast.emit("stream:overlayToggled", payload);
  });

  socket.on("stream:overlayPosition", (payload: Record<string, unknown>) => {
    socket.broadcast.emit("stream:overlayPosition", payload);
  });

  socket.on("camera:add", (camera: Record<string, unknown>) => {
    socket.broadcast.emit("camera:added", camera);
  });

  socket.on("song:import", (songPayload: Record<string, unknown>) => {
    socket.broadcast.emit("song:imported", songPayload);
  });

  socket.on("camera:discover", (discoveryPayload: Record<string, unknown>) => {
    socket.broadcast.emit("camera:discover", discoveryPayload);
  });

  socket.on("teleprompter:request", (payload: Record<string, unknown>) => {
    socket.broadcast.emit("teleprompter:update", payload);
  });

  socket.on("audio:status", (audioStatus: AudioStatusPayload) => {
    socket.broadcast.emit("audio:status", audioStatus);
  });

  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

server.listen(port, () => {
  console.log(`Socket server is running on http://localhost:${port}`);
});
