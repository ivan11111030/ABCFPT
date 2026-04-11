"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createSocketClient } from "@/src/lib/socket";
import { sampleSongs } from "@/src/lib/fakeData";
import type { Song } from "@/src/types/production";

const socket = createSocketClient();

export default function TeleprompterPage() {
  const [songs, setSongs] = useState<Song[]>(sampleSongs);
  const [currentSongId, setCurrentSongId] = useState(sampleSongs[0].id);
  const [slideIndex, setSlideIndex] = useState(0);
  const [fontSize, setFontSize] = useState(42);
  const [darkMode, setDarkMode] = useState(true);
  const [connected, setConnected] = useState(false);

  const song = songs.find((s) => s.id === currentSongId) ?? songs[0];

  useEffect(() => {
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    // Full state sync from server on connect
    socket.on("state:sync", (serverState: any) => {
      setConnected(true);
      if (serverState.songs?.length) setSongs(serverState.songs);
      if (serverState.currentSongId) setCurrentSongId(serverState.currentSongId);
      if (serverState.currentSlide !== undefined) setSlideIndex(serverState.currentSlide);
    });

    // Live updates
    socket.on("control:slide", (idx: number) => setSlideIndex(idx));
    socket.on("control:song", (songId: string) => {
      setCurrentSongId(songId);
      setSlideIndex(0);
    });
    socket.on("song:list", (songList: Song[]) => setSongs(songList));

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("state:sync");
      socket.off("control:slide");
      socket.off("control:song");
      socket.off("song:list");
    };
  }, []);

  const currentSlide = song?.slides[slideIndex] ?? song?.slides[0];
  const nextLine = song?.slides[slideIndex + 1]?.text ?? "";

  return (
    <main className={darkMode ? "teleprompter-shell dark" : "teleprompter-shell"}>
      <header className="teleprompter-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/control" style={{ color: "inherit", textDecoration: "none", padding: "6px 12px", background: "rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 14 }}>
            ← Back
          </Link>
          <div>
            <p className="track-label">Teleprompter</p>
            <h1 style={{ fontSize: 22 }}>{song?.title}</h1>
            <p style={{ color: "var(--muted)", fontSize: 14 }}>{currentSlide?.section}</p>
          </div>
        </div>
        <div className="teleprompter-controls">
          <span style={{ fontSize: 12, color: connected ? "var(--success)" : "var(--danger)" }}>
            {connected ? "🟢 Synced" : "🔴 Offline"}
          </span>
          <button onClick={() => setDarkMode((s) => !s)} className="button subtle">
            {darkMode ? "☀️ Light" : "🌙 Dark"}
          </button>
          <input
            type="range"
            min="28"
            max="70"
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            title="Font size"
          />
        </div>
      </header>

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
