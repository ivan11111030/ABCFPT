type SlideControlsProps = {
  onPrevious: () => void;
  onNext: () => void;
  onJump: (index: number) => void;
};

const sections = ["Verse", "Chorus", "Bridge", "Tag"];

export function SlideControls({ onPrevious, onNext, onJump }: SlideControlsProps) {
  return (
    <div className="slide-controls">
      <div className="panel-header">
        <p>Presentation Controls</p>
      </div>
      <div className="control-row">
        <button type="button" className="button outline" onClick={onPrevious}>
          Previous Slide
        </button>
        <button type="button" className="button primary" onClick={onNext}>
          Next Slide
        </button>
      </div>
      <div className="jump-grid">
        {sections.map((section, index) => (
          <button key={section} type="button" className="button subtle" onClick={() => onJump(index)}>
            Jump to {section}
          </button>
        ))}
      </div>
    </div>
  );
}
