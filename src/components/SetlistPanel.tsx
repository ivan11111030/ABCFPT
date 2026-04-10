import type { Song } from "@/src/types/production";

type SetlistPanelProps = {
  songs: Song[];
  activeSongId: string;
  onSelectSong: (id: string) => void;
};

export function SetlistPanel({ songs, activeSongId, onSelectSong }: SetlistPanelProps) {
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
            className={song.id === activeSongId ? "setlist-item active" : "setlist-item"}
            onClick={() => onSelectSong(song.id)}
          >
            <span>{song.title}</span>
            <small>{song.artist}</small>
          </button>
        ))}
      </div>
    </aside>
  );
}
