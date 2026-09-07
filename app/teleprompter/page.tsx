"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { createSocketClient } from "@/src/lib/socket";
import * as songStore from "@/src/lib/songStore";
import type { BackgroundConfig, Song } from "@/src/types/production";
import type { ServerStateSync } from "@/src/types/socketEvents";

const socket = createSocketClient();

export default function TeleprompterPage() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [currentSongId, setCurrentSongId] = useState("");
  const [slideIndex, setSlideIndex] = useState(0);
  const [fontSize, setFontSize] = useState(42);
  const [darkMode, setDarkMode] = useState(true);
  const [connected, setConnected] = useState(false);
  const [showNav, setShowNav] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [paceSeconds, setPaceSeconds] = useState(8);
  const [background, setBackground] = useState<BackgroundConfig>({ type: "color", value: "#000000", opacity: 100 });

  const song = songs.find((s) => s.id === currentSongId) ?? songs[0];

  useEffect(() => {
    if (!autoAdvance || !song?.slides.length) return;
    const timer = window.setInterval(() => {
      setSlideIndex((current) => {
        const next = Math.min(song.slides.length - 1, current + 1);
        if (next !== current) socket.emit("control:slide", next);
        return next;
      });
    }, paceSeconds * 1000);
    return () => window.clearInterval(timer);
  }, [autoAdvance, paceSeconds, song]);

  const moveSlide = (direction: -1 | 1) => {
    if (!song?.slides.length) return;
    const next = Math.max(0, Math.min(song.slides.length - 1, slideIndex + direction));
    setSlideIndex(next);
    socket.emit("control:slide", next);
  };

  useEffect(() => {
    const loadedSongs = songStore.getSongs();
    setSongs(loadedSongs);
    setCurrentSongId((current) => current || (loadedSongs[0]?.id ?? ""));

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("display:requestSync");
    });
    socket.on("disconnect", () => setConnected(false));

    // Full state sync from server on connect
    socket.on("state:sync", (serverState: ServerStateSync) => {
      setConnected(true);
      if (serverState.songs?.length) songStore.mergeFromServer(serverState.songs as Song[]);
      if (serverState.currentSongId) setCurrentSongId(serverState.currentSongId);
      if (serverState.currentSlide !== undefined) setSlideIndex(serverState.currentSlide);
      if (serverState.teleprompterFontSize !== undefined) setFontSize(serverState.teleprompterFontSize);
      if (serverState.background) setBackground(serverState.background as BackgroundConfig);
    });

    if (socket.connected) {
      socket.emit("display:requestSync");
    }

    socket.on("display:teleprompterFontSize", (size: number) => {
      setFontSize(size);
    });

    // Live updates
    socket.on("control:slide", (idx: number) => setSlideIndex(idx));
    socket.on("control:song", (songId: string) => {
      setCurrentSongId(songId);
      setSlideIndex(0);
    });
    socket.on("song:list", (songList: Song[]) => songStore.setSongs(songList));
    socket.on("control:background", (bg: BackgroundConfig) => setBackground(bg));

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
      socket.off("control:background");
      unsubscribe();
    };
  }, []);

  const currentSlide = song?.slides[slideIndex] ?? song?.slides[0];
  const nextLine = song?.slides[slideIndex + 1]?.text ?? "";
  const backgroundStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    zIndex: 0,
    opacity: (background.opacity ?? 100) / 100,
  };

  if (background.type === "color") {
    backgroundStyle.background = background.value;
  } else if (background.type === "image") {
    backgroundStyle.backgroundImage = `url(${background.value})`;
    backgroundStyle.backgroundSize = "cover";
    backgroundStyle.backgroundPosition = "center";
  } else {
    backgroundStyle.background = background.value;
    backgroundStyle.backgroundSize = "400% 400%";
    backgroundStyle.animation = "bg-animate 8s ease infinite";
  }

  return (
    <main className={darkMode ? "teleprompter-shell dark" : "teleprompter-shell"}>
      <div style={backgroundStyle} />
      {/* Hidden nav bar - only visible on hover at top (same as projector) */}
      <div
        style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 30, padding: "8px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", opacity: showNav ? 1 : 0, transition: "opacity 0.3s", background: "rgba(0,0,0,0.75)", pointerEvents: showNav ? "auto" : "none" }}
        onMouseEnter={() => setShowNav(true)}
        onMouseLeave={() => setShowNav(false)}
      >
        <Link href="/control" style={{ color: "#fff", textDecoration: "none", fontSize: 14, padding: "6px 12px", background: "rgba(255,255,255,0.15)", borderRadius: 8 }}>
          ← Back to Control
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, color: connected ? "var(--success)" : "var(--danger)" }}>
            {connected ? "🟢 Synced" : "🔴 Offline"}
          </span>
          <div className="teleprompter-tools" aria-label="Teleprompter pacing controls">
            <button type="button" className="button subtle" onClick={() => moveSlide(-1)} aria-label="Previous slide">◀</button>
            <button type="button" className="button subtle" onClick={() => moveSlide(1)} aria-label="Next slide">▶</button>
            <label>
              Pace
              <select value={paceSeconds} onChange={(event) => setPaceSeconds(Number(event.target.value))}>
                <option value={5}>5s</option>
                <option value={8}>8s</option>
                <option value={12}>12s</option>
                <option value={20}>20s</option>
              </select>
            </label>
            <button type="button" className={`button ${autoAdvance ? "primary" : "subtle"}`} onClick={() => setAutoAdvance((current) => !current)}>
              {autoAdvance ? "Auto on" : "Manual"}
            </button>
          </div>
          <button onClick={() => setDarkMode((s) => !s)} className="button subtle" style={{ fontSize: 12 }}>
            {darkMode ? "☀️" : "🌙"}
          </button>
        </div>
      </div>
      {/* Invisible hover trigger at top */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 30, zIndex: 31 }} onMouseEnter={() => setShowNav(true)} />

      <section className="teleprompter-stage" style={{ fontSize }}>
        <div style={{ width: "100%" }}>
          <p key={`${currentSongId}-${slideIndex}`} className="teleprompter-current" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", textAlign: currentSlide?.textStyle?.align ?? "center" }}>{currentSlide?.text}</p>
          {nextLine && (
            <p className="teleprompter-next" style={{ textAlign: currentSlide?.textStyle?.align ?? "center" }}>
              Next: {nextLine}
            </p>
          )}
        </div>
      </section>

      <footer className="teleprompter-footer">
        <p>{connected ? "Connected via realtime sync" : "Waiting for connection..."} • Slide {slideIndex + 1} of {song?.slides.length ?? 0}</p>
      </footer>
    </main>
  );
}
