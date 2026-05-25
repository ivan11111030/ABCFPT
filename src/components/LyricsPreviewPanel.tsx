import { useMemo, useState } from "react";
import type { Song } from "@/src/types/production";

type LyricsPreviewPanelProps = {
  song: Song;
  currentSlide: number;
  overlayEnabled: boolean;
  onToggleOverlay: () => void;
  onToggleFullScreen?: () => void;
  isFullScreen?: boolean;
  onJumpToSlide?: (index: number) => void;
};

export function LyricsPreviewPanel({ song, currentSlide, overlayEnabled, onToggleOverlay, onToggleFullScreen, isFullScreen, onJumpToSlide }: LyricsPreviewPanelProps) {
  const [thumbnailView, setThumbnailView] = useState(true);

  const currentText = song.slides[currentSlide]?.text ?? "";
  const nextText = song.slides[currentSlide + 1]?.text ?? "End of song";

  const thumbnailSlides = useMemo(
    () => song.slides.map((slide, index) => ({ ...slide, label: index + 1 })),
    [song.slides]
  );

  return (
    <section className="lyrics-preview lyrics-ppt">
      <div className="panel-header lyrics-panel-header">
        <div>
          <p>Lyrics — {song.title}</p>
          <span>{song.key} • {song.tempo} BPM</span>
        </div>
        <div className="lyrics-actions">
          <button type="button" className={`button outline ${thumbnailView ? "active" : ""}`} onClick={() => setThumbnailView((prev) => !prev)}>
            {thumbnailView ? "Slide view" : "Notes view"}
          </button>
          {/* overlay toggle removed per user request */}
          {onToggleFullScreen && (
            <button type="button" className={`button outline ${isFullScreen ? "active" : ""}`} onClick={onToggleFullScreen}>
              {isFullScreen ? "Exit Full Screen" : "Full Screen"}
            </button>
          )}
        </div>
      </div>

      {thumbnailView ? (
        <>
          <div className="slide-preview-card">
            <div className="slide-preview-header">
              <span>Slide {currentSlide + 1}</span>
              <span>Current</span>
            </div>
            <div className="slide-preview-body">
              <p>{currentText}</p>
            </div>
          </div>

          <div className="slide-thumbnail-strip">
            {thumbnailSlides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                className={`slide-thumbnail ${index === currentSlide ? "active" : ""}`}
                onClick={() => onJumpToSlide?.(index)}
              >
                <div className="slide-thumbnail-number">{index + 1}</div>
                <div className="slide-thumbnail-text">{slide.text}</div>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="lyrics-list-view">
          <div className="slide-card">
            <div className="slide-label">Current Slide</div>
            <p className="slide-text">{currentText}</p>
          </div>
          <div className="next-card">
            <div className="slide-label">Next</div>
            <p>{nextText}</p>
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
        </div>
      )}
    </section>
  );
}
