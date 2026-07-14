"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createSocketClient } from "@/src/lib/socket";
import * as songStore from "@/src/lib/songStore";
import { DraggableOverlay, LAYOUT_PRESETS, type OverlayPosition } from "@/src/components/DraggableOverlay";
import type { Song, BackgroundConfig } from "@/src/types/production";
import type { SceneConfig, SceneType } from "@/src/types/scene";

const socket = createSocketClient();

export default function ProjectorPage() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [currentSongId, setCurrentSongId] = useState("");
  const [slideIndex, setSlideIndex] = useState(0);
  const [overlayEnabled, setOverlayEnabled] = useState(true);
  const [overlayPos, setOverlayPos] = useState<OverlayPosition>(LAYOUT_PRESETS["lower-third"]);
  const [overlayOpacity, setOverlayOpacity] = useState(100);
  const [overlayHeight, setOverlayHeight] = useState(25);
  const [projectorFontSize, setProjectorFontSize] = useState(56);
  const [hasVideoStream, setHasVideoStream] = useState(false);
  const [connected, setConnected] = useState(false);
  const [standby, setStandby] = useState(false);
  const [background, setBackground] = useState<BackgroundConfig>({ type: "color", value: "#000000", opacity: 100 });
  const [sceneConfig, setSceneConfig] = useState<SceneConfig | null>(null);
  const [canvaOverlayImage, setCanvaOverlayImage] = useState<string | null>(null);
  const [debug, setDebug] = useState<string[]>([]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    const loadedSongs = songStore.getSongs();
    setSongs(loadedSongs);
    setCurrentSongId((current) => current || (loadedSongs[0]?.id ?? ""));
  }, []);

  const song = songs.find((s) => s.id === currentSongId) ?? songs[0];

  useEffect(() => {
    // request full state when we connect so displays always match control
    socket.on("connect", () => {
      setConnected(true);
      socket.emit("display:requestSync");
      appendDebug("socket connect");
    });
    socket.on("disconnect", () => {
      setConnected(false);
      appendDebug("socket disconnect");
    });

    socket.on("state:sync", (serverState: any) => {
      setConnected(true);
      appendDebug("state:sync received");
      if (serverState.songs?.length) songStore.mergeFromServer(serverState.songs);
      if (serverState.currentSongId) setCurrentSongId(serverState.currentSongId);
      if (serverState.currentSlide !== undefined) setSlideIndex(serverState.currentSlide);
      if (serverState.overlayEnabled !== undefined) setOverlayEnabled(serverState.overlayEnabled);
      if (serverState.overlayPosition) setOverlayPos(serverState.overlayPosition);
      if (serverState.overlayOpacity !== undefined) setOverlayOpacity(serverState.overlayOpacity);
      if (serverState.overlayHeight !== undefined) setOverlayHeight(serverState.overlayHeight);
      if (serverState.canvaOverlayImage !== undefined) setCanvaOverlayImage(serverState.canvaOverlayImage);
      if (serverState.standby !== undefined) setStandby(serverState.standby);
      if (serverState.background) setBackground(serverState.background);
      if (serverState.sceneConfig) setSceneConfig(serverState.sceneConfig);
      if (serverState.projectorFontSize !== undefined) setProjectorFontSize(serverState.projectorFontSize);
    });

    socket.on("display:projectorFontSize", (size: number) => setProjectorFontSize(size));
    socket.on("display:teleprompterFontSize", () => {}); // ignore here

    socket.on("stream:overlayToggled", (payload: { enabled: boolean }) => setOverlayEnabled(payload.enabled));
    socket.on("stream:overlayPosition", (pos: OverlayPosition) => setOverlayPos(pos));
    socket.on("stream:overlayOpacity", (opacity: number) => setOverlayOpacity(opacity));
    socket.on("stream:overlayHeight", (height: number) => setOverlayHeight(height));
    socket.on("stream:canvaOverlay", (imageUrl: string | null) => setCanvaOverlayImage(imageUrl));

    // WebRTC offer from control: set up a simple answerer
    socket.on("projector:offer", async (payload: { description?: RTCSessionDescriptionInit }) => {
      try {
        appendDebug("received projector offer");
        if (!payload?.description?.type) return;
        const pc = new RTCPeerConnection({ iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }] });
        pcRef.current = pc;

        pc.ontrack = (ev) => {
          const [stream] = ev.streams;
          if (stream && videoRef.current) {
            videoRef.current.srcObject = stream;
            setHasVideoStream(true);
            appendDebug("video stream attached");
          }
        };

        pc.onicecandidate = (ev) => {
          if (ev.candidate) socket.emit("projector:candidate", ev.candidate);
        };

        await pc.setRemoteDescription(new RTCSessionDescription(payload.description));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("projector:answer", answer);
        appendDebug("sent projector answer");
      } catch (err: any) {
        appendDebug("projector.offer error: " + String(err?.message ?? err));
      }
    });

    socket.on("projector:candidate", async (candidate: RTCIceCandidateInit) => {
      try {
        if (pcRef.current && candidate?.candidate) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (err: any) {
        appendDebug("projector.candidate error: " + String(err?.message ?? err));
      }
    });

    const unsub = songStore.subscribe(() => setSongs(songStore.getSongs()));

    // if socket already connected, request a sync immediately
    if (socket.connected) socket.emit("display:requestSync");

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("state:sync");
      socket.off("display:projectorFontSize");
      socket.off("projector:offer");
      socket.off("projector:candidate");
      socket.off("stream:overlayToggled");
      socket.off("stream:overlayPosition");
      socket.off("stream:overlayOpacity");
      socket.off("stream:overlayHeight");
      socket.off("stream:canvaOverlay");
      pcRef.current?.close();
      unsub();
    };
  }, []);

  const currentSlide = song?.slides[slideIndex] ?? song?.slides[0];
  const effectiveProjectorFontSize = Math.max(projectorFontSize, currentSlide?.textStyle?.fontSize ?? 0, 56);

  function appendDebug(msg: string) {
    setDebug((d) => [msg, ...d].slice(0, 8));
  }

  return (
    <main className="projector-screen" style={{ background: "#000" }}>
      {/* Background layer */}
      <div style={{ position: "absolute", inset: 0, zIndex: 0, opacity: (background.opacity ?? 100) / 100, background: background.type === "color" ? background.value : undefined, backgroundImage: background.type === "image" ? `url(${background.value})` : undefined, backgroundSize: background.type === "image" ? "cover" : undefined }} />

      {/* Standby overlay */}
      {standby && (
        <div style={{ position: "absolute", inset: 0, zIndex: 20, display: "grid", placeItems: "center", color: "#fff" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 64 }}>⏸</div>
            <div style={{ fontSize: 20 }}>{sceneConfig?.standbyText ?? "Standby"}</div>
          </div>
        </div>
      )}

      {/* Hidden nav - hover to show */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 30, padding: "8px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", opacity: 0, transition: "opacity 0.2s" }}>
        <Link href="/control" style={{ color: "#fff" }}>← Back to Control</Link>
        <span style={{ color: connected ? "var(--success)" : "var(--danger)", fontSize: 12 }}>{connected ? "🟢 Connected" : "🔴 Disconnected"}</span>
      </div>

      {/* Video background */}
      {!standby && hasVideoStream && <video ref={videoRef} autoPlay muted playsInline className="projector-video-bg" />}

      {/* Main lyrics/content */}
      {!standby && (!hasVideoStream || !overlayEnabled) && currentSlide && (
        <div className="projector-content" style={{ zIndex: 2 }} key={`${song?.id}-${slideIndex}`}>
          {currentSlide.renderedImage ? (
            <img src={currentSlide.renderedImage} alt={currentSlide.section} className="pptx-rendered-slide" />
          ) : (
            <>
              <p className="projector-line" style={{ fontSize: `${effectiveProjectorFontSize}px`, whiteSpace: "pre-wrap", wordBreak: "break-word", textAlign: "center", color: currentSlide.textStyle?.color ?? "#fff", fontFamily: currentSlide.textStyle?.fontFamily }}>{currentSlide.text}</p>
              <p className="projector-section">{currentSlide.section} • {song?.title}</p>
            </>
          )}
        </div>
      )}

      {/* Canva overlay */}
      {!standby && canvaOverlayImage && (
        <div className="canva-overlay-image" style={{ zIndex: 25 }}><img src={canvaOverlayImage} alt="Canva overlay" /></div>
      )}

      {/* Overlay lyrics on top of video */}
      {!standby && hasVideoStream && overlayEnabled && currentSlide && (
        <DraggableOverlay position={overlayPos} interactive={false} opacity={overlayOpacity} height={overlayHeight}>
          <div className={`overlay-lyrics projector-overlay-lyrics`} key={`${song?.id}-${slideIndex}`}>
            {currentSlide.renderedImage ? (
              <img src={currentSlide.renderedImage} alt={currentSlide.section} style={{ maxWidth: "100%", borderRadius: 8 }} />
            ) : (
              <p style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>{currentSlide.text}</p>
            )}
            <span className="overlay-section">{currentSlide.section} • {song?.title}</span>
          </div>
        </DraggableOverlay>
      )}

      {/* Small debug panel */}
      <div style={{ position: "fixed", right: 12, bottom: 12, zIndex: 60, color: "#9ca3af", fontSize: 12, textAlign: "right" }}>
        <div>Projector • {connected ? "connected" : "offline"}</div>
        <div>Slide: {slideIndex + 1}/{song?.slides.length ?? 0}</div>
        <div style={{ marginTop: 6 }}>{debug.slice(0, 4).map((d, i) => <div key={i}>{d}</div>)}</div>
      </div>
    </main>
  );
}
