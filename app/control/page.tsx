"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/src/lib/firebase";
import { TopBar } from "@/src/components/TopBar";
import { SetlistPanel } from "@/src/components/SetlistPanel";
import { LyricsPreviewPanel } from "@/src/components/LyricsPreviewPanel";
import { SceneControlPanel } from "@/src/components/SceneControlPanel";
import { SceneEditorPanel } from "@/src/components/SceneEditorPanel";
import { SceneLibraryPanel } from "@/src/components/SceneLibraryPanel";
import { AudioMonitorPanel } from "@/src/components/AudioMonitorPanel";
import { SyncStatusBadge } from "@/src/components/SyncStatusBadge";
import { CameraPreviewPanel } from "@/src/components/CameraPreviewPanel";
import { CameraTransitionPanel } from "@/src/components/CameraTransitionPanel";
import { CameraDiscoveryPanel } from "@/src/components/CameraDiscoveryPanel";
import { MobileCameraInvitePanel } from "@/src/components/MobileCameraInvitePanel";
import { LivestreamStudioPanel } from "@/src/components/LivestreamStudioPanel";
import { LocalCameraPanel } from "@/src/components/LocalCameraPanel";
import { SongManagementPanel } from "@/src/components/SongManagementPanel";
import { DraggableOverlay, OverlayManualControls, LAYOUT_PRESETS, type OverlayLayout, type OverlayPosition } from "@/src/components/DraggableOverlay";
import { BackgroundPanel } from "@/src/components/BackgroundPanel";
import { CanvaIntegrationPanel } from "@/src/components/CanvaIntegrationPanel";
import { getIceServers } from "@/src/lib/realtimeConfig";
import { createSocketClient } from "@/src/lib/socket";
import * as camStore from "@/src/lib/cameraStreamStore";
import * as songStore from "@/src/lib/songStore";
import * as sceneStore from "@/src/lib/sceneStore";
import { sampleCameras } from "@/src/lib/fakeData";
import { parseFile } from "@/src/lib/songParser";
import type { Camera, CameraTransition, SceneMode, Song, BackgroundConfig } from "@/src/types/production";
import type { SceneType, SceneConfig, SceneTemplate } from "@/src/types/scene";
import { DEFAULT_SCENE_CONFIGS } from "@/src/types/scene";

const socket = createSocketClient();
const iceServers = getIceServers();

type SignalingPayload = {
  cameraId?: string;
  cameraName?: string;
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};

