import express, { type Request, type Response } from "express";
import http from "http";
import { Server, type Socket } from "socket.io";
import { startRtmpStream, stopRtmpStream, getStreamStatus, stopAllStreams, getStreamStats, getActiveStreamsWithStats, ENCODING_PROFILES, type CameraSource } from "./rtmp-encoder";
import { OBSController, type StreamSettings } from "./obs-controller";
import { getCameraById, getAllCameras } from "./camera-sources";

const app = express();
const port = Number(process.env.PORT) || 4000;
const server = http.createServer(app);

// OBS WebSocket Controller
const obsController = new OBSController(
  process.env.OBS_HOST || "localhost",
  Number(process.env.OBS_PORT) || 4444,
  process.env.OBS_PASSWORD || ""
);

// Auto-connect to OBS on startup
(async () => {
  const connected = await obsController.connect();
  if (connected) {
    console.log("[Server] OBS Studio connected");
  } else {
    console.log("[Server] OBS Studio not available (running in native RTMP mode)");
  }
})();

type StreamActionPayload = {
  rtmpUrl?: string;
  streamKey?: string;
  scene?: string;
  cameraId?: string;
  profile?: "high" | "medium" | "low" | "ultra";
  useOBS?: boolean;
};

type MobileCameraPayload = {
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
  res.json({
    status: "ok",
    timestamp: Date.now(),
    obs: {
      connected: obsController.isConnected(),
    },
    streams: getActiveStreamsWithStats(),
    cameras: getAllCameras(),
    encodingProfiles: Object.values(ENCODING_PROFILES),
  });
});

// Endpoint to get camera list
app.get("/cameras", (_req: Request, res: Response) => {
  res.json({ cameras: getAllCameras() });
});

// Endpoint to get stream stats
app.get("/streams", (_req: Request, res: Response) => {
  res.json({ streams: getActiveStreamsWithStats() });
});

io.on("connection", (socket: Socket) => {
  console.log(`Socket connected: ${socket.id}`);
  socket.emit("device:update", { status: "ready" });
  socket.emit("camera:list", sampleCameras);

  socket.on("control:scene", (scene: { scene: string; cameraId: string; transition: string }) => {
    io.emit("control:scene", scene);
  });

  socket.on("control:slide", (slideIndex: number) => {
    io.emit("control:slide", slideIndex);
  });

  socket.on("control:song", (songId: string) => {
    io.emit("control:song", songId);
  });

  socket.on("control:camera", (cameraId: string) => {
    io.emit("control:camera", cameraId);
  });

  socket.on("control:camera:transition", (transition: string) => {
    io.emit("control:camera:transition", transition);
  });

  socket.on("mobile-camera:join", (mobileCameraData: MobileCameraPayload) => {
    io.emit("mobile-camera:joined", mobileCameraData);
  });

  socket.on("mobile-camera:offer", (offer: RTCSessionDescriptionInit) => {
    io.emit("mobile-camera:offer", offer);
  });

  socket.on("mobile-camera:answer", (answer: RTCSessionDescriptionInit) => {
    io.emit("mobile-camera:answer", answer);
  });

  socket.on("mobile-camera:candidate", (candidate: RTCIceCandidateInit) => {
    io.emit("mobile-camera:candidate", candidate);
  });

  socket.on("mobile-camera:status", (status: { enabled: boolean; signalStrength: string }) => {
    io.emit("mobile-camera:status", status);
  });

  socket.on("stream:start", async (payload: StreamActionPayload) => {
    try {
      const streamId = `stream-${socket.id}`;
      
      if (!payload.rtmpUrl || !payload.streamKey) {
        socket.emit("stream:error", { error: "Missing RTMP URL or stream key" });
        return;
      }

      // Try OBS first if available and requested
      if (payload.useOBS && obsController.isConnected()) {
        console.log(`[Stream] Starting OBS stream for ${socket.id}`);
        
        const obsSettings: StreamSettings = {
          server: payload.rtmpUrl,
          key: payload.streamKey,
          bitrate: 5000,
          fps: 30,
        };

        const started = await obsController.startStreaming(obsSettings);
        if (started) {
          io.emit("stream:started", {
            ...payload,
            streamId,
            status: "active",
            method: "OBS",
          });
          return;
        }
      }

      // Fall back to native RTMP encoding
      console.log(`[Stream] Starting native RTMP stream for ${socket.id}`);
      
      const profile = payload.profile ? ENCODING_PROFILES[payload.profile] : ENCODING_PROFILES.medium;
      
      // Get camera source if specified
      let cameraSource: CameraSource | undefined;
      if (payload.cameraId) {
        const camera = getCameraById(payload.cameraId);
        if (camera) {
          cameraSource = {
            id: camera.id,
            url: camera.url,
            protocol: camera.protocol as any,
            username: camera.username,
            password: camera.password,
          };
        }
      }

      await startRtmpStream(streamId, {
        rtmpUrl: payload.rtmpUrl,
        streamKey: payload.streamKey,
        cameraSource,
        profile,
      });

      io.emit("stream:started", {
        ...payload,
        streamId,
        status: "active",
        method: "RTMP-Native",
        profile: profile.name,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[Stream] Failed to start stream:`, errorMessage);
      socket.emit("stream:error", { error: errorMessage });
      io.emit("stream:failed", { payload, error: errorMessage });
    }
  });

  socket.on("stream:stop", (payload: StreamActionPayload) => {
    const streamId = `stream-${socket.id}`;
    
    // Try OBS first
    if (obsController.isConnected()) {
      obsController.stopStreaming().catch((err) => {
        console.error("[Stream] Failed to stop OBS stream:", err);
      });
    }

    // Stop native RTMP
    stopRtmpStream(streamId);
    
    io.emit("stream:stopped", { ...payload, streamId, status: "inactive" });
  });

  socket.on("stream:status", (callback: (status: any) => void) => {
    const streamId = `stream-${socket.id}`;
    const stats = getStreamStats(streamId);
    callback({
      status: getStreamStatus(streamId),
      stats,
      obsConnected: obsController.isConnected(),
    });
  });

  socket.on("stream:toggleOverlay", (payload: { enabled: boolean }) => {
    io.emit("stream:overlayToggled", payload);
  });

  socket.on("camera:add", (camera: Record<string, unknown>) => {
    io.emit("camera:added", camera);
  });

  socket.on("song:import", (songPayload: Record<string, unknown>) => {
    io.emit("song:imported", songPayload);
  });

  socket.on("camera:discover", (discoveryPayload: Record<string, unknown>) => {
    io.emit("camera:discover", discoveryPayload);
  });

  socket.on("teleprompter:request", (payload: Record<string, unknown>) => {
    io.emit("teleprompter:update", payload);
  });

  socket.on("audio:status", (audioStatus: AudioStatusPayload) => {
    io.emit("audio:status", audioStatus);
  });

  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);
    // Stop any active streams for this socket
    const streamId = `stream-${socket.id}`;
    stopRtmpStream(streamId);
  });
});

// Cleanup streams on server shutdown
process.on("SIGTERM", () => {
  console.log("[Server] Received SIGTERM, shutting down gracefully");
  stopAllStreams();
  server.close();
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Socket server is running on port ${port}`);
});
