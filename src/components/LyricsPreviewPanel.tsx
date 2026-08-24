import { useMemo, useState } from "react";
import type { Slide, Song } from "@/src/types/production";

type LyricsPreviewPanelProps = {
  song: Song;
  currentSlide: number;
  overlayEnabled: boolean;
  onToggleOverlay: () => void;
  onToggleFullScreen?: () => void;
  isFullScreen?: boolean;
  onJumpToSlide?: (index: number) => void;
  onUpdateSlide?: (index: number, patch: Partial<Slide>) => void;
};

export function LyricsPreviewPanel({ song, currentSlide, overlayEnabled, onToggleOverlay, onToggleFullScreen, isFullScreen, onJumpToSlide, onUpdateSlide }: LyricsPreviewPanelProps) {
  const [thumbnailView, setThumbnailView] = useState(true);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draftText, setDraftText] = useState("");

  const currentText = song.slides[currentSlide]?.text ?? "";
  const nextText = song.slides[currentSlide + 1]?.text ?? "End of song";

  const alignmentButtons = (slide: Slide, index: number) => (
    <div className="slide-alignment" role="group" aria-label={`Alignment for slide ${index + 1}`}>
      {(["left", "center", "right"] as const).map((align) => (
        <button
          key={align}
          type="button"
          className={slide.textStyle?.align === align || (!slide.textStyle?.align && align === "center") ? "active" : ""}
          aria-label={`Align slide ${index + 1} ${align}`}
          aria-pressed={slide.textStyle?.align === align || (!slide.textStyle?.align && align === "center")}
          onClick={(event) => {
            event.stopPropagation();
            onUpdateSlide?.(index, { textStyle: { ...slide.textStyle, align } });
          }}
        >
          {align === "left" ? "L" : align === "center" ? "C" : "R"}
        </button>
      ))}
    </div>
  );

  const startEditing = (slide: Slide, index: number) => {
    setEditingIndex(index);
    setDraftText(slide.text);
  };

  const formatDraft = (type: "bullet" | "number") => {
    const lines = draftText.split("\n").map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, ""));
    setDraftText(lines.map((line, index) => type === "bullet" ? `• ${line}` : `${index + 1}. ${line}`).join("\n"));
  };

  const editControls = (slide: Slide, index: number) => editingIndex === index ? (
    <div className="slide-text-editor" onClick={(event) => event.stopPropagation()}>
      <div className="slide-text-toolbar">
        <button type="button" onClick={() => formatDraft("bullet")}>• Bullets</button>
        <button type="button" onClick={() => formatDraft("number")}>1. Numbered</button>
      </div>
      <textarea
        value={draftText}
        onChange={(event) => setDraftText(event.target.value)}
        rows={5}
        autoFocus
        aria-label={`Edit text for slide ${index + 1}`}
      />
      <div className="slide-text-editor-actions">
        <button type="button" className="button primary" onClick={() => { onUpdateSlide?.(index, { text: draftText }); setEditingIndex(null); }}>Save</button>
        <button type="button" className="button subtle" onClick={() => setEditingIndex(null)}>Cancel</button>
      </div>
    </div>
  ) : (
    <button type="button" className="slide-edit-button" onClick={(event) => { event.stopPropagation(); startEditing(slide, index); }}>
      Edit text
    </button>
  );

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
              <p style={{ textAlign: song.slides[currentSlide]?.textStyle?.align ?? "center" }}>{currentText}</p>
            </div>
          </div>

          <div className="slide-thumbnail-strip">
            {thumbnailSlides.map((slide, index) => (
              <div
                key={slide.id}
                className={`slide-thumbnail ${index === currentSlide ? "active" : ""}`}
                role="button"
                tabIndex={0}
                onClick={() => onJumpToSlide?.(index)}
                onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onJumpToSlide?.(index); }}
              >
                <div className="slide-thumbnail-number">{index + 1}</div>
                {editingIndex === index ? editControls(slide, index) : <div className="slide-thumbnail-text" style={{ textAlign: slide.textStyle?.align ?? "center" }}>{slide.text}</div>}
                {onUpdateSlide && editingIndex !== index && editControls(slide, index)}
                {alignmentButtons(slide, index)}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="lyrics-list-view">
          <div className="slide-card">
            <div className="slide-label">Current Slide</div>
            <p className="slide-text" style={{ textAlign: song.slides[currentSlide]?.textStyle?.align ?? "center" }}>{currentText}</p>
          </div>
          <div className="next-card">
            <div className="slide-label">Next</div>
            <p>{nextText}</p>
          </div>
          <div className="slide-list">
            {song.slides.map((slide, index) => (
              <div
                key={slide.id}
                className={`slide-list-item ${index === currentSlide ? "active" : ""}`}
                role="button"
                tabIndex={0}
                onClick={() => onJumpToSlide?.(index)}
                onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onJumpToSlide?.(index); }}
              >
                <span className="slide-list-number">{index + 1}</span>
                {editingIndex === index ? editControls(slide, index) : <span className="slide-list-text" style={{ textAlign: slide.textStyle?.align ?? "center" }}>{slide.text}</span>}
                {onUpdateSlide && editingIndex !== index && editControls(slide, index)}
                {alignmentButtons(slide, index)}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
