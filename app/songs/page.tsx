"use client";

import { SongManagementPanel } from "@/src/components/SongManagementPanel";
import { sampleSongs } from "@/src/lib/fakeData";

export default function SongsPage() {
  const handleImport = () => {
    window.alert("Song import workflow coming soon. Use drag and drop or PPT upload.");
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
