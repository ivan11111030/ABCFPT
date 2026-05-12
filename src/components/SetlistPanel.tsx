"use client";

import { useMemo, useState, type DragEvent, useEffect } from "react";
import type { Song, SetlistItem } from "@/src/types/production";
import * as songStore from "@/src/lib/songStore";
import * as setlistStore from "@/src/lib/setlistStore";

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
  const [setlistItems, setSetlistItems] = useState<SetlistItem[]>(() => setlistStore.getSetlist());

  // Subscribe to setlist store changes
  useEffect(() => {
    const unsubscribe = setlistStore.subscribe(() => {
      setSetlistItems(setlistStore.getSetlist());
    });
    return unsubscribe;
  }, []);

  // Get the actual songs for items in setlist
  const setlistSongs = useMemo(() => {
    return setlistItems
      .map(item => songs.find(s => s.id === item.songId))
      .filter((s): s is Song => s !== undefined)
      .sort((a, b) => {
        const aPos = setlistItems.find(item => item.songId === a.id)?.position ?? 0;
        const bPos = setlistItems.find(item => item.songId === b.id)?.position ?? 0;
        return aPos - bPos;
      });
  }, [setlistItems, songs]);

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
      const reordered = setlistSongs.map(s => s.id);
      const sourceIdx = reordered.indexOf(sourceId);
      const targetIdx = reordered.indexOf(targetId);
      if (sourceIdx >= 0 && targetIdx >= 0) {
        [reordered[sourceIdx], reordered[targetIdx]] = [reordered[targetIdx], reordered[sourceIdx]];
        setlistStore.reorderSetlist(reordered);
      }
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
        placeholder="Search setlist..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="setlist-items">
        {filteredSongs.length === 0 ? (
          <div style={{ padding: "16px 8px", textAlign: "center", fontSize: 12, color: "var(--muted)" }}>
            {setlistItems.length === 0 
              ? "No songs in setlist. Add songs from Song Management."
              : "No matching songs in setlist."
            }
          </div>
        ) : (
          filteredSongs.map((song, index) => (
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
          ))
        )}
      </div>
    </div>
  );
}
