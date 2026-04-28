"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createSocketClient } from "@/src/lib/socket";
import { sampleSongs } from "@/src/lib/fakeData";
import type { Song } from "@/src/types/production";

const socket = createSocketClient();

export default function ProjectorPage() {
  const [song, setSong] = useState<Song>(sampleSongs[0]);
  const [slideIndex, setSlideIndex] = useState(0);
  const [fontSize, setFontSize] = useState(48);
  const [fontColor, setFontColor] = useState("#22c55e");
  const [backgroundColor, setBackgroundColor] = useState("#000000");

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

  return (
    <main className="projector-screen" style={{ backgroundColor }}>
      <div className="projector-hero">
        <div>
          <p className="projector-title" style={{ fontSize: fontSize * 1.4, color: fontColor }}>
            {song.title}
          </p>
          <p className="projector-line" style={{ fontSize, color: fontColor }}>
            {currentSlide.text}
          </p>
          <p className="projector-caption" style={{ fontSize: fontSize * 0.6, color: fontColor, opacity: 0.7 }}>
            {currentSlide.section} • {song.currentSection} • {song.key}
          </p>
        </div>
        <Link href="/control" className="button subtle">
          Return to Control
        </Link>
      </div>

      {/* Controls (only visible for quick tweaks) */}
      <div className="projector-controls">
        <div className="control-group">
          <label>
            Text Color
            <input
              type="color"
              value={fontColor}
              onChange={(event) => setFontColor(event.target.value)}
            />
          </label>
        </div>
        <div className="control-group">
          <label>
            Font Size
            <input
              type="range"
              min="32"
              max="80"
              value={fontSize}
              onChange={(event) => setFontSize(Number(event.target.value))}
            />
          </label>
        </div>
        <div className="control-group">
          <label>
            Background Color
            <input
              type="color"
              value={backgroundColor}
              onChange={(event) => setBackgroundColor(event.target.value)}
            />
          </label>
        </div>
      </div>
    </main>
  );
}
