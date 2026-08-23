import express, { type Request, type Response } from "express";
import http from "http";
import fs from "fs";
import path from "path";
import { spawn, type ChildProcess } from "child_process";
import { Server, type Socket } from "socket.io";
import ffmpegStatic from "ffmpeg-static";
import { isAuthEnforced, authInitError, verifyIdToken } from "./auth";

// ffmpeg-static downloads a prebuilt ffmpeg binary into node_modules during
// `npm install` — no system package manager / root access required. This is
// necessary on hosts like Render whose build filesystem doesn't allow
// `apt-get install ffmpeg`. Falls back to the "ffmpeg" on PATH (e.g. for
// local dev where it's installed via Homebrew/apt) if the static binary
// couldn't be resolved for some reason.
const FFMPEG_PATH = ffmpegStatic || "ffmpeg";

const app = express();
const port = Number(process.env.PORT) || 4000;
const publicHost = process.env.PUBLIC_HOST || `http://localhost:${port}`;
const corsOrigins = (process.env.CLIENT_ORIGIN || "*")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const server = http.createServer(app);
const socketCameraMap = new Map<string, string>();

/* ── Types ──────────────────────────────────────────── */
type SceneMode = "worship" | "speaker" | "announcement" | "lyrics";
type CameraTransition = "cut" | "fade" | "cross-dissolve";
type OverlayPosition = { x: number; y: number; width: number };

type Slide = { id: string; section: string; text: string; notes?: string; background?: string };
type Song = {
  id: string; title: string; artist: string; key: string;
  tempo: number; currentSection: string; slides: Slide[]; favorite: boolean;
  updatedAt?: number;
};
type Camera = {
  id: string; name: string; protocol: string; ipAddress: string;
  streamUrl: string; status: string; supportsPTZ: boolean;
  enabled?: boolean; isMobile?: boolean; signalStrength?: string; presetList?: string[];
};

/* ── Lightweight payload validation ─────────────────────
 * Not a full schema validator (no new dependency for this) — just enough to
 * reject obviously-malformed payloads before they get persisted to disk or
 * broadcast to every connected client, instead of trusting client input
 * shapes implicitly. */
function isValidSong(value: unknown): value is Song {
  if (!value || typeof value !== "object") return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.id === "string" && s.id.length > 0 &&
    typeof s.title === "string" &&
    typeof s.artist === "string" &&
    typeof s.key === "string" &&
    typeof s.tempo === "number" &&
    typeof s.currentSection === "string" &&
    typeof s.favorite === "boolean" &&
    Array.isArray(s.slides)
  );
}

function isValidCamera(value: unknown): value is Camera {
  if (!value || typeof value !== "object") return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.id === "string" && c.id.length > 0 &&
    typeof c.name === "string" &&
    typeof c.protocol === "string" &&
    typeof c.streamUrl === "string" &&
    typeof c.status === "string" &&
    typeof c.supportsPTZ === "boolean"
  );
}

const CAMERA_TRANSITIONS = new Set(["cut", "fade", "cross-dissolve"]);
const BACKGROUND_TYPES = new Set(["color", "image", "animated"]);

/* ── Shared in-memory state ─────────────────────────── */

/* ── Persistent song file on disk ───────────────────── */
const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);
const CLOUD_SONGS_PATH = path.join(__dirname, "cloud_songs.json");
const STATE_SNAPSHOT_PATH = path.join(__dirname, "state_snapshot.json");

type CloudData = {
  songs: Song[];
  uploadedAt: number;
};

function loadCloudSongs(): CloudData {
  try {
    if (fs.existsSync(CLOUD_SONGS_PATH)) {
      const raw = fs.readFileSync(CLOUD_SONGS_PATH, "utf-8");
      const parsed = JSON.parse(raw) as CloudData;
      if (Array.isArray(parsed.songs)) return parsed;
    }
  } catch (err) {
    console.error("[Cloud] Failed to read cloud_songs.json:", err);
  }
  return { songs: [], uploadedAt: 0 };
}

