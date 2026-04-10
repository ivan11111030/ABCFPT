"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/src/lib/firebase";
import { TopBar } from "@/src/components/TopBar";
import { SetlistPanel } from "@/src/components/SetlistPanel";
import { LyricsPreviewPanel } from "@/src/components/LyricsPreviewPanel";
import { SceneControlPanel } from "@/src/components/SceneControlPanel";
import { SlideControls } from "@/src/components/SlideControls";
import { AudioMonitorPanel } from "@/src/components/AudioMonitorPanel";
import { SyncStatusBadge } from "@/src/components/SyncStatusBadge";
import { CameraPreviewPanel } from "@/src/components/CameraPreviewPanel";
import { CameraTransitionPanel } from "@/src/components/CameraTransitionPanel";
import { CameraDiscoveryPanel } from "@/src/components/CameraDiscoveryPanel";
import { MobileCameraInvitePanel } from "@/src/components/MobileCameraInvitePanel";
import { LivestreamStudioPanel } from "@/src/components/LivestreamStudioPanel";
import { createSocketClient } from "@/src/lib/socket";
import { sampleCameras, sampleSongs } from "@/src/lib/fakeData";
import type { Camera, CameraTransition, SceneMode, Song } from "@/src/types/production";

const socket = createSocketClient();

export default function ControlPage() {
  const [songs, setSongs] = useState<Song[]>(sampleSongs);
  const [activeSongId, setActiveSongId] = useState(sampleSongs[0].id);
  const [activeScene, setActiveScene] = useState<SceneMode>("worship");
  const [activeCameraId, setActiveCameraId] = useState<string>(sampleCameras[0].id);
  const [cameraTransition, setCameraTransition] = useState<CameraTransition>("cut");
  const [cameras, setCameras] = useState<Camera[]>(sampleCameras);
  const [connected, setConnected] = useState(false);
  const [featureNavVisible, setFeatureNavVisible] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [rtmpUrl, setRtmpUrl] = useState("rtmp://live-api.facebook.com:80/rtmp/");
  const [streamKey, setStreamKey] = useState("");
  const [isLive, setIsLive] = useState(false);

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
      setCameras((prev) => (prev.some((item) => item.id === camera.id) ? prev : [...prev, camera]));
    });
    socket.on("mobile-camera:joined", (mobileCameraData: any) => {
      setCameras((prev) => [
        ...prev,
        {
          id: `mobile-${Date.now()}`,
          name: `Mobile Camera (${mobileCameraData.device || "Remote"})`, 
          protocol: "WebRTC",
          ipAddress: "",
          streamUrl: "webrtc://mobile",
          status: "online",
          supportsPTZ: false,
          isMobile: true,
          enabled: true,
          signalStrength: "good",
        },
      ]);
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
    };
  }, [router]);

  const activeSong = useMemo(() => songs.find((song) => song.id === activeSongId) ?? songs[0], [activeSongId, songs]);

  const triggerScene = (scene: SceneMode) => {
    setActiveScene(scene);
    socket.emit("control:scene", { scene, cameraId: activeCameraId, transition: cameraTransition });
  };

  const selectCamera = (cameraId: string) => {
    setActiveCameraId(cameraId);
    socket.emit("control:camera", cameraId);
  };

  const changeTransition = (transition: CameraTransition) => {
    setCameraTransition(transition);
    socket.emit("control:camera:transition", transition);
  };

  const handleReorderSong = (sourceSongId: string, targetSongId: string) => {
    const sourceIndex = songs.findIndex((song) => song.id === sourceSongId);
    const targetIndex = songs.findIndex((song) => song.id === targetSongId);

    if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
      return;
    }

    const nextSongs = [...songs];
    const [movedSong] = nextSongs.splice(sourceIndex, 1);
    nextSongs.splice(targetIndex, 0, movedSong);
    setSongs(nextSongs);
  };

  const handleAddCamera = (camera: Camera) => {
    setCameras((prev) => (prev.some((item) => item.id === camera.id) ? prev : [...prev, camera]));
  };

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

  return (
    <div className="control-shell">
      <TopBar title="Production Control" badge={connected ? "Live Sync" : "Offline"} />
      <div className="control-layout">
        <aside className={`feature-nav ${featureNavVisible ? "open" : "collapsed"}`}>
          <div className="panel-header">
            <p>Core Navigation</p>
            <button type="button" className="button subtle" onClick={() => setFeatureNavVisible((current) => !current)}>
              {featureNavVisible ? "Hide" : "Show"}
            </button>
          </div>
          {featureNavVisible ? (
            <div className="feature-nav-list">
              <button type="button" className="nav-item">Setlist</button>
              <button type="button" className="nav-item">Lyrics Preview</button>
              <button type="button" className="nav-item">Livestream Studio</button>
              <button type="button" className="nav-item">Camera Preview</button>
              <button type="button" className="nav-item">Mobile Camera</button>
              <button type="button" className="nav-item">Projector Output</button>
            </div>
          ) : null}
        </aside>
        <div className="control-grid">
          <SetlistPanel songs={songs} activeSongId={activeSongId} onSelectSong={setActiveSongId} onReorder={handleReorderSong} />
          <div className="control-main">
            <LyricsPreviewPanel song={activeSong} currentSlide={currentSlide} />
            <SlideControls onPrevious={() => triggerSlide("previous")} onNext={() => triggerSlide("next")} onJump={jumpToSection} />
          </div>
          <div className="control-sidebar">
            <LivestreamStudioPanel
              activeScene={activeScene}
              activeCamera={cameras.find((camera) => camera.id === activeCameraId) ?? cameras[0]}
              transition={cameraTransition}
              isLive={isLive}
              onStart={startStream}
              onStop={stopStream}
              onToggleOverlay={toggleOverlay}
              onChangeRtmpUrl={setRtmpUrl}
              onChangeStreamKey={setStreamKey}
            />
            <CameraPreviewPanel cameras={cameras} activeCameraId={activeCameraId} onSelectCamera={selectCamera} />
            <CameraTransitionPanel transition={cameraTransition} onChangeTransition={changeTransition} />
            <SceneControlPanel activeScene={activeScene} onSceneChange={triggerScene} />
            <AudioMonitorPanel />
            <CameraDiscoveryPanel onAddCamera={handleAddCamera} />
            <MobileCameraInvitePanel />
            <SyncStatusBadge status={connected ? "connected" : "disconnected"} />
          </div>
        </div>
      </div>
    </div>
  );
}
