"use client";

import { useMemo, useState, type DragEvent } from "react";
import type { Song } from "@/src/types/production";

type SetlistPanelProps = {
  songs: Song[];
  activeSongId: string;
  onSelectSong: (id: string) => void;
  onReorder: (sourceId: string, targetId: string) => void;
};

export function SetlistPanel({ songs, activeSongId, onSelectSong, onReorder }: SetlistPanelProps) {
  const [draggedSongId, setDraggedSongId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filteredSongs = useMemo(() => {
    if (!search.trim()) return songs;
    const q = search.toLowerCase();
    return songs.filter(
      (song) => song.title.toLowerCase().includes(q) || song.artist.toLowerCase().includes(q)
    );
  }, [songs, search]);

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
    <div className="setlist-panel">
      <div className="panel-header">
        <p>Setlist</p>
      </div>
      <input
        type="search"
        className="setlist-search"
        placeholder="Search songs..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="setlist-items">
        {filteredSongs.map((song, index) => (
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
            <span className="setlist-number">{index + 1}</span>
            <div className="setlist-item-info">
              <span>{song.title}</span>
              <small>{song.artist}</small>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
