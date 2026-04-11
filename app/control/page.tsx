"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/src/lib/firebase";
import { TopBar } from "@/src/components/TopBar";
import { SetlistPanel } from "@/src/components/SetlistPanel";
import { LyricsPreviewPanel } from "@/src/components/LyricsPreviewPanel";
import { SceneControlPanel } from "@/src/components/SceneControlPanel";
import { AudioMonitorPanel } from "@/src/components/AudioMonitorPanel";
import { SyncStatusBadge } from "@/src/components/SyncStatusBadge";
import { CameraPreviewPanel } from "@/src/components/CameraPreviewPanel";
import { CameraTransitionPanel } from "@/src/components/CameraTransitionPanel";
import { CameraDiscoveryPanel } from "@/src/components/CameraDiscoveryPanel";
import { MobileCameraInvitePanel } from "@/src/components/MobileCameraInvitePanel";
import { LivestreamStudioPanel } from "@/src/components/LivestreamStudioPanel";
import { LocalCameraPanel } from "@/src/components/LocalCameraPanel";
import { SongManagementPanel } from "@/src/components/SongManagementPanel";
import { DraggableOverlay, LAYOUT_PRESETS, type OverlayLayout, type OverlayPosition } from "@/src/components/DraggableOverlay";
import { getIceServers } from "@/src/lib/realtimeConfig";
import { createSocketClient } from "@/src/lib/socket";
import { sampleCameras, sampleSongs } from "@/src/lib/fakeData";
import { parseFile } from "@/src/lib/songParser";
import type { Camera, CameraTransition, SceneMode, Song } from "@/src/types/production";

const socket = createSocketClient();
const iceServers = getIceServers();

type SignalingPayload = {
  cameraId?: string;
  cameraName?: string;
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};

