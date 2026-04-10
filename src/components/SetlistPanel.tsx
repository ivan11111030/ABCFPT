"use client";

import { useState, type DragEvent } from "react";
import type { Song } from "@/src/types/production";

type SetlistPanelProps = {
  songs: Song[];
  activeSongId: string;
  onSelectSong: (id: string) => void;
  onReorder: (sourceId: string, targetId: string) => void;
};

export function SetlistPanel({ songs, activeSongId, onSelectSong, onReorder }: SetlistPanelProps) {
  const [draggedSongId, setDraggedSongId] = useState<string | null>(null);

  const handleDragStart = (event: DragEvent<HTMLButtonElement>, songId: string) => {
    setDraggedSongId(songId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", songId);
  };

  const handleDragOver = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  const handleDrop = (event: DragEvent<HTMLButtonElement>, targetId: string) => {
    event.preventDefault();
    const sourceId = event.dataTransfer.getData("text/plain");
    if (sourceId && sourceId !== targetId) {
      onReorder(sourceId, targetId);
    }
    setDraggedSongId(null);
  };

  return (
    <aside className="setlist-panel">
      <div className="panel-header">
        <p>Setlist</p>
      </div>
      <div className="setlist-items">
        {songs.map((song) => (
          <button
            key={song.id}
            type="button"
            className={`setlist-item ${song.id === activeSongId ? "active" : ""} ${song.id === draggedSongId ? "dragging" : ""}`}
            draggable
            onClick={() => onSelectSong(song.id)}
            onDragStart={(event) => handleDragStart(event, song.id)}
            onDragOver={handleDragOver}
            onDrop={(event) => handleDrop(event, song.id)}
          >
            <span>{song.title}</span>
            <small>{song.artist}</small>
          </button>
        ))}
      </div>
    </aside>
  );
}
