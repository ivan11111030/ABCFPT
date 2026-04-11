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
import { createSocketClient } from "@/src/lib/socket";
import { sampleCameras, sampleSongs } from "@/src/lib/fakeData";
import type { Camera, CameraTransition, SceneMode, Song } from "@/src/types/production";

const socket = createSocketClient();

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
  const [leftWidth, setLeftWidth] = useState(280);
  const [rightWidth, setRightWidth] = useState(320);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [localStreams, setLocalStreams] = useState<Record<string, MediaStream>>({});
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
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
    socket.on("device:update", () => setConnected(true));
    socket.on("control:slide", (nextSlide: number) => setCurrentSlide(nextSlide));
    socket.on("control:camera", (cameraId: string) => setActiveCameraId(cameraId));
    socket.on("camera:list", (cameraList: Camera[]) => setCameras(cameraList));
    socket.on("camera:added", (camera: Camera) => {
      setCameras((prev) => {
        if (prev.some((item) => item.id === camera.id)) return prev;
        return [...prev, { ...camera, status: "online" as const }];
      });
    });
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
        pc = new RTCPeerConnection({
          iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
        });

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

    return () => {
      unsubscribeAuth();
      socket.off("connect");
      socket.off("disconnect");
      socket.off("device:update");
      socket.off("control:slide");
      socket.off("control:camera");
      socket.off("camera:list");
      socket.off("camera:added");
      socket.off("mobile-camera:joined");
      socket.off("mobile-camera:offer");
      socket.off("mobile-camera:candidate");

      Object.values(peerConnectionsRef.current).forEach((pc) => pc.close());
      peerConnectionsRef.current = {};
    };
  }, [router]);

  const activeSong = useMemo(() => songs.find((song) => song.id === activeSongId) ?? songs[0], [activeSongId, songs]);
  const activeCamera = useMemo(() => cameras.find((c) => c.id === activeCameraId) ?? cameras[0], [activeCameraId, cameras]);
  const previewCamera = useMemo(() => cameras.find((c) => c.id === previewCameraId) ?? cameras[1] ?? cameras[0], [previewCameraId, cameras]);

  const triggerScene = (scene: SceneMode) => {
    setActiveScene(scene);
    socket.emit("control:scene", { scene, cameraId: activeCameraId, transition: cameraTransition });
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
  };

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
    setIsLive(true);
    socket.emit("stream:start", { rtmpUrl, streamKey, scene: activeScene, cameraId: activeCameraId });
  };

  const stopStream = () => {
    setIsLive(false);
    socket.emit("stream:stop", { scene: activeScene, cameraId: activeCameraId });
  };

  const toggleOverlay = () => {
    socket.emit("stream:toggleOverlay", { enabled: true });
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
        showRightPanel={showRightPanel}
        onToggleRightPanel={() => setShowRightPanel((s) => !s)}
      />

      {/* 3-PANEL BODY */}
      <div className="control-body" style={{ gridTemplateColumns: showRightPanel ? `${leftWidth}px 6px 1fr 6px ${rightWidth}px` : `${leftWidth}px 6px 1fr` }}>
        {/* LEFT: SETLIST */}
        <div className="control-left">
          <SetlistPanel songs={songs} activeSongId={activeSongId} onSelectSong={selectSong} onReorder={handleReorderSong} />
        </div>

        {/* LEFT RESIZE HANDLE */}
        <div className="resize-handle" onMouseDown={(e) => onMouseDown("left", e)} />

        {/* CENTER: PROGRAM/PREVIEW + LYRICS */}
        <div className="control-center">
          <div className="program-preview-stack">
            {/* PROGRAM (LIVE) */}
            <div className="program-box">
              <span className="box-label">Program (Live)</span>
              <div className="box-content">
                {streamByCamera[activeCamera?.id] ? (
                  <video ref={programVideoRef} autoPlay muted playsInline className="program-video" />
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
                  <video ref={previewVideoRef} autoPlay muted playsInline className="preview-video" />
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
              TAKE
            </button>
          </div>

          <LyricsPreviewPanel song={activeSong} currentSlide={currentSlide} onJumpToSlide={jumpToSection} />
        </div>

        {/* RIGHT RESIZE HANDLE */}
        {showRightPanel && <div className="resize-handle" onMouseDown={(e) => onMouseDown("right", e)} />}

        {/* RIGHT: PRODUCTION CONTROLS */}
        {showRightPanel && (
        <div className="control-right">
          <CameraPreviewPanel cameras={cameras} activeCameraId={previewCameraId} onSelectCamera={selectCamera} onRemoveCamera={handleRemoveCamera} />
          <CameraTransitionPanel transition={cameraTransition} onChangeTransition={changeTransition} />
          <SceneControlPanel activeScene={activeScene} onSceneChange={triggerScene} />
          <LivestreamStudioPanel
            activeScene={activeScene}
            activeCamera={activeCamera}
            transition={cameraTransition}
            isLive={isLive}
            onStart={startStream}
            onStop={stopStream}
            onToggleOverlay={toggleOverlay}
            onChangeRtmpUrl={setRtmpUrl}
            onChangeStreamKey={setStreamKey}
          />
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
          Prev Slide
        </button>
        <button type="button" className="button primary" onClick={() => triggerSlide("next")}>
          Next Slide
        </button>
        <button type="button" className="button success" onClick={handleNextSong}>
          Next Song
        </button>
        <button type="button" className="button subtle" onClick={() => triggerScene(activeScene)}>
          Scene: {activeScene}
        </button>
      </div>
    </div>
  );
}
