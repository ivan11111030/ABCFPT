"use client";

import { useRef, useState, type DragEvent } from "react";
import type { Song } from "@/src/types/production";

type SongManagementPanelProps = {
  songs: Song[];
  onImportSong?: (files: FileList | File[]) => void;
};

export function SongManagementPanel({ songs, onImportSong }: SongManagementPanelProps) {
  const [dragging, setDragging] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    const fileArray = Array.from(files);
    setDroppedFiles(fileArray);
    onImportSong?.(files);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    handleFileSelect(event.dataTransfer.files);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <section className="song-panel">
      <div className="panel-header">
        <p>Song Library</p>
        <button type="button" className="button primary" onClick={handleImportClick}>
          Import Lyrics / PPT
        </button>
      </div>
      <div
        className={`drop-zone ${dragging ? "drag-over" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <p>Drop a .ppt, .pptx, .txt, or lyric file here to import speaker notes and setlist data.</p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.lrc,.ppt,.pptx"
        multiple
        hidden
        onChange={(event) => handleFileSelect(event.target.files)}
      />
      {droppedFiles.length > 0 ? (
        <div className="import-list">
          <p className="muted-note">Imported files:</p>
          <ul>
            {droppedFiles.map((file) => (
              <li key={file.name}>{file.name}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="song-search-row">
        <input type="search" placeholder="Search songs, artists, keys..." />
      </div>
      <div className="song-list">
        {songs.map((song) => (
          <article key={song.id} className="song-card">
            <div>
              <strong>{song.title}</strong>
              <p>{song.artist} • {song.key} • {song.tempo} BPM</p>
            </div>
            <div className="song-meta">
              {song.favorite ? <span className="status favorite">Favorite</span> : null}
              <span className="status section">{song.currentSection}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
