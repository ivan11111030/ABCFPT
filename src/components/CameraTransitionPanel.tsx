import type { CameraTransition } from "@/src/types/production";

type CameraTransitionPanelProps = {
  transition: CameraTransition;
  onChangeTransition: (transition: CameraTransition) => void;
};

const transitions: CameraTransition[] = ["cut", "fade", "cross-dissolve"];

export function CameraTransitionPanel({ transition, onChangeTransition }: CameraTransitionPanelProps) {
  return (
    <section className="transition-panel">
      <div className="panel-header">
        <p>Camera Transition</p>
      </div>
      <div className="transition-buttons">
        {transitions.map((mode) => (
          <button
            key={mode}
            type="button"
            className={transition === mode ? "button primary" : "button subtle"}
            onClick={() => onChangeTransition(mode)}
          >
            {mode.replace("-", " ")}
          </button>
        ))}
      </div>
    </section>
  );
}
