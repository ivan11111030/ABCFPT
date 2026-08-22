"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { createSocketClient } from "@/src/lib/socket";
import * as songStore from "@/src/lib/songStore";
import { DraggableOverlay, LAYOUT_PRESETS, type OverlayPosition } from "@/src/components/DraggableOverlay";
import type { Song, BackgroundConfig } from "@/src/types/production";
import type { SceneConfig, SceneType } from "@/src/types/scene";
import type { ServerStateSync, ControlScenePayload } from "@/src/types/socketEvents";

const socket = createSocketClient();

export default function ProjectorPage() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [currentSongId, setCurrentSongId] = useState("");
  const [slideIndex, setSlideIndex] = useState(0);
  const [overlayEnabled, setOverlayEnabled] = useState(true);
  const [overlayPos, setOverlayPos] = useState<OverlayPosition>(LAYOUT_PRESETS["lower-third"]);
  const [overlayOpacity, setOverlayOpacity] = useState(100);
  const [overlayHeight, setOverlayHeight] = useState(25);
  const [projectorFontSize, setProjectorFontSize] = useState(42);
  const [hasVideoStream, setHasVideoStream] = useState(false);
  const [connected, setConnected] = useState(false);
  const [standby, setStandby] = useState(false);
  const [background, setBackground] = useState<BackgroundConfig>({ type: "color", value: "#000000", opacity: 100 });
  const [activeScene, setActiveScene] = useState("worship");
  const [activeSceneType, setActiveSceneType] = useState<SceneType>("worship");
  const [sceneConfig, setSceneConfig] = useState<SceneConfig | null>(null);
  const [canvaOverlayImage, setCanvaOverlayImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    const loadedSongs = songStore.getSongs();
    setSongs(loadedSongs);
    setCurrentSongId((current) => current || (loadedSongs[0]?.id ?? ""));
  }, []);

  const song = songs.find((s) => s.id === currentSongId) ?? songs[0];
  const slideCount = song?.slides?.length ?? 0;
  const safeSlideIndex = Math.min(Math.max(slideIndex, 0), Math.max(slideCount - 1, 0));
  const currentSlide = song?.slides?.[safeSlideIndex] ?? song?.slides?.[0];
  const slideTransition = currentSlide?.transition;
  const transitionClass = slideTransition ? `slide-transition-${slideTransition.type}` : "slide-transition-fade";
  const slideTextStyle = currentSlide?.textStyle;
  const showRenderedImage = Boolean(
    currentSlide?.renderedImage && (!currentSlide.text || currentSlide.text === "(Visual slide – no text)")
  );
  const lyricStyle: CSSProperties = {
    fontFamily: slideTextStyle?.fontFamily || undefined,
    fontSize: `${projectorFontSize}px`,
    color: slideTextStyle?.color ?? "#ffffff",
    textAlign: slideTextStyle?.align ?? "center",
    fontWeight: slideTextStyle?.bold === undefined ? 700 : slideTextStyle.bold ? 700 : 400,
    fontStyle: slideTextStyle?.italic ? "italic" : "normal",
  };

  useEffect(() => {
    if (slideIndex !== safeSlideIndex) {
      setSlideIndex(safeSlideIndex);
    }
  }, [safeSlideIndex, slideIndex]);

  useEffect(() => {
    socket.on("connect", () => {
      setConnected(true);
      socket.emit("display:requestSync");
    });
    socket.on("disconnect", () => setConnected(false));

    if (socket.connected) {
      socket.emit("display:requestSync");
    }

    socket.on("state:sync", (serverState: ServerStateSync) => {
      setConnected(true);
      if (serverState.songs?.length) songStore.mergeFromServer(serverState.songs as Song[]);
      if (serverState.currentSongId) setCurrentSongId(serverState.currentSongId);
      if (serverState.currentSlide !== undefined) setSlideIndex(serverState.currentSlide);
      if (serverState.overlayEnabled !== undefined) setOverlayEnabled(serverState.overlayEnabled);
      if (serverState.overlayPosition) setOverlayPos(serverState.overlayPosition as OverlayPosition);
      if (serverState.standby !== undefined) setStandby(serverState.standby);
      if (serverState.background) setBackground(serverState.background as BackgroundConfig);
      if (serverState.currentScene) setActiveScene(serverState.currentScene);
      if (serverState.sceneType) setActiveSceneType(serverState.sceneType as SceneType);
      if (serverState.sceneConfig) {
        const sceneConfig = serverState.sceneConfig as SceneConfig;
        setSceneConfig(sceneConfig);
        if (sceneConfig.background) setBackground(sceneConfig.background);
      }
      if (serverState.projectorFontSize !== undefined) setProjectorFontSize(serverState.projectorFontSize);
    });

    socket.on("display:projectorFontSize", (size: number) => {
      setProjectorFontSize(size);
    });

    socket.on("control:slide", (idx: number) => setSlideIndex(idx));
    socket.on("control:song", (songId: string) => {
      setCurrentSongId(songId);
      setSlideIndex(0);
    });
    socket.on("song:list", (songList: Song[]) => songStore.setSongs(songList));
    socket.on("control:scene", (payload: ControlScenePayload) => {
      if (typeof payload === "string") {
        setActiveScene(payload);
        return;
      }

      const scene = payload.scene;
      if (scene) setActiveScene(scene);
      if (payload.sceneType) setActiveSceneType(payload.sceneType as SceneType);
      if (payload.sceneConfig) {
        const sceneConfig = payload.sceneConfig as SceneConfig;
        setSceneConfig(sceneConfig);
        if (sceneConfig.background) setBackground(sceneConfig.background as BackgroundConfig);
      }
    });
    socket.on("control:standby", (enabled: boolean) => setStandby(enabled));
    socket.on("control:background", (bg: BackgroundConfig) => setBackground(bg));
    socket.on("stream:overlayToggled", (payload: { enabled: boolean }) => setOverlayEnabled(payload.enabled));
    socket.on("stream:overlayPosition", (pos: OverlayPosition) => setOverlayPos(pos));
    socket.on("stream:overlayOpacity", (opacity: number) => setOverlayOpacity(opacity));
    socket.on("stream:overlayHeight", (height: number) => setOverlayHeight(height));
    socket.on("stream:canvaOverlay", (imageUrl: string | null) => setCanvaOverlayImage(imageUrl));

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
      socket.off("display:projectorFontSize");
      socket.off("projector:offer");
      socket.off("projector:candidate");
      pcRef.current?.close();
      unsubscribe();
    };
  }, []);

  const bgLayerStyle: CSSProperties = {
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
    (bgLayerStyle as CSSProperties & { animation?: string }).animation = "bg-animate 8s ease infinite";
  }

  const displayText = currentSlide?.text || "Waiting for content";
  const displaySection = currentSlide?.section || "No section";
  const displayTitle = song?.title || "No song selected";

  return (
    <main className="projector-screen">
      <div style={bgLayerStyle} />

      {standby && (
        <div className="projector-standby">
          <div className="projector-standby-card">
            <p className="projector-standby-icon">⏸</p>
            <p className="projector-standby-title">{sceneConfig?.standbyText || "Standby"}</p>
          </div>
        </div>
      )}

      <div className="projector-topbar">
        <Link href="/control" className="projector-link">
          ← Back to Control
        </Link>
        <div className={`projector-status-pill ${connected ? "is-connected" : "is-disconnected"}`}>
          {connected ? "● Connected" : "● Disconnected"} • {activeScene} • Slide {safeSlideIndex + 1}/{slideCount || 1}
        </div>
      </div>

      {!standby && (
        <div className="projector-stage">
          {hasVideoStream && <video ref={videoRef} autoPlay muted playsInline className="projector-video-bg" />}

          <div className="projector-content-shell">
            {showRenderedImage ? (
              <img src={currentSlide.renderedImage} alt={displaySection} className="projector-rendered-image" />
            ) : (
              <>
                <p
                  className={`projector-line ${transitionClass}`}
                  style={lyricStyle}
                >
                  {displayText}
                </p>
                <p className="projector-section" style={{ textAlign: slideTextStyle?.align ?? "center" }}>
                  {displaySection} • {displayTitle}
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {!standby && canvaOverlayImage && (
        <div className="canva-overlay-image">
          <img src={canvaOverlayImage} alt="Canva overlay" />
        </div>
      )}

      {!standby && sceneConfig && sceneConfig.overlays.filter((overlay) => overlay.visible && overlay.type !== "lyrics").map((overlay) => (
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

      {!standby && hasVideoStream && overlayEnabled && currentSlide && (
        <DraggableOverlay position={overlayPos} interactive={false} opacity={overlayOpacity} height={overlayHeight}>
          <div className={`overlay-lyrics projector-overlay-lyrics ${transitionClass}`}>
            {showRenderedImage ? (
              <img src={currentSlide.renderedImage} alt={displaySection} style={{ maxWidth: "100%", borderRadius: 8 }} />
            ) : (
              <p style={lyricStyle}>{displayText}</p>
            )}
            <span className="overlay-section">{displaySection} • {displayTitle}</span>
          </div>
        </DraggableOverlay>
      )}
    </main>
  );
}