export default function ControlPage() {
  const [songs, setSongs] = useState<Song[]>(sampleSongs);
  const [activeSongId, setActiveSongId] = useState(sampleSongs[0].id);
  const [activeScene, setActiveScene] = useState<SceneMode>("worship");
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
  const [background, setBackground] = useState<{ type: "color" | "image"; value: string }>({ type: "color", value: "#000000" });
  const [streamStatus, setStreamStatus] = useState("");
  const [programFlash, setProgramFlash] = useState(false);
  const [showSongManager, setShowSongManager] = useState(false);
  const [leftWidth, setLeftWidth] = useState(280);
  const [rightWidth, setRightWidth] = useState(320);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [localStreams, setLocalStreams] = useState<Record<string, MediaStream>>({});
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [snapshotFrames, setSnapshotFrames] = useState<Record<string, string>>({});
  const [overlayEnabled, setOverlayEnabled] = useState(true);
  const [overlayLayout, setOverlayLayout] = useState<OverlayLayout>("lower-third");
  const [overlayPos, setOverlayPos] = useState<OverlayPosition>(LAYOUT_PRESETS["lower-third"]);
  const draggingRef = useRef<"left" | "right" | null>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const peerConnectionsRef = useRef<Record<string, RTCPeerConnection>>({});
  const programVideoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  const router = useRouter();

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
      if (serverState.songs?.length) setSongs(serverState.songs);
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
    socket.on("control:scene", (payload: any) => { const scene = typeof payload === "string" ? payload : payload.scene; if (scene) setActiveScene(scene); });
    socket.on("camera:list", (cameraList: Camera[]) => setCameras(cameraList));
    socket.on("song:list", (songList: Song[]) => setSongs(songList));
    socket.on("stream:started", () => { setIsLive(true); setStreamStatus("Live"); });
    socket.on("stream:stopped", () => { setIsLive(false); setStreamStatus("Stopped"); });
    socket.on("stream:error", (err: { message: string }) => { setStreamStatus(err.message); setIsLive(false); });
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

      let pc = peerConnectionsRef.current[cameraId];
      if (!pc) {
        pc = new RTCPeerConnection({ iceServers });

        pc.ontrack = (event) => {
          const [stream] = event.streams;
          if (!stream) return;
          setRemoteStreams((prev) => ({ ...prev, [cameraId]: stream }));
        };

        pc.onicecandidate = (event) => {
          if (!event.candidate) return;
          socket.emit("mobile-camera:candidate", {
            cameraId,
            candidate: event.candidate,
          });
        };

        peerConnectionsRef.current[cameraId] = pc;
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

      const pc = peerConnectionsRef.current[cameraId];
      if (!pc) return;

      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    });

    // Snapshot fallback: receive frames relayed through the socket server
    socket.on("mobile-camera:snapshot", (payload: { cameraId: string; frame: string }) => {
      if (payload?.cameraId && payload?.frame) {
        setSnapshotFrames((prev) => ({ ...prev, [payload.cameraId]: payload.frame }));
      }
    });

    return () => {
      unsubscribeAuth();
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

  const activeSong = useMemo(() => songs.find((song) => song.id === activeSongId) ?? songs[0], [activeSongId, songs]);
  const activeCamera = useMemo(() => cameras.find((c) => c.id === activeCameraId) ?? cameras[0], [activeCameraId, cameras]);
  const previewCamera = useMemo(() => cameras.find((c) => c.id === previewCameraId) ?? cameras[1] ?? cameras[0], [previewCameraId, cameras]);

  const triggerScene = (scene: SceneMode) => {
    setActiveScene(scene);
    socket.emit("control:scene", { scene, cameraId: activeCameraId, transition: cameraTransition });
    // Scene presets: adjust overlay based on scene
    if (scene === "lyrics") {
      setOverlayEnabled(true);
      socket.emit("stream:toggleOverlay", { enabled: true });
    } else if (scene === "speaker") {
      setOverlayEnabled(false);
      socket.emit("stream:toggleOverlay", { enabled: false });
    }
  };

  const toggleStandby = () => {
    const next = !standby;
    setStandby(next);
    socket.emit("control:standby", next);
  };

  const changeBackground = (type: "color" | "image", value: string) => {
    const bg = { type, value };
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
    setSongs(nextSongs);
    socket.emit("song:reorder", nextSongs.map((s) => s.id));
  };

  const handleImportSong = async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      try {
        const song = await parseFile(file);
        if (song) socket.emit("song:add", song);
      } catch { /* skip */ }
    }
  };

  const handleAddSong = (song: Song) => socket.emit("song:add", song);
  const handleUpdateSong = (song: Song) => socket.emit("song:update", song);
  const handleDeleteSong = (songId: string) => socket.emit("song:delete", songId);

  const handleAddCamera = (camera: Camera, stream?: MediaStream) => {
    setCameras((prev) => (prev.some((item) => item.id === camera.id) ? prev : [...prev, camera]));
    if (stream) {
      setLocalStreams((prev) => ({ ...prev, [camera.id]: stream }));
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

    setLocalStreams((prev) => {
      const next = { ...prev };
      const stream = next[cameraId];
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      delete next[cameraId];
      return next;
    });

    setRemoteStreams((prev) => {
      const next = { ...prev };
      delete next[cameraId];
      return next;
    });

    const pc = peerConnectionsRef.current[cameraId];
    if (pc) {
      pc.close();
      delete peerConnectionsRef.current[cameraId];
    }
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

  useEffect(() => {
    return () => {
      Object.values(localStreams).forEach((stream) => stream.getTracks().forEach((track) => track.stop()));
    };
  }, [localStreams]);

  const startStream = () => {
    if (!streamKey.trim()) {
      setStreamStatus("Error: Stream Key is required");
      return;
    }
    setStreamStatus("Connecting...");
    socket.emit("stream:start", { rtmpUrl, streamKey, scene: activeScene, cameraId: activeCameraId });
  };

  const stopStream = () => {
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
                    {overlayEnabled && (
                      <DraggableOverlay position={overlayPos} onPositionChange={handleOverlayDrag}>
                        <div className="overlay-lyrics">
                          <p>{activeSong.slides[currentSlide]?.text}</p>
                          <span className="overlay-section">{activeSong.slides[currentSlide]?.section} • {activeCamera.name}</span>
                        </div>
                      </DraggableOverlay>
                    )}
                  </>
                ) : snapshotFrames[activeCamera?.id] ? (
                  <>
                    <img src={snapshotFrames[activeCamera.id]} alt={activeCamera.name} className="program-video" style={{ objectFit: "cover" }} />
                    <span style={{ position: "absolute", top: 6, right: 8, fontSize: 10, background: "rgba(0,0,0,0.6)", padding: "2px 6px", borderRadius: 4, color: "#f59e0b" }}>RELAY</span>
                    {overlayEnabled && (
                      <DraggableOverlay position={overlayPos} onPositionChange={handleOverlayDrag}>
                        <div className="overlay-lyrics">
                          <p>{activeSong.slides[currentSlide]?.text}</p>
                          <span className="overlay-section">{activeSong.slides[currentSlide]?.section} • {activeCamera.name}</span>
                        </div>
                      </DraggableOverlay>
                    )}
                  </>
                ) : (
                  <div>
                    <p>{activeSong.slides[currentSlide]?.text}</p>
                    <p className="camera-name">{activeCamera.name}</p>
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
                <div className="overlay-presets">
                  {(["lower-third", "top-bar", "pip-corner", "full"] as const).map((l) => (
                    <button key={l} type="button" className={`button ${overlayLayout === l ? "primary" : "subtle"}`} style={{ padding: "6px 10px", fontSize: 11 }} onClick={() => changeOverlayLayout(l)}>
                      {l === "lower-third" ? "Lower Third" : l === "top-bar" ? "Top Bar" : l === "pip-corner" ? "PIP Corner" : "Full"}
                    </button>
                  ))}
                  {overlayLayout === "custom" && <span style={{ fontSize: 11, color: "var(--accent)" }}>Custom (drag to move)</span>}
                </div>
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
          <SceneControlPanel activeScene={activeScene} onSceneChange={triggerScene} />
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
          <section className="scene-panel">
            <div className="panel-header"><p>Standby &amp; Background</p></div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <button type="button" className={`button ${standby ? "danger" : "outline"}`} style={{ flex: 1 }} onClick={toggleStandby}>
                {standby ? "⏸ Standby ON" : "▶ Go Live View"}
              </button>
            </div>
            <label style={{ display: "block", marginBottom: 6, fontSize: 12, color: "var(--muted)" }}>
              Background Color
              <input type="color" value={background.value} onChange={(e) => changeBackground("color", e.target.value)} style={{ width: "100%", height: 32, border: "none", borderRadius: 6, cursor: "pointer" }} />
            </label>
          </section>
          <AudioMonitorPanel />
          <CameraDiscoveryPanel onAddCamera={handleAddCamera} />
          <LocalCameraPanel onAddCamera={handleAddCamera} />
          <MobileCameraInvitePanel />
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
          Scene: {activeScene}
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
    </div>
  );
}
