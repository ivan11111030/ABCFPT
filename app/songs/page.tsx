"use client";

import { SongManagementPanel } from "@/src/components/SongManagementPanel";
import { sampleSongs } from "@/src/lib/fakeData";

export default function SongsPage() {
  const handleImport = (files?: FileList | File[]) => {
    if (!files || files.length === 0) {
      window.alert("Select or drop a PPT/lyrics file to import speaker notes and setlist data.");
      return;
    }

    const names = Array.from(files).map((file) => file.name).join(", ");
    window.alert(`Imported ${names}`);
  };

  return (
    <main className="page-shell">
      <section className="hero-card">
        <div>
          <h1>Song Management</h1>
          <p className="hero-copy">
            Organize worship songs, build setlists, import lyrics, and keep the congregation lyrics prepared for every service.
          </p>
        </div>
      </section>
      <SongManagementPanel songs={sampleSongs} onImportSong={handleImport} />
    </main>
  );
}
