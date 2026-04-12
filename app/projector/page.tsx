"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createSocketClient } from "@/src/lib/socket";
import * as songStore from "@/src/lib/songStore";
import { DraggableOverlay, LAYOUT_PRESETS, type OverlayPosition } from "@/src/components/DraggableOverlay";
import type { Song } from "@/src/types/production";

const socket = createSocketClient();

export default function ProjectorPage() {
  const [songs, setSongs] = useState<Song[]>(songStore.getSongs);
  const [currentSongId, setCurrentSongId] = useState(() => songStore.getSongs()[0]?.id ?? "");
  const [slideIndex, setSlideIndex] = useState(0);
  const [overlayEnabled, setOverlayEnabled] = useState(true);
  const [overlayPos, setOverlayPos] = useState<OverlayPosition>(LAYOUT_PRESETS["lower-third"]);
  const [hasVideoStream, setHasVideoStream] = useState(false);
  const [connected, setConnected] = useState(false);
  const [standby, setStandby] = useState(false);
  const [background, setBackground] = useState<{ type: string; value: string }>({ type: "color", value: "#000000" });
  const [activeScene, setActiveScene] = useState("worship");
  const [showNav, setShowNav] = useState(false);
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
    });
    socket.on("control:standby", (enabled: boolean) => setStandby(enabled));
    socket.on("control:background", (bg: { type: string; value: string }) => setBackground(bg));

    socket.on("stream:overlayToggled", (payload: { enabled: boolean }) => {
      setOverlayEnabled(payload.enabled);
    });

    socket.on("stream:overlayPosition", (pos: OverlayPosition) => {
      setOverlayPos(pos);
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
      socket.off("projector:offer");
      socket.off("projector:candidate");
      pcRef.current?.close();
      unsubscribe();
    };
  }, []);

  const currentSlide = song?.slides[slideIndex] ?? song?.slides[0];

  return (
    <main className="projector-screen" style={{ background: background.type === "color" ? background.value : undefined }}>
      {/* Standby mode */}
      {standby && (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", zIndex: 20, background: "inherit" }}>
          <div style={{ textAlign: "center", color: "#ffffff80" }}>
            <p style={{ fontSize: 48, fontWeight: 700 }}>⏸</p>
            <p style={{ fontSize: 24 }}>Standby</p>
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
        <div className="projector-content">
          <p className="projector-line" key={`${song?.id}-${slideIndex}`}>
            {currentSlide.text}
          </p>
          <p className="projector-section">
            {currentSlide.section} • {song?.title}
          </p>
        </div>
      )}

      {/* Lyrics overlay on top of video */}
      {!standby && hasVideoStream && overlayEnabled && currentSlide && (
        <DraggableOverlay position={overlayPos} interactive={false}>
          <div className="overlay-lyrics projector-overlay-lyrics">
            <p key={`${song?.id}-${slideIndex}`}>{currentSlide.text}</p>
            <span className="overlay-section">{currentSlide.section} • {song?.title}</span>
          </div>
        </DraggableOverlay>
      )}
    </main>
  );
}
