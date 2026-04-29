"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createSocketClient } from "@/src/lib/socket";
import * as songStore from "@/src/lib/songStore";
import type { Song } from "@/src/types/production";

const socket = createSocketClient();

export default function TeleprompterPage() {
  const [songs, setSongs] = useState<Song[]>(() => songStore.getSongs());
  const [currentSongId, setCurrentSongId] = useState(() => songStore.getSongs()[0]?.id ?? "");
  const [slideIndex, setSlideIndex] = useState(0);
  const [fontSize, setFontSize] = useState(42);
  const [darkMode, setDarkMode] = useState(true);
  const [connected, setConnected] = useState(false);
  const [showNav, setShowNav] = useState(false);

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
    });

    // Live updates
    socket.on("control:slide", (idx: number) => setSlideIndex(idx));
    socket.on("control:song", (songId: string) => {
      setCurrentSongId(songId);
      setSlideIndex(0);
    });
    socket.on("song:list", (songList: Song[]) => songStore.setSongs(songList));

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
      unsubscribe();
    };
  }, []);

  const currentSlide = song?.slides[slideIndex] ?? song?.slides[0];
  const nextLine = song?.slides[slideIndex + 1]?.text ?? "";

  return (
    <main className={darkMode ? "teleprompter-shell dark" : "teleprompter-shell"}>
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
          <button onClick={() => setDarkMode((s) => !s)} className="button subtle" style={{ fontSize: 12 }}>
            {darkMode ? "☀️" : "🌙"}
          </button>
          <input type="range" min="28" max="70" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} title="Font size" style={{ width: 80 }} />
        </div>
      </div>
      {/* Invisible hover trigger at top */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 30, zIndex: 31 }} onMouseEnter={() => setShowNav(true)} />

      <section className="teleprompter-stage" style={{ fontSize }}>
        <div>
          <p className="teleprompter-current">{currentSlide?.text}</p>
          {nextLine && (
            <p className="teleprompter-next">
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
