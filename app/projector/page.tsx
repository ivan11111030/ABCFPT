"use client";

import { useEffect, useState } from "react";
import { createSocketClient } from "@/src/lib/socket";
import { sampleSongs } from "@/src/lib/fakeData";
import type { Song } from "@/src/types/production";

const socket = createSocketClient();

export default function ProjectorPage() {
  const [song, setSong] = useState<Song>(sampleSongs[0]);
  const [slideIndex, setSlideIndex] = useState(0);

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

  return (
    <main className="projector-screen">
      <div className="projector-content">
        <p className="projector-line" key={`${song.id}-${slideIndex}`}>
          {currentSlide.text}
        </p>
        <p className="projector-section">
          {currentSlide.section} • {song.title}
        </p>
      </div>
    </main>
  );
}
