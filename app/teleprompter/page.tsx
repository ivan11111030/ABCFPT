"use client";

import { useEffect, useState } from "react";
import { createSocketClient } from "@/src/lib/socket";
import { sampleSongs } from "@/src/lib/fakeData";
import type { Song } from "@/src/types/production";

const socket = createSocketClient();

export default function TeleprompterPage() {
  const [song, setSong] = useState<Song>(sampleSongs[0]);
  const [slideIndex, setSlideIndex] = useState(0);
  const [fontSize, setFontSize] = useState(42);
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    socket.on("control:slide", setSlideIndex);
    socket.on("control:song", (songId: string) => {
      const nextSong = sampleSongs.find((item) => item.id === songId);
      if (nextSong) {
        setSong(nextSong);
        setSlideIndex(0);
      }
    });

    return () => {
      socket.off("control:slide");
      socket.off("control:song");
    };
  }, []);

  const currentSlide = song.slides[slideIndex] ?? song.slides[0];
  const nextLine = song.slides[slideIndex + 1]?.text ?? "";

  return (
    <main className={darkMode ? "teleprompter-shell dark" : "teleprompter-shell"}>
      <header className="teleprompter-header">
        <div>
          <p className="track-label">Teleprompter</p>
          <h1 style={{ fontSize: 22 }}>{song.title}</h1>
          <p style={{ color: "var(--muted)", fontSize: 14 }}>{currentSlide.section}</p>
        </div>
        <div className="teleprompter-controls">
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
          <p className="teleprompter-current">{currentSlide.text}</p>
          {nextLine && (
            <p className="teleprompter-next">
              Next: {nextLine}
            </p>
          )}
        </div>
      </section>

      <footer className="teleprompter-footer">
        <p>Connected via realtime sync • Slide {slideIndex + 1} of {song.slides.length}</p>
      </footer>
    </main>
  );
}
