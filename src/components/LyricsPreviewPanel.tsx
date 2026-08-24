import { useMemo, useRef, useState } from "react";
import type { Slide, Song } from "@/src/types/production";

const SLIDE_FONTS = ["Inter", "Arial", "Georgia", "Merriweather", "Roboto", "Oswald", "Montserrat", "Open Sans"];

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
  const imageInputRef = useRef<HTMLInputElement>(null);

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

  const attachImage = (file: File) => {
    if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024 || editingIndex === null) return;
    const reader = new FileReader();
    reader.onload = () => onUpdateSlide?.(editingIndex, { imageUrl: reader.result as string });
    reader.readAsDataURL(file);
  };

  const formatDraft = (type: "bullet" | "number") => {
    const lines = draftText.split("\n").map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, ""));
    setDraftText(lines.map((line, index) => type === "bullet" ? `• ${line}` : `${index + 1}. ${line}`).join("\n"));
  };

  const updateEditingStyle = (patch: Slide["textStyle"]) => {
    if (editingIndex === null || !onUpdateSlide) return;
    const slide = song.slides[editingIndex];
    onUpdateSlide(editingIndex, { textStyle: { ...slide.textStyle, ...patch } });
  };

  const editControls = (slide: Slide, index: number) => (
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
              {song.slides[currentSlide]?.imageUrl && <img src={song.slides[currentSlide].imageUrl} alt="Slide attachment" className={`slide-preview-image slide-preview-image-${song.slides[currentSlide].imagePlacement ?? "foreground"}`} />}
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
                {slide.imageUrl && <img src={slide.imageUrl} alt="" className={`slide-card-image slide-card-image-${slide.imagePlacement ?? "foreground"}`} />}
                <div className="slide-thumbnail-text" style={{ textAlign: slide.textStyle?.align ?? "center" }}>{slide.text}</div>
                {onUpdateSlide && editControls(slide, index)}
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
                {slide.imageUrl && <img src={slide.imageUrl} alt="" className={`slide-card-image slide-card-image-${slide.imagePlacement ?? "foreground"}`} />}
                <span className="slide-list-text" style={{ textAlign: slide.textStyle?.align ?? "center" }}>{slide.text}</span>
                {onUpdateSlide && editControls(slide, index)}
                {alignmentButtons(slide, index)}
              </div>
            ))}
          </div>
        </div>
      )}
      {editingIndex !== null && onUpdateSlide && song.slides[editingIndex] && (
        <div className="slide-edit-modal" role="dialog" aria-modal="true" aria-labelledby="slide-edit-title" onClick={(event) => { if (event.target === event.currentTarget) setEditingIndex(null); }}>
          <div className="slide-edit-modal-content">
            <div className="slide-edit-modal-header">
              <div>
                <p className="slide-label">Editing Slide {editingIndex + 1}</p>
                <h2 id="slide-edit-title">{song.slides[editingIndex].section || "Slide text"}</h2>
              </div>
              <button type="button" className="button subtle" aria-label="Close slide editor" onClick={() => setEditingIndex(null)}>✕</button>
            </div>
            <div className="slide-text-toolbar">
              <button type="button" onClick={() => formatDraft("bullet")}>• Bullets</button>
              <button type="button" onClick={() => formatDraft("number")}>1. Numbered</button>
              <button type="button" onClick={() => imageInputRef.current?.click()}>Add image</button>
              <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) attachImage(file); event.target.value = ""; }} />
            </div>
            {song.slides[editingIndex].imageUrl && (
              <div className="slide-edit-image-preview">
                <img src={song.slides[editingIndex].imageUrl} alt="Slide attachment" />
                <label className="slide-edit-field">
                  Image placement
                  <select
                    value={song.slides[editingIndex].imagePlacement ?? "foreground"}
                    onChange={(event) => onUpdateSlide(editingIndex, { imagePlacement: event.target.value as Slide["imagePlacement"] })}
                  >
                    <option value="background">Background</option>
                    <option value="inline">Inside text</option>
                    <option value="foreground">Foreground</option>
                  </select>
                </label>
                <button type="button" className="button subtle" onClick={() => onUpdateSlide(editingIndex, { imageUrl: undefined })}>Remove image</button>
              </div>
            )}
            <div className="slide-font-controls">
              <label>Font<select value={song.slides[editingIndex].textStyle?.fontFamily ?? "Inter"} onChange={(event) => updateEditingStyle({ fontFamily: event.target.value })}>{SLIDE_FONTS.map((font) => <option key={font}>{font}</option>)}</select></label>
              <label>Size<input type="number" min={10} max={160} value={song.slides[editingIndex].textStyle?.fontSize ?? 42} onChange={(event) => updateEditingStyle({ fontSize: Number(event.target.value) || 10 })} /></label>
              <label>Color<input type="color" value={song.slides[editingIndex].textStyle?.color ?? "#ffffff"} onChange={(event) => updateEditingStyle({ color: event.target.value })} /></label>
              <button type="button" className={song.slides[editingIndex].textStyle?.bold ? "active" : ""} onClick={() => updateEditingStyle({ bold: !song.slides[editingIndex].textStyle?.bold })}>B</button>
              <button type="button" className={song.slides[editingIndex].textStyle?.italic ? "active italic" : "italic"} onClick={() => updateEditingStyle({ italic: !song.slides[editingIndex].textStyle?.italic })}>I</button>
            </div>
            <textarea
              className="slide-edit-modal-textarea"
              value={draftText}
              onChange={(event) => setDraftText(event.target.value)}
              autoFocus
              aria-label={`Edit text for slide ${editingIndex + 1}`}
            />
            <div className="slide-text-editor-actions">
              <button type="button" className="button primary" onClick={() => { onUpdateSlide(editingIndex, { text: draftText }); setEditingIndex(null); }}>Save Changes</button>
              <button type="button" className="button subtle" onClick={() => setEditingIndex(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