export default function ControlPage() {
  const [songs, setSongs] = useState<Song[]>(songStore.getSongs);
  const [activeSongId, setActiveSongId] = useState(() => songStore.getSongs()[0]?.id ?? "");
  const [activeScene, setActiveScene] = useState<SceneMode>("worship");
  const [activeSceneType, setActiveSceneType] = useState<SceneType>("worship");
  const [activeSceneConfig, setActiveSceneConfig] = useState<SceneConfig>(DEFAULT_SCENE_CONFIGS.worship);
  const [showSceneEditor, setShowSceneEditor] = useState(false);
  const [showSceneLibrary, setShowSceneLibrary] = useState(false);
  const [editingScene, setEditingScene] = useState<SceneTemplate | null>(null);
  const [activeCameraId, setActiveCameraId] = useState<string>(sampleCameras[0].id);
  const [previewCameraId, setPreviewCameraId] = useState<string>(sampleCameras[1]?.id ?? sampleCameras[0].id);
  const [cameraTransition, setCameraTransition] = useState<CameraTransition>("cut");
  const [cameras, setCameras] = useState<Camera[]>(sampleCameras);
  const [connected, setConnected] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [rtmpUrl, setRtmpUrl] = useState("rtmp://live-api.facebook.com:80/rtmp/");
  const [streamKey, setStreamKey] = useState("");
  const [isLive, setIsLive] = useState(false);
  const [standby, setStandby] = useState(false);
  const [background, setBackground] = useState<BackgroundConfig>({ type: "color", value: "#000000", opacity: 100 });
  const [streamStatus, setStreamStatus] = useState("");
  const [programFlash, setProgramFlash] = useState(false);
  const [showSongManager, setShowSongManager] = useState(false);
  const [leftWidth, setLeftWidth] = useState(280);
  const [rightWidth, setRightWidth] = useState(320);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [localStreams, setLocalStreams] = useState<Record<string, MediaStream>>(camStore.getLocalStreams);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>(camStore.getRemoteStreams);
  const [snapshotFrames, setSnapshotFrames] = useState<Record<string, string>>(camStore.getSnapshotFrames);
  const [overlayEnabled, setOverlayEnabled] = useState(true);
  const [overlayLayout, setOverlayLayout] = useState<OverlayLayout>("lower-third");
  const [overlayPos, setOverlayPos] = useState<OverlayPosition>(LAYOUT_PRESETS["lower-third"]);
  const [overlayOpacity, setOverlayOpacity] = useState(100);
  const [overlayHeight, setOverlayHeight] = useState(25);
  const [showManualControls, setShowManualControls] = useState(false);
  const [canvaOverlayImage, setCanvaOverlayImage] = useState<string | null>(null);
  const draggingRef = useRef<"left" | "right" | null>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const programVideoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const streamCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const animFrameRef = useRef<number>(0);

  const router = useRouter();

  const reconnectDisplays = useCallback(() => {
    // Emit current state to all connected display clients (projector/teleprompter)
    socket.emit("state:sync", {
      songs: songs,
      currentSongId: activeSongId,
      currentSlide: currentSlide,
      currentScene: activeScene,
      cameras: cameras,
      activeCameraId: activeCameraId,
      cameraTransition: cameraTransition,
      isLive: isLive,
      overlayEnabled: overlayEnabled,
      overlayPosition: overlayPos,
      standby: standby,
      background: background,
      sceneType: activeSceneType,
      sceneConfig: activeSceneConfig,
    });
  }, [songs, activeSongId, currentSlide, activeScene, cameras, activeCameraId, cameraTransition, isLive, overlayEnabled, overlayPos, standby, background, activeSceneType, activeSceneConfig]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.replace("/auth");
      }
    });

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    // Full state sync from server on connect
    socket.on("state:sync", (serverState: any) => {
      setConnected(true);
      if (serverState.songs?.length) songStore.mergeFromServer(serverState.songs);
      if (serverState.currentSongId) setActiveSongId(serverState.currentSongId);
      if (serverState.currentSlide !== undefined) setCurrentSlide(serverState.currentSlide);
      if (serverState.currentScene) setActiveScene(serverState.currentScene);
      if (serverState.cameras?.length) setCameras(serverState.cameras);
      if (serverState.activeCameraId) setActiveCameraId(serverState.activeCameraId);
      if (serverState.cameraTransition) setCameraTransition(serverState.cameraTransition);
      if (serverState.isLive !== undefined) setIsLive(serverState.isLive);
      if (serverState.overlayEnabled !== undefined) setOverlayEnabled(serverState.overlayEnabled);
      if (serverState.overlayPosition) setOverlayPos(serverState.overlayPosition);
      if (serverState.standby !== undefined) setStandby(serverState.standby);
      if (serverState.background) setBackground(serverState.background);
    });

    // Live updates
    socket.on("control:slide", (nextSlide: number) => setCurrentSlide(nextSlide));
    socket.on("control:song", (songId: string) => { setActiveSongId(songId); setCurrentSlide(0); });
    socket.on("control:camera", (cameraId: string) => setActiveCameraId(cameraId));
    socket.on("control:scene", (payload: any) => { const scene = typeof payload === "string" ? payload : payload.scene; if (scene) setActiveScene(scene); if (payload?.sceneType) setActiveSceneType(payload.sceneType); if (payload?.sceneConfig) setActiveSceneConfig(payload.sceneConfig); });
    socket.on("camera:list", (cameraList: Camera[]) => setCameras(cameraList));
    socket.on("song:list", (songList: Song[]) => songStore.setSongs(songList));
    socket.on("stream:started", () => { setIsLive(true); setStreamStatus("Live"); });
    socket.on("stream:stopped", () => {
      setIsLive(false);
      setStreamStatus("Stopped");
      // Clean up client-side recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = 0;
      }
    });
    socket.on("stream:error", (err: { message: string }) => {
      setStreamStatus(`Error: ${err.message}`);
      setIsLive(false);
      // Clean up client-side recording on server error
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = 0;
      }
    });
    socket.on("control:standby", (enabled: boolean) => setStandby(enabled));
    socket.on("control:background", (bg: { type: "color" | "image"; value: string }) => setBackground(bg));
    socket.on("stream:overlayToggled", (payload: { enabled: boolean }) => setOverlayEnabled(payload.enabled));
    socket.on("stream:overlayPosition", (pos: any) => setOverlayPos(pos));
    socket.on("mobile-camera:joined", (mobileCameraData: any) => {
      const mobileId = mobileCameraData.cameraId || `mobile-${Date.now()}`;
      const mobileName = mobileCameraData.cameraName || `Mobile Camera (${mobileCameraData.device || "Remote"})`;
      setCameras((prev) => {
        const alreadyExists = prev.some((c) => c.id === mobileId);
        if (alreadyExists) return prev;
        return [
          ...prev,
          {
            id: mobileId,
            name: mobileName,
            protocol: "WebRTC" as const,
            ipAddress: "",
            streamUrl: "webrtc://mobile",
            status: "online" as const,
            supportsPTZ: false,
            isMobile: true,
            enabled: true,
            signalStrength: "good" as const,
          },
        ];
      });
    });

    socket.on("mobile-camera:offer", async (payload: SignalingPayload | RTCSessionDescriptionInit) => {
      const cameraId = (payload as SignalingPayload)?.cameraId;
      const description = (payload as SignalingPayload)?.description ?? (payload as RTCSessionDescriptionInit);

      if (!cameraId || !description?.type) return;

      let pc = camStore.getPeerConnections()[cameraId];
      if (!pc) {
        pc = new RTCPeerConnection({ iceServers });

        pc.ontrack = (event) => {
          const [stream] = event.streams;
          if (!stream) return;
          camStore.setRemoteStream(cameraId, stream);
        };

        pc.onicecandidate = (event) => {
          if (!event.candidate) return;
          socket.emit("mobile-camera:candidate", {
            cameraId,
            candidate: event.candidate,
          });
        };

        camStore.setPeerConnection(cameraId, pc);
      }

      await pc.setRemoteDescription(new RTCSessionDescription(description));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("mobile-camera:answer", {
        cameraId,
        description: answer,
      });
    });

    socket.on("mobile-camera:candidate", async (payload: SignalingPayload | RTCIceCandidateInit) => {
      const cameraId = (payload as SignalingPayload)?.cameraId;
      const candidate = (payload as SignalingPayload)?.candidate ?? (payload as RTCIceCandidateInit);

      if (!cameraId || !candidate?.candidate) return;

      const pc = camStore.getPeerConnections()[cameraId];
      if (!pc) return;

      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    });

    // Snapshot fallback: receive frames relayed through the socket server
    socket.on("mobile-camera:snapshot", (payload: { cameraId: string; frame: string }) => {
      if (payload?.cameraId && payload?.frame) {
        camStore.setSnapshotFrame(payload.cameraId, payload.frame);
      }
    });

    // Sync global store changes back into local React state so the UI re-renders
    const unsubscribeCamStore = camStore.subscribe(() => {
      setLocalStreams(camStore.getLocalStreams());
      setRemoteStreams(camStore.getRemoteStreams());
      setSnapshotFrames(camStore.getSnapshotFrames());
    });

    const unsubscribeSongStore = songStore.subscribe(() => {
      setSongs(songStore.getSongs());
    });

    return () => {
      unsubscribeAuth();
      unsubscribeCamStore();
      unsubscribeSongStore();
      socket.off("connect");
      socket.off("disconnect");
      socket.off("state:sync");
      socket.off("control:slide");
      socket.off("control:song");
      socket.off("control:camera");
      socket.off("control:scene");
      socket.off("camera:list");
      socket.off("song:list");
      socket.off("stream:started");
      socket.off("stream:stopped");
      socket.off("stream:error");
      socket.off("control:standby");
      socket.off("control:background");
      socket.off("stream:overlayToggled");
      socket.off("stream:overlayPosition");
      socket.off("mobile-camera:joined");
      socket.off("mobile-camera:offer");
      socket.off("mobile-camera:candidate");
      socket.off("mobile-camera:snapshot");
      // NOTE: Do NOT close peer connections on unmount to preserve camera connections
    };
  }, [router]);

  const EMPTY_SONG: Song = { id: "", title: "No Song", artist: "", key: "C", tempo: 0, currentSection: "", slides: [{ id: "empty", section: "", text: "" }], favorite: false };
  const activeSong = useMemo(() => songs.find((song) => song.id === activeSongId) ?? songs[0] ?? EMPTY_SONG, [activeSongId, songs]);
  const activeCamera = useMemo(() => cameras.find((c) => c.id === activeCameraId) ?? cameras[0], [activeCameraId, cameras]);
  const previewCamera = useMemo(() => cameras.find((c) => c.id === previewCameraId) ?? cameras[1] ?? cameras[0], [previewCameraId, cameras]);

  const triggerScene = (scene: SceneMode) => {
    setActiveScene(scene);
    socket.emit("control:scene", { scene, cameraId: activeCameraId, transition: cameraTransition, sceneType: activeSceneType, sceneConfig: activeSceneConfig });
    // Scene presets: adjust overlay based on scene
    if (scene === "lyrics") {
      setOverlayEnabled(true);
      socket.emit("stream:toggleOverlay", { enabled: true });
    } else if (scene === "speaker") {
      setOverlayEnabled(false);
      socket.emit("stream:toggleOverlay", { enabled: false });
    }
  };

  const triggerSceneType = (type: SceneType, config: SceneConfig) => {
    setActiveSceneType(type);
    setActiveSceneConfig(config);
    // Map SceneType to SceneMode for backward compat
    const modeMap: Record<SceneType, SceneMode> = { standby: "worship", worship: "worship", speaker: "speaker", announcement: "announcement" };
    const mode = modeMap[type];
    setActiveScene(mode);
    // Apply scene background
    setBackground(config.background);
    socket.emit("control:background", config.background);
    socket.emit("control:scene", { scene: mode, sceneType: type, sceneConfig: config, cameraId: activeCameraId, transition: cameraTransition });
    // Standby mode
    if (type === "standby") {
      setStandby(true);
      socket.emit("control:standby", true);
    } else if (standby) {
      setStandby(false);
      socket.emit("control:standby", false);
    }
  };

  const handleEditScene = (scene: SceneTemplate) => {
    setEditingScene(scene);
    setShowSceneEditor(true);
    setShowSceneLibrary(false);
  };

  const handleSaveScene = (updated: SceneTemplate) => {
    sceneStore.updateScene(updated);
    sceneStore.saveSceneVersion(updated.id);
    // If currently active type, apply the update live
    if (updated.type === activeSceneType) {
      setActiveSceneConfig(updated.config);
      socket.emit("control:scene", { scene: activeScene, sceneType: updated.type, sceneConfig: updated.config, cameraId: activeCameraId, transition: cameraTransition });
    }
    setShowSceneEditor(false);
    setEditingScene(null);
  };

  const handleLoadScene = (scene: SceneTemplate) => {
    triggerSceneType(scene.type, scene.config);
    setShowSceneLibrary(false);
  };

  const handleSceneLivePreview = (config: SceneConfig) => {
    socket.emit("control:scene", { scene: activeScene, sceneType: activeSceneType, sceneConfig: config, cameraId: activeCameraId, transition: cameraTransition });
  };

  const toggleStandby = () => {
    const next = !standby;
    setStandby(next);
    socket.emit("control:standby", next);
  };

  const changeBackground = (bg: BackgroundConfig) => {
    setBackground(bg);
    socket.emit("control:background", bg);
  };

  const selectSong = (songId: string) => {
    if (songId === activeSongId) return;
    setActiveSongId(songId);
    setCurrentSlide(0);
    socket.emit("control:song", songId);
    socket.emit("control:slide", 0);
  };

  const selectCamera = (cameraId: string) => {
    setPreviewCameraId(cameraId);
  };

  const handleTake = () => {
    setActiveCameraId(previewCameraId);
    socket.emit("control:camera", previewCameraId);
    setProgramFlash(true);
    setTimeout(() => setProgramFlash(false), 400);
  };

  const changeTransition = (transition: CameraTransition) => {
    setCameraTransition(transition);
    socket.emit("control:camera:transition", transition);
  };

  const handleReorderSong = (sourceSongId: string, targetSongId: string) => {
    const sourceIndex = songs.findIndex((song) => song.id === sourceSongId);
    const targetIndex = songs.findIndex((song) => song.id === targetSongId);
    if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return;
    const nextSongs = [...songs];
    const [movedSong] = nextSongs.splice(sourceIndex, 1);
    nextSongs.splice(targetIndex, 0, movedSong);
    songStore.setSongs(nextSongs);
    socket.emit("song:reorder", nextSongs.map((s) => s.id));
  };

  const handleImportSong = async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      try {
        const song = await parseFile(file);
        if (song) {
          songStore.addSong(song);
          socket.emit("song:add", song);
        }
      } catch { /* skip */ }
    }
  };

  const handleAddSong = (song: Song) => {
    songStore.addSong(song);
    socket.emit("song:add", song);
  };
  const handleUpdateSong = (song: Song) => {
    songStore.updateSong(song);
    socket.emit("song:update", song);
  };
  const handleDeleteSong = (songId: string) => {
    songStore.deleteSong(songId);
    socket.emit("song:delete", songId);
  };

  const handleAddCamera = (camera: Camera, stream?: MediaStream) => {
    setCameras((prev) => (prev.some((item) => item.id === camera.id) ? prev : [...prev, camera]));
    if (stream) {
      camStore.setLocalStream(camera.id, stream);
    }
  };

  const handleRemoveCamera = (cameraId: string) => {
    setCameras((prev) => {
      const next = prev.filter((c) => c.id !== cameraId);
      const fallbackId = next[0]?.id ?? "";
      if (activeCameraId === cameraId) {
        setActiveCameraId(fallbackId);
      }
      if (previewCameraId === cameraId) {
        setPreviewCameraId(fallbackId);
      }
      return next;
    });

    camStore.removeLocalStream(cameraId);
    camStore.removeRemoteStream(cameraId);
    camStore.removeSnapshotFrame(cameraId);
    camStore.removePeerConnection(cameraId);
  };

  const streamByCamera = useMemo(() => ({ ...remoteStreams, ...localStreams }), [localStreams, remoteStreams]);

  useEffect(() => {
    const stream = streamByCamera[activeCameraId];
    if (programVideoRef.current) {
      programVideoRef.current.srcObject = stream ?? null;
    }
  }, [activeCameraId, streamByCamera]);

  useEffect(() => {
    const stream = streamByCamera[previewCameraId];
    if (previewVideoRef.current) {
      previewVideoRef.current.srcObject = stream ?? null;
    }
  }, [previewCameraId, streamByCamera]);

  const startStream = () => {
    if (!streamKey.trim()) {
      setStreamStatus("Error: Stream Key is required");
      return;
    }
    setStreamStatus("Connecting...");

    // Tell server to start ffmpeg process first
    socket.emit("stream:start", { rtmpUrl, streamKey, scene: activeScene, cameraId: activeCameraId });

    // Build a canvas that composites the program video + overlays
    const WIDTH = 1280;
    const HEIGHT = 720;

    let canvas = streamCanvasRef.current;
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.width = WIDTH;
      canvas.height = HEIGHT;
      streamCanvasRef.current = canvas;
    }
    const ctx = canvas.getContext("2d")!;

    // Get the camera source video element
    const srcVideo = programVideoRef.current;

    // Draw composited frame
    const drawFrame = () => {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      // Draw the camera video
      if (srcVideo && srcVideo.readyState >= 2) {
        const vw = srcVideo.videoWidth || WIDTH;
        const vh = srcVideo.videoHeight || HEIGHT;
        const scale = Math.min(WIDTH / vw, HEIGHT / vh);
        const dw = vw * scale;
        const dh = vh * scale;
        const dx = (WIDTH - dw) / 2;
        const dy = (HEIGHT - dh) / 2;
        ctx.drawImage(srcVideo, dx, dy, dw, dh);
      }

      // Draw lyrics overlay if enabled
      if (overlayEnabled && activeSong?.slides?.[currentSlide]?.text) {
        const text = activeSong.slides[currentSlide].text;
        const section = activeSong.slides[currentSlide].section || "";

        // Use overlay position to determine where to draw
        const ox = (overlayPos.x / 100) * WIDTH;
        const oy = (overlayPos.y / 100) * HEIGHT;
        const ow = (overlayPos.width / 100) * WIDTH;
        const oh = (overlayHeight / 100) * HEIGHT;

        // Semi-transparent background
        ctx.fillStyle = `rgba(0, 0, 0, ${(overlayOpacity / 100) * 0.7})`;
        ctx.fillRect(ox, oy, ow, oh);

        // Lyrics text
        ctx.fillStyle = `rgba(255, 255, 255, ${overlayOpacity / 100})`;
        ctx.font = "bold 28px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Word-wrap text
        const maxWidth = ow - 40;
        const words = text.split(" ");
        const lines: string[] = [];
        let currentLine = "";
        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          if (ctx.measureText(testLine).width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }
        if (currentLine) lines.push(currentLine);

        const lineHeight = 34;
        const totalTextHeight = lines.length * lineHeight + (section ? 24 : 0);
        let textY = oy + (oh - totalTextHeight) / 2 + lineHeight / 2;

        for (const line of lines) {
          ctx.fillText(line, ox + ow / 2, textY);
          textY += lineHeight;
        }

        // Section label
        if (section) {
          ctx.font = "16px sans-serif";
          ctx.fillStyle = `rgba(200, 200, 200, ${overlayOpacity / 100})`;
          ctx.fillText(section, ox + ow / 2, textY + 8);
        }
      }

      animFrameRef.current = requestAnimationFrame(drawFrame);
    };
    drawFrame();

    // Capture the canvas as a media stream
    const canvasStream = canvas.captureStream(30);

    // Add audio from the active camera if available
    const cameraStream = streamByCamera[activeCameraId];
    if (cameraStream) {
      const audioTracks = cameraStream.getAudioTracks();
      for (const track of audioTracks) {
        canvasStream.addTrack(track);
      }
    }

    // Record and send chunks to server
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
      ? "video/webm;codecs=vp8,opus"
      : MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
        ? "video/webm;codecs=vp8"
        : "video/webm";

    const recorder = new MediaRecorder(canvasStream, {
      mimeType,
      videoBitsPerSecond: 2_500_000,
    });

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        event.data.arrayBuffer().then((buf) => {
          socket.emit("stream:data", buf);
        });
      }
    };

    recorder.onerror = () => {
      setStreamStatus("Error: Recording failed");
      stopStream();
    };

    // Send a chunk every 250ms for low latency
    recorder.start(250);
    mediaRecorderRef.current = recorder;
  };

  const stopStream = () => {
    // Stop the MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    // Stop the canvas animation loop
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }

    socket.emit("stream:stop", { scene: activeScene, cameraId: activeCameraId });
    setStreamStatus("");
  };

  const toggleOverlay = () => {
    const next = !overlayEnabled;
    setOverlayEnabled(next);
    socket.emit("stream:toggleOverlay", { enabled: next, position: overlayPos });
  };

  const changeOverlayLayout = (layout: OverlayLayout) => {
    setOverlayLayout(layout);
    if (layout !== "custom") {
      const pos = LAYOUT_PRESETS[layout];
      setOverlayPos(pos);
      socket.emit("stream:overlayPosition", pos);
    }
  };

  const handleOverlayDrag = (pos: OverlayPosition) => {
    setOverlayLayout("custom");
    setOverlayPos(pos);
    socket.emit("stream:overlayPosition", pos);
  };

  const triggerSlide = (direction: "previous" | "next") => {
    const next = Math.max(0, Math.min(activeSong.slides.length - 1, direction === "next" ? currentSlide + 1 : currentSlide - 1));
    setCurrentSlide(next);
    socket.emit("control:slide", next);
  };

  const jumpToSection = (index: number) => {
    setCurrentSlide(index);
    socket.emit("control:slide", index);
  };

  const handleNextSong = () => {
    const currentIndex = songs.findIndex((s) => s.id === activeSongId);
    if (currentIndex < songs.length - 1) {
      const nextSongId = songs[currentIndex + 1].id;
      setActiveSongId(nextSongId);
      setCurrentSlide(0);
      socket.emit("control:song", nextSongId);
      socket.emit("control:slide", 0);
    }
  };

  // Keyboard shortcuts: Space=TAKE, Arrow=slide, S=nextSong
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      switch (e.code) {
        case "Space":
          e.preventDefault();
          handleTake();
          break;
        case "ArrowRight":
          e.preventDefault();
          triggerSlide("next");
          break;
        case "ArrowLeft":
          e.preventDefault();
          triggerSlide("previous");
          break;
        case "KeyS":
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            handleNextSong();
          }
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const onMouseDown = useCallback((side: "left" | "right", e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = side;
    startXRef.current = e.clientX;
    startWidthRef.current = side === "left" ? leftWidth : rightWidth;

    const onMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startXRef.current;
      if (draggingRef.current === "left") {
        setLeftWidth(Math.max(180, Math.min(500, startWidthRef.current + delta)));
      } else if (draggingRef.current === "right") {
        setRightWidth(Math.max(220, Math.min(600, startWidthRef.current - delta)));
      }
    };

    const onMouseUp = () => {
      draggingRef.current = null;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [leftWidth, rightWidth]);

  return (
    <div className="control-shell">
      {/* TOP STATUS BAR */}
      <TopBar
        title="ABCF Production"
        badge={connected ? "Live Sync" : "Offline"}
        currentSong={activeSong.title}
        isLive={isLive}
        cameraCount={cameras.length}
        onlineCameraCount={cameras.filter((c) => c.status === "online").length}
        activeScene={activeScene}
        showRightPanel={showRightPanel}
        onToggleRightPanel={() => setShowRightPanel((s) => !s)}
      />

      {/* 3-PANEL BODY */}
      <div className="control-body" style={{ gridTemplateColumns: showRightPanel ? `${leftWidth}px 6px 1fr 6px ${rightWidth}px` : `${leftWidth}px 6px 1fr` }}>
        {/* LEFT: SETLIST */}
        <div className="control-left">
          <SetlistPanel songs={songs} activeSongId={activeSongId} onSelectSong={selectSong} onReorder={handleReorderSong} />
          <button type="button" className="button outline" style={{ width: "100%", marginTop: 8, fontSize: 12 }} onClick={() => setShowSongManager(true)}>
            ✏️ Edit Songs / Import PPT
          </button>
        </div>

        {/* LEFT RESIZE HANDLE */}
        <div className="resize-handle" onMouseDown={(e) => onMouseDown("left", e)} />

        {/* CENTER: PROGRAM/PREVIEW + LYRICS */}
        <div className="control-center">
          <div className="program-preview-stack">
            {/* PROGRAM (LIVE) */}
            <div className={`program-box${programFlash ? " flash" : ""}`}>
              <span className="box-label">Program (Live)</span>
              <div className="box-content">
                {streamByCamera[activeCamera?.id] ? (
                  <>
                    <video ref={programVideoRef} autoPlay muted playsInline className="program-video" />
                    {canvaOverlayImage && (
                      <div className="canva-overlay-image"><img src={canvaOverlayImage} alt="Canva overlay" /></div>
                    )}
                    {overlayEnabled && (
                      <DraggableOverlay position={overlayPos} onPositionChange={handleOverlayDrag} opacity={overlayOpacity} height={overlayHeight}>
                        <div className="overlay-lyrics">
                          <p>{activeSong.slides[currentSlide]?.text}</p>
                          <span className="overlay-section">{activeSong.slides[currentSlide]?.section}</span>
                        </div>
                      </DraggableOverlay>
                    )}
                  </>
                ) : snapshotFrames[activeCamera?.id] ? (
                  <>
                    <img src={snapshotFrames[activeCamera.id]} alt={activeCamera.name} className="program-video" style={{ objectFit: "cover" }} />
                    <span style={{ position: "absolute", top: 6, right: 8, fontSize: 10, background: "rgba(0,0,0,0.6)", padding: "2px 6px", borderRadius: 4, color: "#f59e0b" }}>RELAY</span>
                    {canvaOverlayImage && (
                      <div className="canva-overlay-image"><img src={canvaOverlayImage} alt="Canva overlay" /></div>
                    )}
                    {overlayEnabled && (
                      <DraggableOverlay position={overlayPos} onPositionChange={handleOverlayDrag} opacity={overlayOpacity} height={overlayHeight}>
                        <div className="overlay-lyrics">
                          <p>{activeSong.slides[currentSlide]?.text}</p>
                          <span className="overlay-section">{activeSong.slides[currentSlide]?.section}</span>
                        </div>
                      </DraggableOverlay>
                    )}
                  </>
                ) : (
                  <div>
                    <p>{activeSong.slides[currentSlide]?.text}</p>
                  </div>
                )}
              </div>
            </div>

            {/* PREVIEW (Next) */}
            <div className="preview-box">
              <span className="box-label">Preview</span>
              <div className="box-content">
                {streamByCamera[previewCamera?.id] ? (
                  <>
                    <video ref={previewVideoRef} autoPlay muted playsInline className="preview-video" />
                    {overlayEnabled && (
                      <DraggableOverlay position={overlayPos} interactive={false}>
                        <div className="overlay-lyrics">
                          <p>{activeSong.slides[currentSlide + 1]?.text ?? "End of song"}</p>
                          <span className="overlay-section">{previewCamera.name}</span>
                        </div>
                      </DraggableOverlay>
                    )}
                  </>
                ) : snapshotFrames[previewCamera?.id] ? (
                  <>
                    <img src={snapshotFrames[previewCamera.id]} alt={previewCamera.name} className="preview-video" style={{ objectFit: "cover" }} />
                    <span style={{ position: "absolute", top: 6, right: 8, fontSize: 10, background: "rgba(0,0,0,0.6)", padding: "2px 6px", borderRadius: 4, color: "#f59e0b" }}>RELAY</span>
                  </>
                ) : (
                  <div>
                    <p>{activeSong.slides[currentSlide + 1]?.text ?? "End of song"}</p>
                    <p className="camera-name">{previewCamera.name}</p>
                  </div>
                )}
              </div>
            </div>

            {/* TAKE button */}
            <button type="button" className="button take" onClick={handleTake}>
              TAKE <kbd>Space</kbd>
            </button>

            {/* OVERLAY LAYOUT CONTROLS */}
            <div className="overlay-controls">
              <div className="overlay-controls-row">
                <span className="overlay-controls-label">Lyrics Overlay</span>
                <button type="button" className={`button ${overlayEnabled ? "success" : "outline"}`} style={{ padding: "6px 12px", fontSize: 12 }} onClick={toggleOverlay}>
                  {overlayEnabled ? "ON" : "OFF"}
                </button>
              </div>
              {overlayEnabled && (
                <>
                  <div className="overlay-presets">
                    {(["lower-third", "top-bar", "pip-corner", "full"] as const).map((l) => (
                      <button key={l} type="button" className={`button ${overlayLayout === l ? "primary" : "subtle"}`} style={{ padding: "6px 10px", fontSize: 11 }} onClick={() => changeOverlayLayout(l)}>
                        {l === "lower-third" ? "Lower Third" : l === "top-bar" ? "Top Bar" : l === "pip-corner" ? "PIP Corner" : "Full"}
                      </button>
                    ))}
                    {overlayLayout === "custom" && <span style={{ fontSize: 11, color: "var(--accent)" }}>Custom (drag to move)</span>}
                  </div>
                  <button
                    type="button"
                    className={`button ${showManualControls ? "primary" : "subtle"}`}
                    style={{ padding: "6px 10px", fontSize: 11, marginTop: 4, width: "100%" }}
                    onClick={() => setShowManualControls(!showManualControls)}
                  >
                    {showManualControls ? "▲ Hide" : "▼ Show"} Manual Adjustments
                  </button>
                  {showManualControls && (
                    <OverlayManualControls
                      position={overlayPos}
                      onPositionChange={(pos) => {
                        setOverlayLayout("custom");
                        setOverlayPos(pos);
                        socket.emit("stream:overlayPosition", pos);
                      }}
                      opacity={overlayOpacity}
                      onOpacityChange={(v) => {
                        setOverlayOpacity(v);
                        socket.emit("stream:overlayOpacity", v);
                      }}
                      height={overlayHeight}
                      onHeightChange={(v) => {
                        setOverlayHeight(v);
                        socket.emit("stream:overlayHeight", v);
                      }}
                    />
                  )}
                </>
              )}
            </div>
          </div>

          <LyricsPreviewPanel song={activeSong} currentSlide={currentSlide} onJumpToSlide={jumpToSection} />
        </div>

        {/* RIGHT RESIZE HANDLE */}
        {showRightPanel && <div className="resize-handle" onMouseDown={(e) => onMouseDown("right", e)} />}

        {/* RIGHT: PRODUCTION CONTROLS */}
        {showRightPanel && (
        <div className="control-right">
          <CameraPreviewPanel cameras={cameras} activeCameraId={previewCameraId} programCameraId={activeCameraId} onSelectCamera={selectCamera} onRemoveCamera={handleRemoveCamera} onHoverCamera={(id) => id && setPreviewCameraId(id)} />
          <CameraTransitionPanel transition={cameraTransition} onChangeTransition={changeTransition} />
          <SceneControlPanel activeSceneType={activeSceneType} onSceneChange={triggerSceneType} onEditScene={handleEditScene} onOpenLibrary={() => setShowSceneLibrary(true)} />
          <LivestreamStudioPanel
            activeScene={activeScene}
            activeCamera={activeCamera}
            transition={cameraTransition}
            isLive={isLive}
            streamStatus={streamStatus}
            onStart={startStream}
            onStop={stopStream}
            onToggleOverlay={toggleOverlay}
            onChangeRtmpUrl={setRtmpUrl}
            onChangeStreamKey={setStreamKey}
          />
          {/* Standby & Background */}
          <BackgroundPanel
            background={background}
            onBackgroundChange={changeBackground}
            standby={standby}
            onToggleStandby={toggleStandby}
          />
          {/* Canva Integration */}
          <CanvaIntegrationPanel
            onApplyAsOverlay={(imageUrl) => setCanvaOverlayImage(imageUrl)}
            onApplyAsBackground={(bg) => changeBackground(bg)}
          />
          <AudioMonitorPanel />
          <CameraDiscoveryPanel onAddCamera={handleAddCamera} />
          <LocalCameraPanel onAddCamera={handleAddCamera} />
          <MobileCameraInvitePanel />
          <section className="display-connect-panel">
            <div className="panel-header">
              <p>Display Connections</p>
              <span className={`status-pill ${connected ? "active" : "offline"}`}>
                {connected ? "Ready" : "Server Offline"}
              </span>
            </div>
            <p className="display-connect-copy">
              Sync the latest control state to all connected displays.
            </p>
            <div className="display-connect-actions">
              <button type="button" className="button primary" onClick={reconnectDisplays}>
                Reconnect Displays
              </button>
              <button type="button" className="button outline" onClick={reconnectDisplays}>
                Sync Projector
              </button>
              <button type="button" className="button outline" onClick={reconnectDisplays}>
                Sync Teleprompter
              </button>
            </div>
          </section>
          <SyncStatusBadge status={connected ? "connected" : "disconnected"} />
        </div>
        )}
      </div>

      {/* BOTTOM CONTROL BAR */}
      <div className="control-bar">
        <button type="button" className="button outline" onClick={() => triggerSlide("previous")}>
          ◀ Prev Slide <kbd>←</kbd>
        </button>
        <button type="button" className="button primary" onClick={() => triggerSlide("next")}>
          Next Slide ▶ <kbd>→</kbd>
        </button>
        <button type="button" className="button success" onClick={handleNextSong}>
          Next Song <kbd>S</kbd>
        </button>
        <button type="button" className="button subtle" onClick={() => triggerScene(activeScene)}>
          Scene: {activeSceneType}
        </button>
      </div>

      {/* SONG MANAGER MODAL */}
      {showSongManager && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowSongManager(false); }}>
          <div className="modal-content">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>Song Manager</h2>
              <button type="button" className="button subtle" onClick={() => setShowSongManager(false)}>✕ Close</button>
            </div>
            <SongManagementPanel
              songs={songs}
              onImportSong={handleImportSong}
              onAddSong={handleAddSong}
              onUpdateSong={handleUpdateSong}
              onDeleteSong={handleDeleteSong}
            />
          </div>
        </div>
      )}

      {/* SCENE EDITOR MODAL */}
      {showSceneEditor && editingScene && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setShowSceneEditor(false); setEditingScene(null); } }}>
          <div className="modal-content modal-wide">
            <SceneEditorPanel
              scene={editingScene}
              onSave={handleSaveScene}
              onClose={() => { setShowSceneEditor(false); setEditingScene(null); }}
              onLivePreview={handleSceneLivePreview}
            />
          </div>
        </div>
      )}

      {/* SCENE LIBRARY MODAL */}
      {showSceneLibrary && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowSceneLibrary(false); }}>
          <div className="modal-content modal-wide">
            <SceneLibraryPanel
              onLoadScene={handleLoadScene}
              onEditScene={handleEditScene}
              onClose={() => setShowSceneLibrary(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
