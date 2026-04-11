"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createSocketClient } from "@/src/lib/socket";
import { sampleSongs } from "@/src/lib/fakeData";
import { parseFile } from "@/src/lib/songParser";
import { SongManagementPanel } from "@/src/components/SongManagementPanel";
import type { Song } from "@/src/types/production";

const socket = createSocketClient();

export default function SongsPage() {
  const [songs, setSongs] = useState<Song[]>(sampleSongs);
  const [importStatus, setImportStatus] = useState("");

  useEffect(() => {
    socket.on("state:sync", (serverState: any) => {
      if (serverState.songs?.length) setSongs(serverState.songs);
    });
    socket.on("song:list", (songList: Song[]) => setSongs(songList));

    return () => {
      socket.off("state:sync");
      socket.off("song:list");
    };
  }, []);

  const handleImport = async (files?: FileList | File[]) => {
    if (!files || files.length === 0) return;

    const imported: Song[] = [];
    const errors: string[] = [];

    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext === "ppt" || ext === "pptx") {
        errors.push(`${file.name}: PPT/PPTX binary format not supported. Please save as .txt first.`);
        continue;
      }

      try {
        const song = await parseFile(file);
        if (song) {
          imported.push(song);
        } else {
          errors.push(`${file.name}: Unsupported file format.`);
        }
      } catch {
        errors.push(`${file.name}: Error reading file.`);
      }
    }

    if (imported.length > 0) {
      socket.emit("song:import", imported);
      setImportStatus(`✓ Imported ${imported.length} song(s) successfully.`);
    }
    if (errors.length > 0) {
      setImportStatus((prev) => (prev ? prev + " " : "") + errors.join(" "));
    }

    setTimeout(() => setImportStatus(""), 6000);
  };

  const handleAddSong = (song: Song) => {
    socket.emit("song:add", song);
  };

  const handleUpdateSong = (song: Song) => {
    socket.emit("song:update", song);
  };

  const handleDeleteSong = (songId: string) => {
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
