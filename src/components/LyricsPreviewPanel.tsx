import type { Song } from "@/src/types/production";

type LyricsPreviewPanelProps = {
  song: Song;
  currentSlide: number;
  onJumpToSlide?: (index: number) => void;
};

export function LyricsPreviewPanel({ song, currentSlide, onJumpToSlide }: LyricsPreviewPanelProps) {
  return (
    <section className="lyrics-preview">
      <div className="panel-header">
        <p>Lyrics — {song.title}</p>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>{song.key} • {song.tempo} BPM</span>
      </div>
      <div className="slide-card">
        <div className="slide-label">Current Slide</div>
        <p className="slide-text">{song.slides[currentSlide]?.text}</p>
      </div>
      <div className="next-card">
        <div className="slide-label">Next</div>
        <p>{song.slides[currentSlide + 1]?.text ?? "End of song"}</p>
      </div>
      <div className="slide-list">
        {song.slides.map((slide, index) => (
          <button
            key={slide.id}
            type="button"
            className={`slide-list-item ${index === currentSlide ? "active" : ""}`}
            onClick={() => onJumpToSlide?.(index)}
          >
            <span className="slide-list-number">{index + 1}</span>
            <span className="slide-list-text">{slide.text}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
