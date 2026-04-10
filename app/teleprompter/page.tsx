"use client";

import { useEffect, useMemo, useState } from "react";
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
      if (nextSong) setSong(nextSong);
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
          <p className="track-label">Singer Teleprompter</p>
          <h1>{song.title}</h1>
          <p>{song.currentSection}</p>
        </div>
        <div className="teleprompter-controls">
          <button onClick={() => setDarkMode((state) => !state)} className="button subtle">
            {darkMode ? "Light" : "Dark"}
          </button>
          <input
            type="range"
            min="28"
            max="70"
            value={fontSize}
            onChange={(event) => setFontSize(Number(event.target.value))}
          />
        </div>
      </header>

      <section className="teleprompter-stage" style={{ fontSize }}>
        <p className="teleprompter-current">{currentSlide.text}</p>
        {nextLine && <p className="teleprompter-next">Next: {nextLine}</p>}
      </section>

      <footer className="teleprompter-footer">
        <p>Connected via realtime sync</p>
      </footer>
    </main>
  );
}
