"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createSocketClient } from "@/src/lib/socket";
import * as songStore from "@/src/lib/songStore";
import { parseFile } from "@/src/lib/songParser";
import { SongManagementPanel } from "@/src/components/SongManagementPanel";
import type { Song } from "@/src/types/production";

const socket = createSocketClient();

export default function SongsPage() {
  const [songs, setSongs] = useState<Song[]>(() => songStore.getSongs());
  const [importStatus, setImportStatus] = useState("");

  useEffect(() => {
    socket.on("state:sync", (serverState: any) => {
      if (serverState.songs?.length) songStore.mergeFromServer(serverState.songs);
    });
    socket.on("song:list", (songList: Song[]) => songStore.setSongs(songList));

    const unsubscribe = songStore.subscribe(() => {
      setSongs(songStore.getSongs());
    });

    songStore.downloadFromCloud(true).catch(() => {
      // If cloud sync fails, continue using local storage and real-time socket sync.
    });

    return () => {
      socket.off("state:sync");
      socket.off("song:list");
      unsubscribe();
    };
  }, []);

  const handleImport = async (files?: FileList | File[], category: "song" | "message" | "announcement" = "song") => {
    if (!files || files.length === 0) return;

    const imported: Song[] = [];
    const errors: string[] = [];

    for (const file of Array.from(files)) {
      try {
        const song = await parseFile(file);
        if (song) {
          // Tag with the appropriate category
          imported.push({
            ...song,
            templateMetadata: {
              ...song.templateMetadata,
              originalFormat: category,
            },
          });
        } else {
          errors.push(`${file.name}: Unsupported file format. Use .txt, .lrc, or .pptx.`);
        }
      } catch {
        errors.push(`${file.name}: Error reading file.`);
      }
    }

    if (imported.length > 0) {
      for (const song of imported) {
        songStore.addSong(song);
      }
      socket.emit("song:import", imported);
      const categoryLabel = category === "song" ? "Songs" : category === "message" ? "Messages" : "Announcements";
      setImportStatus(`✓ Imported ${imported.length} ${categoryLabel.toLowerCase()} successfully.`);
    }
    if (errors.length > 0) {
      setImportStatus((prev) => (prev ? prev + " " : "") + errors.join(" "));
    }

    setTimeout(() => setImportStatus(""), 6000);
  };

  const handleAddSong = (song: Song) => {
    songStore.addSong(song);
    socket.emit("song:add", song);
  };

  const handleUpdateSong = (song: Song) => {
    songStore.updateSong(song);
    socket.emit("song:update", song);
  };

  const handleDeleteSong = (songId: string) => {
    songStore.deleteSong(songId);
    socket.emit("song:delete", songId);
  };

  return (
    <main className="page-shell">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <Link href="/control" className="button outline" style={{ padding: "8px 16px", textDecoration: "none" }}>
          ← Back to Control
        </Link>
        <div>
          <h1 style={{ margin: 0 }}>Song Management</h1>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
            Add, edit, import, and organize worship songs. Supports .txt and .lrc file formats.
          </p>
        </div>
      </div>
      {importStatus && (
        <div style={{ padding: "10px 16px", borderRadius: 8, marginBottom: 12, background: importStatus.includes("Error") || importStatus.includes("not supported") ? "var(--danger)" : "var(--success)", color: "#fff", fontSize: 14 }}>
          {importStatus}
        </div>
      )}
      <SongManagementPanel
        songs={songs}
        onImportSong={handleImport}
        onAddSong={handleAddSong}
        onUpdateSong={handleUpdateSong}
        onDeleteSong={handleDeleteSong}
      />
    </main>
  );
}
