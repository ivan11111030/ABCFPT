"use client";

import { useMemo, useState, type DragEvent } from "react";
import type { Song } from "@/src/types/production";
import * as songStore from "@/src/lib/songStore";

type SetlistPanelProps = {
  songs: Song[];
  activeSongId: string;
  onSelectSong: (id: string) => void;
  onReorder: (sourceId: string, targetId: string) => void;
};

export function SetlistPanel({ songs, activeSongId, onSelectSong, onReorder }: SetlistPanelProps) {
  const [draggedSongId, setDraggedSongId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudMsg, setCloudMsg] = useState("");

  // Filter to only show songs (not messages/announcements) for the setlist
  const setlistSongs = useMemo(() => songs.filter(s => s.category !== "message" && s.category !== "announcement"), [songs]);

  const filteredSongs = useMemo(() => {
    if (!search.trim()) return setlistSongs;
    const q = search.toLowerCase();
    return setlistSongs.filter(
      (song) => song.title.toLowerCase().includes(q) || song.artist.toLowerCase().includes(q)
    );
  }, [setlistSongs, search]);

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

  const handleCloudUpload = async () => {
    setCloudBusy(true);
    setCloudMsg("");
    const r = await songStore.uploadToCloud();
    setCloudMsg(r.ok ? `⬆ ${r.message}` : `⚠️ ${r.message}`);
    setCloudBusy(false);
    setTimeout(() => setCloudMsg(""), 5000);
  };

  const handleCloudDownload = async () => {
    setCloudBusy(true);
    setCloudMsg("");
    const r = await songStore.downloadFromCloud(true);
    setCloudMsg(r.ok ? `⬇ ${r.message}` : `⚠️ ${r.message}`);
    setCloudBusy(false);
    setTimeout(() => setCloudMsg(""), 5000);
  };

  return (
    <div className="setlist-panel">
      <div className="panel-header">
        <p>Setlist</p>
      </div>
      <div style={{ display: "flex", gap: 4, padding: "0 0 6px" }}>
        <button type="button" className="button subtle" disabled={cloudBusy} onClick={handleCloudUpload}
          title="Upload setlist to cloud" style={{ flex: 1, padding: "4px 6px", fontSize: 11 }}>
          ⬆ Cloud
        </button>
        <button type="button" className="button subtle" disabled={cloudBusy} onClick={handleCloudDownload}
          title="Download setlist from cloud" style={{ flex: 1, padding: "4px 6px", fontSize: 11 }}>
          ⬇ Cloud
        </button>
      </div>
      {cloudMsg && (
        <div style={{ fontSize: 11, padding: "4px 8px", marginBottom: 4, borderRadius: 6,
          background: cloudMsg.startsWith("⚠️") ? "var(--danger)" : "var(--success)", color: "#fff" }}>
          {cloudMsg}
        </div>
      )}
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
