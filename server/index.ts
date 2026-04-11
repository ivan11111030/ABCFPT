import express, { type Request, type Response } from "express";
import http from "http";
import { Server, type Socket } from "socket.io";

const app = express();
const port = Number(process.env.PORT) || 4000;
const publicHost = process.env.PUBLIC_HOST || `http://localhost:${port}`;
const corsOrigins = (process.env.CLIENT_ORIGIN || "*")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const server = http.createServer(app);

/* ── Types ──────────────────────────────────────────── */
type SceneMode = "worship" | "speaker" | "announcement" | "lyrics";
type CameraTransition = "cut" | "fade" | "cross-dissolve";
type OverlayPosition = { x: number; y: number; width: number };

type Slide = { id: string; section: string; text: string; background?: string };
type Song = {
  id: string; title: string; artist: string; key: string;
  tempo: number; currentSection: string; slides: Slide[]; favorite: boolean;
};
type Camera = {
  id: string; name: string; protocol: string; ipAddress: string;
  streamUrl: string; status: string; supportsPTZ: boolean;
  enabled?: boolean; isMobile?: boolean; signalStrength?: string; presetList?: string[];
};

/* ── Shared in-memory state ─────────────────────────── */
const state = {
  songs: [
    {
      id: "song-001", title: "Abide in the Light", artist: "ABCF Worship",
      key: "C", tempo: 78, currentSection: "Verse 1", favorite: true,
      slides: [
        { id: "slide-001", section: "Verse 1", text: "Abide in the light, we will sing tonight." },
        { id: "slide-002", section: "Chorus", text: "Let every heart proclaim Your name." },
        { id: "slide-003", section: "Bridge", text: "Spirit move and stir our praise." },
      ],
    },
    {
      id: "song-002", title: "Grace Like Rain", artist: "ABCF Worship",
      key: "G", tempo: 92, currentSection: "Chorus", favorite: false,
      slides: [
        { id: "slide-004", section: "Verse 1", text: "Falling like rain, Your love comes down." },
        { id: "slide-005", section: "Chorus", text: "Grace like rain, Holy Fire." },
        { id: "slide-006", section: "Tag", text: "We stand in awe of who You are." },
      ],
    },
  ] as Song[],
  currentSongId: "song-001",
  currentSlide: 0,
  currentScene: "worship" as SceneMode,
  cameras: [
    { id: "camera-01", name: "Stage Wide Camera", protocol: "RTSP", ipAddress: "192.168.1.101", streamUrl: "rtsp://192.168.1.101/live", status: "online", supportsPTZ: false, signalStrength: "good" },
    { id: "camera-02", name: "Lead Singer Close", protocol: "NDI", ipAddress: "192.168.1.102", streamUrl: "ndi://lead-singer", status: "online", supportsPTZ: true, signalStrength: "good" },
  ] as Camera[],
  activeCameraId: "camera-01",
  cameraTransition: "cut" as CameraTransition,
  isLive: false,
  overlayEnabled: true,
  overlayPosition: { x: 0, y: 75, width: 100 } as OverlayPosition,
  standby: false,
  background: { type: "color" as "color" | "image", value: "#000000" },
};

/* ── Socket.io ──────────────────────────────────────── */
const io = new Server(server, {
  cors: {
    origin: corsOrigins.length === 1 && corsOrigins[0] === "*" ? "*" : corsOrigins,
    methods: ["GET", "POST"],
  },
});

app.get("/", (_req: Request, res: Response) => {
  res.json({ service: "abcfpt-socket", status: "ok", timestamp: Date.now() });
});

