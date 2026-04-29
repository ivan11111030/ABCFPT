"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createSocketClient } from "@/src/lib/socket";
import * as songStore from "@/src/lib/songStore";
import { DraggableOverlay, LAYOUT_PRESETS, type OverlayPosition } from "@/src/components/DraggableOverlay";
import type { Song, BackgroundConfig } from "@/src/types/production";
import type { SceneConfig, SceneType } from "@/src/types/scene";
import { DEFAULT_SCENE_CONFIGS } from "@/src/types/scene";

const socket = createSocketClient();

export default function ProjectorPage() {
  const [songs, setSongs] = useState<Song[]>(songStore.getSongs);
  const [currentSongId, setCurrentSongId] = useState(() => songStore.getSongs()[0]?.id ?? "");
  const [slideIndex, setSlideIndex] = useState(0);
  const [overlayEnabled, setOverlayEnabled] = useState(true);
  const [overlayPos, setOverlayPos] = useState<OverlayPosition>(LAYOUT_PRESETS["lower-third"]);
  const [overlayOpacity, setOverlayOpacity] = useState(100);
  const [overlayHeight, setOverlayHeight] = useState(25);
  const [hasVideoStream, setHasVideoStream] = useState(false);
  const [connected, setConnected] = useState(false);
  const [standby, setStandby] = useState(false);
  const [background, setBackground] = useState<BackgroundConfig>({ type: "color", value: "#000000", opacity: 100 });
  const [activeScene, setActiveScene] = useState("worship");
  const [activeSceneType, setActiveSceneType] = useState<SceneType>("worship");
  const [sceneConfig, setSceneConfig] = useState<SceneConfig | null>(null);
  const [showNav, setShowNav] = useState(false);
  const [canvaOverlayImage, setCanvaOverlayImage] = useState<string | null>(null);
  const [prevSlideIndex, setPrevSlideIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  const song = songs.find((s) => s.id === currentSongId) ?? songs[0];

  useEffect(() => {
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    // Full state sync from server on connect
    socket.on("state:sync", (serverState: any) => {
      setConnected(true);
      if (serverState.songs?.length) songStore.mergeFromServer(serverState.songs);
      if (serverState.currentSongId) setCurrentSongId(serverState.currentSongId);
      if (serverState.currentSlide !== undefined) setSlideIndex(serverState.currentSlide);
      if (serverState.overlayEnabled !== undefined) setOverlayEnabled(serverState.overlayEnabled);
      if (serverState.overlayPosition) setOverlayPos(serverState.overlayPosition);
      if (serverState.standby !== undefined) setStandby(serverState.standby);
      if (serverState.background) setBackground(serverState.background);
      if (serverState.currentScene) setActiveScene(serverState.currentScene);
    });

    // Live updates
    socket.on("control:slide", (idx: number) => setSlideIndex(idx));
    socket.on("control:song", (songId: string) => {
      setCurrentSongId(songId);
      setSlideIndex(0);
    });
    socket.on("song:list", (songList: Song[]) => songStore.setSongs(songList));
    socket.on("control:scene", (payload: any) => {
      const scene = typeof payload === "string" ? payload : payload.scene;
      if (scene) setActiveScene(scene);
      if (payload?.sceneType) setActiveSceneType(payload.sceneType);
      if (payload?.sceneConfig) {
        setSceneConfig(payload.sceneConfig);
        // Apply scene background
        if (payload.sceneConfig.background) setBackground(payload.sceneConfig.background);
      }
    });
    socket.on("control:standby", (enabled: boolean) => setStandby(enabled));
    socket.on("control:background", (bg: BackgroundConfig) => setBackground(bg));

    socket.on("stream:overlayToggled", (payload: { enabled: boolean }) => {
      setOverlayEnabled(payload.enabled);
    });

    socket.on("stream:overlayPosition", (pos: OverlayPosition) => {
      setOverlayPos(pos);
    });

    socket.on("stream:overlayOpacity", (opacity: number) => {
      setOverlayOpacity(opacity);
    });

    socket.on("stream:overlayHeight", (height: number) => {
      setOverlayHeight(height);
    });

    socket.on("stream:canvaOverlay", (imageUrl: string | null) => {
      setCanvaOverlayImage(imageUrl);
    });

    // Receive the active camera's WebRTC offer forwarded by control
    socket.on("projector:offer", async (payload: { description: RTCSessionDescriptionInit }) => {
      if (!payload.description?.type) return;

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
      });
      pcRef.current = pc;

      pc.ontrack = (event) => {
        const [stream] = event.streams;
        if (stream && videoRef.current) {
          videoRef.current.srcObject = stream;
          setHasVideoStream(true);
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("projector:candidate", event.candidate);
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(payload.description));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("projector:answer", answer);
    });

    socket.on("projector:candidate", async (candidate: RTCIceCandidateInit) => {
      if (pcRef.current && candidate?.candidate) {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    const unsubscribe = songStore.subscribe(() => {
      setSongs(songStore.getSongs());
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("state:sync");
      socket.off("control:slide");
      socket.off("control:song");
      socket.off("song:list");
      socket.off("control:scene");
      socket.off("control:standby");
      socket.off("control:background");
      socket.off("stream:overlayToggled");
      socket.off("stream:overlayPosition");
      socket.off("stream:overlayOpacity");
      socket.off("stream:overlayHeight");
      socket.off("stream:canvaOverlay");
      socket.off("projector:offer");
      socket.off("projector:candidate");
      pcRef.current?.close();
      unsubscribe();
    };
  }, []);

  const currentSlide = song?.slides[slideIndex] ?? song?.slides[0];
  const slideTransition = currentSlide?.transition;
  const transitionClass = slideTransition ? `slide-transition-${slideTransition.type}` : "slide-transition-fade";

  // Track slide changes for transition animation
  useEffect(() => {
    setPrevSlideIndex(slideIndex);
  }, [slideIndex]);

  // Compute background layer style (applied to a dedicated layer, not <main>, so opacity never affects text)
  const bgLayerStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    zIndex: 0,
    opacity: (background.opacity ?? 100) / 100,
  };
  if (background.type === "color") {
    bgLayerStyle.background = background.value;
  } else if (background.type === "image") {
    bgLayerStyle.backgroundImage = `url(${background.value})`;
    bgLayerStyle.backgroundSize = "cover";
    bgLayerStyle.backgroundPosition = "center";
  } else if (background.type === "animated") {
    bgLayerStyle.background = background.value;
    bgLayerStyle.backgroundSize = "400% 400%";
    (bgLayerStyle as any).animation = "bg-animate 8s ease infinite";
  }

  return (
    <main className="projector-screen" style={{ background: "#000" }}>
      {/* Unified background layer — opacity only affects this layer, never text */}
      <div style={bgLayerStyle} />

      {/* Standby mode */}
      {standby && (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", zIndex: 20, background: "inherit" }}>
          <div style={{ textAlign: "center", color: "#ffffff80" }}>
            <p style={{ fontSize: 48, fontWeight: 700 }}>⏸</p>
            <p style={{ fontSize: 24 }}>{sceneConfig?.standbyText || "Standby"}</p>
          </div>
        </div>
      )}

      {/* Connection status + back nav (hover to show) */}
      <div
        style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 30, padding: "8px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", opacity: showNav ? 1 : 0, transition: "opacity 0.3s", background: "rgba(0,0,0,0.7)" }}
        onMouseEnter={() => setShowNav(true)}
        onMouseLeave={() => setShowNav(false)}
      >
        <Link href="/control" style={{ color: "#fff", textDecoration: "none", fontSize: 14, padding: "6px 12px", background: "rgba(255,255,255,0.15)", borderRadius: 8 }}>
          ← Back to Control
        </Link>
        <span style={{ color: connected ? "var(--success)" : "var(--danger)", fontSize: 12 }}>
          {connected ? "🟢 Connected" : "🔴 Disconnected"} • Scene: {activeScene} • Slide {slideIndex + 1}/{song?.slides.length ?? 0}
        </span>
      </div>
      {/* Invisible hover trigger at top */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 30, zIndex: 31 }} onMouseEnter={() => setShowNav(true)} />

      {/* Video background when stream is available */}
      {!standby && hasVideoStream && (
        <video ref={videoRef} autoPlay muted playsInline className="projector-video-bg" />
      )}

      {/* If no video stream, show lyrics fullscreen (classic mode) */}
      {!standby && !hasVideoStream && currentSlide && (
        <div className={`projector-content ${transitionClass}`} key={`${song?.id}-${slideIndex}`}>
          {currentSlide.renderedImage ? (
            <img src={currentSlide.renderedImage} alt={currentSlide.section} className="pptx-rendered-slide" />
          ) : (
            <>
              <p
                className="projector-line"
                style={{
                  fontFamily: currentSlide.textStyle?.fontFamily,
                  fontSize: currentSlide.textStyle?.fontSize ? `${currentSlide.textStyle.fontSize}px` : undefined,
                  color: currentSlide.textStyle?.color ?? "#fff",
                  textAlign: currentSlide.textStyle?.align ?? "center",
                  fontWeight: currentSlide.textStyle?.bold ? 700 : undefined,
                  fontStyle: currentSlide.textStyle?.italic ? "italic" : undefined,
                }}
              >
                {currentSlide.text}
              </p>
              <p className="projector-section">
                {currentSlide.section} • {song?.title}
              </p>
            </>
          )}
        </div>
      )}

      {/* Canva overlay image */}
      {!standby && canvaOverlayImage && (
        <div className="canva-overlay-image"><img src={canvaOverlayImage} alt="Canva overlay" /></div>
      )}

      {/* Scene config overlays */}
      {!standby && sceneConfig && sceneConfig.overlays.filter((o) => o.visible && o.type !== "lyrics").map((overlay) => (
        <DraggableOverlay
          key={overlay.id}
          position={overlay.position}
          interactive={false}
          opacity={overlay.opacity}
          height={overlay.height}
        >
          {overlay.type === "image" && overlay.imageUrl ? (
            <img src={overlay.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          ) : overlay.type === "lower-third" ? (
            <div className="scene-lower-third" style={{ fontFamily: overlay.textStyle?.fontFamily, color: overlay.textStyle?.color, textAlign: overlay.textStyle?.align }}>
              <strong style={{ fontSize: overlay.textStyle?.fontSize, fontWeight: overlay.textStyle?.bold === false ? 400 : 700, fontStyle: overlay.textStyle?.italic ? "italic" : undefined }}>{overlay.text}</strong>
              {overlay.subtitle && <span>{overlay.subtitle}</span>}
            </div>
          ) : (
            <div className="scene-text-box" style={{ fontFamily: overlay.textStyle?.fontFamily, fontSize: overlay.textStyle?.fontSize, color: overlay.textStyle?.color ?? "#fff", textAlign: overlay.textStyle?.align, fontWeight: overlay.textStyle?.bold ? 700 : undefined, fontStyle: overlay.textStyle?.italic ? "italic" : undefined }}>
              <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{overlay.text}</p>
            </div>
          )}
        </DraggableOverlay>
      ))}

      {/* Lyrics overlay on top of video */}
      {!standby && hasVideoStream && overlayEnabled && currentSlide && (
        <DraggableOverlay position={overlayPos} interactive={false} opacity={overlayOpacity} height={overlayHeight}>
          <div className={`overlay-lyrics projector-overlay-lyrics ${transitionClass}`} key={`${song?.id}-${slideIndex}`}>
            {currentSlide.renderedImage ? (
              <img src={currentSlide.renderedImage} alt={currentSlide.section} style={{ maxWidth: "100%", borderRadius: 8 }} />
            ) : (
              <p>{currentSlide.text}</p>
            )}
            <span className="overlay-section">{currentSlide.section} • {song?.title}</span>
          </div>
        </DraggableOverlay>
      )}
    </main>
  );
}
