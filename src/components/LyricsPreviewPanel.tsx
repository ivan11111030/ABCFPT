import type { Song } from "@/src/types/production";

type LyricsPreviewPanelProps = {
  song: Song;
  currentSlide: number;
};

export function LyricsPreviewPanel({ song, currentSlide }: LyricsPreviewPanelProps) {
  return (
    <section className="lyrics-preview">
      <div className="panel-header">
        <p>Lyrics Preview</p>
        <p>{song.title} • {song.key} • {song.tempo} BPM</p>
      </div>
      <div className="slide-card">
        <div className="slide-label">Current Slide</div>
        <p className="slide-text">{song.slides[currentSlide]?.text}</p>
      </div>
      <div className="next-card">
        <div className="slide-label">Next Slide</div>
        <p>{song.slides[currentSlide + 1]?.text ?? "End of song"}</p>
      </div>
    </section>
  );
}
