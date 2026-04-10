import type { Song } from "@/src/types/production";

type SongManagementPanelProps = {
  songs: Song[];
  onImportSong: () => void;
};

export function SongManagementPanel({ songs, onImportSong }: SongManagementPanelProps) {
  return (
    <section className="song-panel">
      <div className="panel-header">
        <p>Song Library</p>
        <button type="button" className="button primary" onClick={onImportSong}>
          Import Lyrics / PPT
        </button>
      </div>
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