function saveCloudSongs(data: CloudData) {
  try {
    fs.writeFileSync(CLOUD_SONGS_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("[Cloud] Failed to write cloud_songs.json:", err);
  }
}

// Initialize songs from cloud file if it exists, otherwise start with an empty song set
const initialCloudData = loadCloudSongs();
const initialSongs = initialCloudData.songs.length > 0 ? initialCloudData.songs : [];

const state = {
  songs: initialSongs as Song[],
  currentSongId: initialSongs[0]?.id || "",
  currentSlide: 0,
  currentScene: "worship" as SceneMode,
  cameras: [] as Camera[],
  activeCameraId: "",
  cameraTransition: "cut" as CameraTransition,
  isLive: false,
  overlayEnabled: true,
  overlayPosition: { x: 0, y: 75, width: 100 } as OverlayPosition,
  teleprompterFontSize: 42,
  projectorFontSize: 42,
  standby: false,
  background: { type: "color" as "color" | "image", value: "#000000" },
  sceneType: "worship" as string,
  sceneConfig: null as any,
};

/**
 * Fields worth surviving a server restart (Render redeploys, free-tier
 * spin-down/up, crashes). Deliberately excludes:
 *  - `songs` — persisted separately via cloud_songs.json
 *  - `isLive` — should never come back "live" automatically after a
 *    restart; the ffmpeg process is gone regardless, so this would just be
 *    a UI lie until someone notices and manually restarts the stream.
 *
 * Note: on hosts without a persistent disk (e.g. Render's free plan without
 * a paid Disk attached), this file itself won't survive a redeploy either —
 * it still helps with in-process restarts/crashes, and with any host that
 * does keep local disk between runs.
 */
const PERSISTED_STATE_KEYS = [
  "currentSongId", "currentSlide", "currentScene", "cameras", "activeCameraId",
  "cameraTransition", "overlayEnabled", "overlayPosition", "teleprompterFontSize",
  "projectorFontSize", "standby", "background", "sceneType", "sceneConfig",
] as const satisfies readonly (keyof typeof state)[];

function loadStateSnapshot(): void {
  try {
    if (!fs.existsSync(STATE_SNAPSHOT_PATH)) return;
    const raw = fs.readFileSync(STATE_SNAPSHOT_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<typeof state>;
    for (const key of PERSISTED_STATE_KEYS) {
      if (parsed[key] !== undefined) {
        (state as any)[key] = parsed[key];
      }
    }
    console.log("[State] Restored snapshot from previous run.");
  } catch (err) {
    console.error("[State] Failed to load state_snapshot.json:", err);
  }
}

let stateSaveTimer: ReturnType<typeof setTimeout> | null = null;
function persistState(): void {
  // Debounced so rapid-fire updates (e.g. dragging an overlay slider) don't
  // hammer the disk with a write per event.
  if (stateSaveTimer) clearTimeout(stateSaveTimer);
  stateSaveTimer = setTimeout(() => {
    try {
      const snapshot: Record<string, unknown> = {};
      for (const key of PERSISTED_STATE_KEYS) snapshot[key] = state[key];
      fs.writeFileSync(STATE_SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2), "utf-8");
    } catch (err) {
      console.error("[State] Failed to write state_snapshot.json:", err);
    }
  }, 1000);
}

loadStateSnapshot();

/* ── FFmpeg RTMP streaming ──────────────────────────── */
let ffmpegProcess: ChildProcess | null = null;
let streamTargetUrl: string = "";

type EncodingProfileName = "low" | "medium" | "high" | "ultra";
const ENCODING_PROFILES: Record<EncodingProfileName, { videoBitrate: string; bufsize: string; audioBitrate: string; fps: string }> = {
  low: { videoBitrate: "1000k", bufsize: "2000k", audioBitrate: "96k", fps: "24" },
  medium: { videoBitrate: "2500k", bufsize: "5000k", audioBitrate: "128k", fps: "30" },
  high: { videoBitrate: "4500k", bufsize: "9000k", audioBitrate: "160k", fps: "30" },
  ultra: { videoBitrate: "8000k", bufsize: "16000k", audioBitrate: "192k", fps: "60" },
};
const DEFAULT_ENCODING_PROFILE: EncodingProfileName = (process.env.DEFAULT_ENCODING_PROFILE as EncodingProfileName) in ENCODING_PROFILES
  ? (process.env.DEFAULT_ENCODING_PROFILE as EncodingProfileName)
  : "medium";

function stopFfmpeg() {
  if (ffmpegProcess) {
    try {
      ffmpegProcess.stdin?.end();
      ffmpegProcess.kill("SIGTERM");
    } catch { /* already dead */ }
    ffmpegProcess = null;
  }
  streamTargetUrl = "";
}

function startFfmpeg(rtmpUrl: string, streamKey: string, profileName: EncodingProfileName = DEFAULT_ENCODING_PROFILE): { ok: boolean; error?: string } {
  stopFfmpeg(); // clean up previous

  const profile = ENCODING_PROFILES[profileName] ?? ENCODING_PROFILES[DEFAULT_ENCODING_PROFILE];

  const normalizedRtmpUrl = rtmpUrl.trim();
  const normalizedStreamKey = streamKey.trim().replace(/^\/+/, "");
  const finalRtmpUrl = normalizedRtmpUrl.endsWith("/") ? normalizedRtmpUrl : `${normalizedRtmpUrl}/`;
  const fullUrl = `${finalRtmpUrl}${normalizedStreamKey}`;
  streamTargetUrl = fullUrl;

  // Validate URL format
  if (!fullUrl.startsWith("rtmp://") && !fullUrl.startsWith("rtmps://")) {
    return { ok: false, error: "Invalid RTMP URL — must start with rtmp:// or rtmps://" };
  }

  try {
    const args = [
      "-f", "webm",           // input format from MediaRecorder
      "-i", "pipe:0",         // read from stdin
      // Video encoding
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-tune", "zerolatency",
      "-b:v", profile.videoBitrate,
      "-maxrate", profile.videoBitrate,
      "-bufsize", profile.bufsize,
      "-pix_fmt", "yuv420p",
      "-g", String(Number(profile.fps) * 2), // keyframe every 2s
      "-r", profile.fps,
      // Audio encoding
      "-c:a", "aac",
      "-b:a", profile.audioBitrate,
      "-ar", "44100",
      // Output
      "-f", "flv",
      "-flvflags", "no_duration_filesize",
      fullUrl,
    ];

    ffmpegProcess = spawn(FFMPEG_PATH, args, { stdio: ["pipe", "pipe", "pipe"] });

    ffmpegProcess.stderr?.on("data", (data: Buffer) => {
      const msg = data.toString();
      // Only log meaningful lines (skip progress spam)
      if (msg.includes("Error") || msg.includes("error") || msg.includes("failed") || msg.includes("Opening") || msg.includes("Output")) {
        console.log(`[FFmpeg] ${msg.trim()}`);
      }
    });

    ffmpegProcess.on("error", (err) => {
      console.error("[FFmpeg] Process error:", err.message);
      state.isLive = false;
      io.emit("stream:error", { message: `FFmpeg error: ${err.message}` });
      io.emit("stream:stopped", { status: "stopped" });
      ffmpegProcess = null;
    });

    ffmpegProcess.on("close", (code) => {
      console.log(`[FFmpeg] Process exited with code ${code}`);
      if (state.isLive) {
        state.isLive = false;
        if (code !== 0) {
          io.emit("stream:error", { message: `Stream ended unexpectedly (code ${code})` });
        }
        io.emit("stream:stopped", { status: "stopped" });
      }
      ffmpegProcess = null;
    });

    console.log(`[FFmpeg] Started → ${fullUrl}`);
    return { ok: true };
  } catch (err: any) {
    console.error("[FFmpeg] Failed to spawn:", err);
    return { ok: false, error: err.message || "Failed to start ffmpeg" };
  }
}

/* ── Socket.io ──────────────────────────────────────── */
const io = new Server(server, {
  cors: {
    origin: corsOrigins.length === 1 && corsOrigins[0] === "*" ? "*" : corsOrigins,
    methods: ["GET", "POST"],
    credentials: corsOrigins.length === 1 && corsOrigins[0] === "*" ? false : true,
  },
  pingInterval: 25000,
  pingTimeout: 60000,
  transports: ["websocket", "polling"], // Support both transports
  maxHttpBufferSize: 5e6, // 5MB for video chunks
  allowUpgrades: true, // Allow transport upgrade from polling to websocket
});

/**
 * Verify the operator's Firebase ID token (sent by the control page as
 * `socket.auth.token`) on every connection attempt, and mark the socket
 * accordingly. Individual "privileged" event handlers below check
 * `socket.data.authenticated` and reject the action if it's false.
 *
 * Cameras, the projector, and the teleprompter connect without a token by
 * design (they're not signed in) — only the small set of operator-only
 * events (control:*, song:*, stream:start/stop, etc.) are gated.
 */
io.use(async (socket, next) => {
  if (!isAuthEnforced()) {
    // FIREBASE_SERVICE_ACCOUNT_KEY isn't configured — fall back to the
    // previous (unauthenticated) behavior rather than locking everyone out.
    socket.data.authenticated = true;
    return next();
  }

  const token = (socket.handshake.auth as { token?: string } | undefined)?.token;
  const uid = await verifyIdToken(token);
  socket.data.authenticated = uid !== null;
  socket.data.uid = uid;
  next();
});

app.use((req: Request, res: Response, next) => {
  const requestOrigin = req.headers.origin;
  const allowAllOrigins = corsOrigins.length === 1 && corsOrigins[0] === "*";

  if (allowAllOrigins) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else if (requestOrigin && corsOrigins.includes(requestOrigin)) {
    // Reflect allowed origins so browser preflight succeeds for configured clients.
    res.setHeader("Access-Control-Allow-Origin", requestOrigin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  next();
});

app.use(express.json({ limit: "5mb" }));

app.get("/", (_req: Request, res: Response) => {
  res.json({ service: "abcfpt-socket", status: "ok", timestamp: Date.now() });
});

app.get("/status", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

/* ── Cloud song sync REST API ───────────────────────── */

/**
 * POST /api/songs/upload
 * Body: { songs: Song[], uploadedAt: number }
 *
 * Replaces the cloud setlist with the uploaded version.
 * Also updates the in-memory state so all connected clients sync.
 */
app.post("/api/songs/upload", (req: Request, res: Response) => {
  try {
    const body = req.body as { songs?: Song[]; uploadedAt?: number };
    if (!body.songs || !Array.isArray(body.songs)) {
      res.status(400).json({ error: "songs array is required" });
      return;
    }

    const uploadedAt = body.uploadedAt ?? Date.now();
    const cloudData: CloudData = { songs: body.songs, uploadedAt };
    saveCloudSongs(cloudData);

    // Also update in-memory state for real-time clients
    state.songs = body.songs;
    io.emit("song:list", state.songs);

    console.log(`[Cloud] Uploaded ${body.songs.length} song(s) at ${new Date(uploadedAt).toISOString()}`);
    res.json({ ok: true, count: body.songs.length, uploadedAt });
  } catch (err: any) {
    console.error("[Cloud] Upload error:", err);
    res.status(500).json({ error: err?.message || "Internal server error" });
  }
});

/**
 * GET /api/songs/download?since=<timestamp>
 *
 * Returns songs from the cloud setlist.
 * If `since` param > 0, only returns songs with updatedAt >= since.
 * If `since` is 0 or missing, returns all songs.
 */
app.get("/api/songs/download", (req: Request, res: Response) => {
  try {
    const since = Number(req.query.since) || 0;
    const cloudData = loadCloudSongs();

    let songsToReturn: Song[];
    if (since > 0) {
      songsToReturn = cloudData.songs.filter((s) => (s.updatedAt ?? 0) >= since);
    } else {
      songsToReturn = cloudData.songs;
    }

    console.log(`[Cloud] Download request (since=${since}): returning ${songsToReturn.length}/${cloudData.songs.length} song(s)`);
    res.json({
      songs: songsToReturn,
      totalOnServer: cloudData.songs.length,
      serverTimestamp: cloudData.uploadedAt || Date.now(),
    });
  } catch (err: any) {
    console.error("[Cloud] Download error:", err);
    res.status(500).json({ error: err?.message || "Internal server error" });
  }
});

io.on("connection", (socket: Socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Call at the top of an operator-only handler; returns false (and notifies
  // the client) if this socket didn't pass Firebase ID token verification.
  // NOT used for camera join / display sync events, which unauthenticated
  // phones and displays legitimately need to be able to send.
  const authGuard = (): boolean => {
    if (!socket.data.authenticated) {
      socket.emit("auth:required", { message: "Sign in required to control the stream." });
      return false;
    }
    return true;
  };

  // Push full current state to newly connected client
  socket.emit("state:sync", state);

  /* ── Control events (io.emit so ALL clients sync) ── */
  socket.on("control:slide", (slideIndex: number) => {
    if (!authGuard()) return;
    state.currentSlide = slideIndex;
    persistState();
    io.emit("control:slide", slideIndex);
  });

  socket.on("control:song", (songId: string) => {
    if (!authGuard()) return;
    state.currentSongId = songId;
    state.currentSlide = 0;
    persistState();
    io.emit("control:song", songId);
    io.emit("control:slide", 0);
  });

  socket.on("control:scene", (payload: { scene: string; cameraId: string; transition: string; sceneType?: string; sceneConfig?: any } | string) => {
    if (!authGuard()) return;
    const scene = (typeof payload === "string" ? payload : payload.scene) as SceneMode;
    state.currentScene = scene;
    if (typeof payload !== "string") {
      if (payload.sceneType) state.sceneType = payload.sceneType;
      if (payload.sceneConfig) state.sceneConfig = payload.sceneConfig;
    }
    persistState();
    io.emit("control:scene", typeof payload === "string" ? { scene } : payload);
  });

  socket.on("control:camera", (cameraId: string) => {
    if (!authGuard()) return;
    state.activeCameraId = cameraId;
    persistState();
    io.emit("control:camera", cameraId);
  });

  socket.on("control:camera:transition", (transition: string) => {
    if (!authGuard()) return;
    if (!CAMERA_TRANSITIONS.has(transition)) return;
    state.cameraTransition = transition as CameraTransition;
    persistState();
    io.emit("control:camera:transition", transition);
  });

  /* ── Song CRUD ───────────────────────────────────── */
  socket.on("song:add", (song: Song) => {
    if (!authGuard()) return;
    if (!isValidSong(song)) return;
    state.songs.push(song);
    io.emit("song:list", state.songs);
  });

  socket.on("song:update", (song: Song) => {
    if (!authGuard()) return;
    if (!isValidSong(song)) return;
    const idx = state.songs.findIndex((s) => s.id === song.id);
    if (idx >= 0) state.songs[idx] = song;
    io.emit("song:list", state.songs);
  });

  socket.on("song:delete", (songId: string) => {
    if (!authGuard()) return;
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
    if (!authGuard()) return;
    if (!Array.isArray(songs)) return;
    for (const song of songs) {
      if (!isValidSong(song)) continue;
      if (!state.songs.some((s) => s.id === song.id)) {
        state.songs.push(song);
      }
    }
    io.emit("song:list", state.songs);
  });

  socket.on("song:reorder", (songIds: string[]) => {
    if (!authGuard()) return;
    if (!Array.isArray(songIds) || !songIds.every((id) => typeof id === "string")) return;
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
    if (!isValidCamera(camera)) return;
    if (camera.isMobile) {
      socketCameraMap.set(socket.id, camera.id);
    }

    if (!state.cameras.some((c) => c.id === camera.id)) {
      state.cameras.push({ ...camera, status: "online" });
    } else {
      const idx = state.cameras.findIndex((c) => c.id === camera.id);
      if (idx >= 0) state.cameras[idx] = { ...state.cameras[idx], ...camera, status: "online" };
    }
    persistState();
    io.emit("camera:list", state.cameras);
  });

  socket.on("camera:remove", (cameraId: string) => {
    state.cameras = state.cameras.filter((c) => c.id !== cameraId);
    if (socketCameraMap.get(socket.id) === cameraId) {
      socketCameraMap.delete(socket.id);
    }
    persistState();
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
    socketCameraMap.set(socket.id, cam.id);

    if (!state.cameras.some((c) => c.id === cam.id)) {
      state.cameras.push(cam);
    } else {
      const idx = state.cameras.findIndex((c) => c.id === cam.id);
      if (idx >= 0) state.cameras[idx] = { ...state.cameras[idx], status: "online" };
    }
    persistState();
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

  /* ── Projector WebRTC signaling (control → projector video background) ──
   * Relay only — no client currently emits "projector:offer" (the control
   * page doesn't yet send its active camera feed to the projector this
   * way), so this is currently inert. The projector page already has a
   * working receiver for it. Gated behind auth since, if used, it would be
   * operator-initiated. */
  socket.on("projector:offer", (payload: Record<string, unknown>) => {
    if (!authGuard()) return;
    socket.broadcast.emit("projector:offer", payload);
  });

  socket.on("projector:answer", (payload: Record<string, unknown>) => {
    socket.broadcast.emit("projector:answer", payload);
  });

  socket.on("projector:candidate", (payload: Record<string, unknown>) => {
    socket.broadcast.emit("projector:candidate", payload);
  });

  socket.on("mobile-camera:status", (status: Record<string, unknown>) => {
    socket.broadcast.emit("mobile-camera:status", status);
  });

  // Snapshot fallback: relay camera frames through the socket server
  socket.on("mobile-camera:snapshot", (payload: { cameraId: string; frame: string }) => {
    socket.broadcast.emit("mobile-camera:snapshot", payload);
  });

  /* ── Stream events ───────────────────────────────── */
  socket.on(
    "stream:start",
    (
      payload: { rtmpUrl?: string; streamKey?: string; scene?: string; cameraId?: string; profile?: EncodingProfileName },
      callback: (result: { ok: boolean; message?: string; status?: string }) => void
    ) => {
      if (!authGuard()) {
        callback({ ok: false, message: "Sign in required to control the stream." });
        return;
      }
      const rtmpUrl = payload.rtmpUrl?.trim() || "";
      const streamKey = payload.streamKey?.trim().replace(/^\/+/, "") || "";
      const profile: EncodingProfileName = payload.profile && payload.profile in ENCODING_PROFILES ? payload.profile : DEFAULT_ENCODING_PROFILE;

      if (!rtmpUrl || !streamKey) {
        const message = "RTMP URL and Stream Key are required.";
        socket.emit("stream:error", { message });
        callback({ ok: false, message });
        return;
      }

      console.log("[Stream] stream:start request received", { rtmpUrl, cameraId: payload.cameraId, profile });
      const result = startFfmpeg(rtmpUrl, streamKey, profile);
      if (!result.ok) {
        const message = result.error || "Failed to start stream";
        socket.emit("stream:error", { message });
        callback({ ok: false, message });
        return;
      }

      state.isLive = true;
      console.log(`[Stream] Live → ${rtmpUrl}***`);
      io.emit("stream:started", { scene: payload.scene, cameraId: payload.cameraId, status: "live" });
      callback({ ok: true, status: "live" });
    }
  );

  // Binary video data from client MediaRecorder
  socket.on("stream:data", (chunk: Buffer | ArrayBuffer) => {
    if (!authGuard()) return;
    if (!ffmpegProcess || !ffmpegProcess.stdin?.writable) {
      console.warn("[Stream] Dropping stream data: ffmpeg not ready");
      return;
    }
    try {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      ffmpegProcess.stdin.write(buf);
    } catch (err: any) {
      console.error("[Stream] Error writing to ffmpeg:", err.message);
    }
  });

  socket.on("stream:stop", () => {
    if (!authGuard()) return;
    stopFfmpeg();
    state.isLive = false;
    console.log("[Stream] Stream stopped");
    io.emit("stream:stopped", { status: "stopped" });
  });

  socket.on("stream:toggleOverlay", (payload: { enabled: boolean }) => {
    if (!authGuard()) return;
    state.overlayEnabled = payload.enabled;
    persistState();
    io.emit("stream:overlayToggled", payload);
  });

  socket.on("stream:overlayPosition", (pos: OverlayPosition) => {
    if (!authGuard()) return;
    state.overlayPosition = pos;
    persistState();
    io.emit("stream:overlayPosition", pos);
  });
  socket.on("display:teleprompterFontSize", (size: number) => {
    if (!authGuard()) return;
    state.teleprompterFontSize = size;
    persistState();
    io.emit("display:teleprompterFontSize", size);
  });

  socket.on("display:projectorFontSize", (size: number) => {
    if (!authGuard()) return;
    state.projectorFontSize = Number.isFinite(size) ? Math.max(0, size) : 0;
    persistState();
    io.emit("display:projectorFontSize", state.projectorFontSize);
  });
  socket.on("stream:overlayOpacity", (opacity: number) => {
    if (!authGuard()) return;
    (state as any).overlayOpacity = opacity;
    io.emit("stream:overlayOpacity", opacity);
  });

  socket.on("stream:overlayHeight", (height: number) => {
    if (!authGuard()) return;
    (state as any).overlayHeight = height;
    io.emit("stream:overlayHeight", height);
  });

  socket.on("stream:canvaOverlay", (imageUrl: string | null) => {
    if (!authGuard()) return;
    (state as any).canvaOverlayImage = imageUrl;
    io.emit("stream:canvaOverlay", imageUrl);
  });

  /* ── Standby & Background ────────────────────────── */
  socket.on("control:standby", (enabled: boolean) => {
    if (!authGuard()) return;
    state.standby = enabled;
    persistState();
    io.emit("control:standby", enabled);
  });

  socket.on("control:background", (bg: { type: string; value: string }) => {
    if (!authGuard()) return;
    if (!bg || !BACKGROUND_TYPES.has(bg.type) || typeof bg.value !== "string") return;
    state.background = bg as typeof state.background;
    persistState();
    io.emit("control:background", bg);
  });

  /* ── Discovery ───────────────────────────────────── */
  socket.on("camera:discover", (payload: Record<string, unknown>) => {
    if (!authGuard()) return;
    socket.broadcast.emit("camera:discover", payload);
  });

  /* ── Audio ───────────────────────────────────────── */
  socket.on("audio:status", (audioStatus: Record<string, unknown>) => {
    if (!authGuard()) return;
    io.emit("audio:status", audioStatus);
  });

  /* ── Teleprompter state request ──────────────────── */
  socket.on("teleprompter:request", () => {
    socket.emit("state:sync", state);
  });

  /* ── Display resync request (projector/teleprompter reconnect, or the
   * control page's "Reconnect Displays"/"Sync Projector"/"Sync Teleprompter"
   * buttons) — just re-sends the current state to whichever socket asked. */
  socket.on("display:requestSync", () => {
    socket.emit("state:sync", state);
  });

  socket.on("disconnect", () => {
    const mobileCameraId = socketCameraMap.get(socket.id);

    if (mobileCameraId) {
      state.cameras = state.cameras.filter((camera) => camera.id !== mobileCameraId);
      socketCameraMap.delete(socket.id);
      persistState();
      io.emit("camera:list", state.cameras);
    }

    // If the disconnecting client was streaming, stop ffmpeg
    if (state.isLive && ffmpegProcess) {
      console.log("[Stream] Streaming client disconnected, stopping ffmpeg");
      stopFfmpeg();
      state.isLive = false;
      io.emit("stream:stopped", { status: "stopped" });
    }

    console.log(`Socket disconnected: ${socket.id}`);
  });
});

server.listen(port, () => {
  console.log(`Socket server is running on ${publicHost}`);
  console.log(`Socket CORS origin(s): ${corsOrigins.join(", ")}`);
  if (isAuthEnforced()) {
    console.log("[Auth] Enforcing Firebase ID token verification for operator commands.");
  } else if (authInitError()) {
    console.warn(`[Auth] FIREBASE_SERVICE_ACCOUNT_KEY was set but failed to initialize (${authInitError()}). Falling back to UNAUTHENTICATED mode — every connected client can issue operator commands.`);
  } else {
    console.warn("[Auth] FIREBASE_SERVICE_ACCOUNT_KEY is not set — running in UNAUTHENTICATED mode. Any client that can reach this server can control the stream. See docs/DEPLOYMENT.md to enable auth.");
  }
});