app.get("/status", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

io.on("connection", (socket: Socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Push full current state to newly connected client
  socket.emit("state:sync", state);

  /* ── Control events (io.emit so ALL clients sync) ── */
  socket.on("control:slide", (slideIndex: number) => {
    state.currentSlide = slideIndex;
    io.emit("control:slide", slideIndex);
  });

  socket.on("control:song", (songId: string) => {
    state.currentSongId = songId;
    state.currentSlide = 0;
    io.emit("control:song", songId);
    io.emit("control:slide", 0);
  });

  socket.on("control:scene", (payload: { scene: string; cameraId: string; transition: string } | string) => {
    const scene = (typeof payload === "string" ? payload : payload.scene) as SceneMode;
    state.currentScene = scene;
    io.emit("control:scene", typeof payload === "string" ? { scene } : payload);
  });

  socket.on("control:camera", (cameraId: string) => {
    state.activeCameraId = cameraId;
    io.emit("control:camera", cameraId);
  });

  socket.on("control:camera:transition", (transition: string) => {
    state.cameraTransition = transition as CameraTransition;
    io.emit("control:camera:transition", transition);
  });

  /* ── Song CRUD ───────────────────────────────────── */
  socket.on("song:add", (song: Song) => {
    state.songs.push(song);
    io.emit("song:list", state.songs);
  });

  socket.on("song:update", (song: Song) => {
    const idx = state.songs.findIndex((s) => s.id === song.id);
    if (idx >= 0) state.songs[idx] = song;
    io.emit("song:list", state.songs);
  });

  socket.on("song:delete", (songId: string) => {
    state.songs = state.songs.filter((s) => s.id !== songId);
    if (state.currentSongId === songId && state.songs.length > 0) {
      state.currentSongId = state.songs[0].id;
      state.currentSlide = 0;
      io.emit("control:song", state.currentSongId);
      io.emit("control:slide", 0);
    }
    io.emit("song:list", state.songs);
  });

  socket.on("song:import", (songs: Song[]) => {
    for (const song of songs) {
      if (!state.songs.some((s) => s.id === song.id)) {
        state.songs.push(song);
      }
    }
    io.emit("song:list", state.songs);
  });

  socket.on("song:reorder", (songIds: string[]) => {
    const reordered: Song[] = [];
    for (const id of songIds) {
      const song = state.songs.find((s) => s.id === id);
      if (song) reordered.push(song);
    }
    for (const song of state.songs) {
      if (!reordered.some((s) => s.id === song.id)) reordered.push(song);
    }
    state.songs = reordered;
    io.emit("song:list", state.songs);
  });

  /* ── Camera events ───────────────────────────────── */
  socket.on("camera:add", (camera: Camera) => {
    if (!state.cameras.some((c) => c.id === camera.id)) {
      state.cameras.push({ ...camera, status: "online" });
    } else {
      const idx = state.cameras.findIndex((c) => c.id === camera.id);
      if (idx >= 0) state.cameras[idx] = { ...state.cameras[idx], ...camera, status: "online" };
    }
    io.emit("camera:list", state.cameras);
  });

  socket.on("camera:remove", (cameraId: string) => {
    state.cameras = state.cameras.filter((c) => c.id !== cameraId);
    io.emit("camera:list", state.cameras);
  });

  /* ── Mobile camera signaling ─────────────────────── */
  socket.on("mobile-camera:join", (data: { cameraId?: string; cameraName?: string; device?: string }) => {
    const cam: Camera = {
      id: data.cameraId || `mobile-${Date.now()}`,
      name: data.cameraName || "Mobile Camera",
      protocol: "WebRTC",
      ipAddress: "",
      streamUrl: "webrtc://mobile",
      status: "online",
      supportsPTZ: false,
      isMobile: true,
      enabled: true,
      signalStrength: "good",
    };
    if (!state.cameras.some((c) => c.id === cam.id)) {
      state.cameras.push(cam);
    } else {
      const idx = state.cameras.findIndex((c) => c.id === cam.id);
      if (idx >= 0) state.cameras[idx] = { ...state.cameras[idx], status: "online" };
    }
    io.emit("camera:list", state.cameras);
    socket.broadcast.emit("mobile-camera:joined", data);
  });

  socket.on("mobile-camera:offer", (payload: Record<string, unknown>) => {
    socket.broadcast.emit("mobile-camera:offer", payload);
  });

  socket.on("mobile-camera:answer", (payload: Record<string, unknown>) => {
    socket.broadcast.emit("mobile-camera:answer", payload);
  });

  socket.on("mobile-camera:candidate", (payload: Record<string, unknown>) => {
    socket.broadcast.emit("mobile-camera:candidate", payload);
  });

  socket.on("mobile-camera:status", (status: Record<string, unknown>) => {
    socket.broadcast.emit("mobile-camera:status", status);
  });

  /* ── Stream events ───────────────────────────────── */
  socket.on("stream:start", (payload: { rtmpUrl?: string; streamKey?: string; scene?: string; cameraId?: string }) => {
    if (!payload.rtmpUrl || !payload.streamKey) {
      socket.emit("stream:error", { message: "RTMP URL and Stream Key are required." });
      return;
    }
    state.isLive = true;
    const fullUrl = `${payload.rtmpUrl}${payload.streamKey}`;
    console.log(`[Stream] RTMP target: ${fullUrl}`);
    io.emit("stream:started", { ...payload, status: "live" });
  });

  socket.on("stream:stop", () => {
    state.isLive = false;
    console.log("[Stream] Stream stopped");
    io.emit("stream:stopped", { status: "stopped" });
  });

  socket.on("stream:toggleOverlay", (payload: { enabled: boolean }) => {
    state.overlayEnabled = payload.enabled;
    io.emit("stream:overlayToggled", payload);
  });

  socket.on("stream:overlayPosition", (pos: OverlayPosition) => {
    state.overlayPosition = pos;
    io.emit("stream:overlayPosition", pos);
  });

  /* ── Standby & Background ────────────────────────── */
  socket.on("control:standby", (enabled: boolean) => {
    state.standby = enabled;
    io.emit("control:standby", enabled);
  });

  socket.on("control:background", (bg: { type: string; value: string }) => {
    state.background = bg as typeof state.background;
    io.emit("control:background", bg);
  });

  /* ── Discovery ───────────────────────────────────── */
  socket.on("camera:discover", (payload: Record<string, unknown>) => {
    socket.broadcast.emit("camera:discover", payload);
  });

  /* ── Audio ───────────────────────────────────────── */
  socket.on("audio:status", (audioStatus: Record<string, unknown>) => {
    io.emit("audio:status", audioStatus);
  });

  /* ── Teleprompter state request ──────────────────── */
  socket.on("teleprompter:request", () => {
    socket.emit("state:sync", state);
  });

  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

server.listen(port, () => {
  console.log(`Socket server is running on ${publicHost}`);
  console.log(`Socket CORS origin(s): ${corsOrigins.join(", ")}`);
});
