import type { SceneMode } from "@/src/types/production";

type SceneControlPanelProps = {
  activeScene: SceneMode;
  onSceneChange: (scene: SceneMode) => void;
};

const scenes: Array<{ id: SceneMode; label: string }> = [
  { id: "worship", label: "Worship Scene" },
  { id: "speaker", label: "Speaker Scene" },
  { id: "announcement", label: "Announcement" },
  { id: "lyrics", label: "Full Lyrics" },
];

export function SceneControlPanel({ activeScene, onSceneChange }: SceneControlPanelProps) {
  return (
    <section className="scene-panel">
      <div className="panel-header">
        <p>Scene Controls</p>
      </div>
      <div className="scene-buttons">
        {scenes.map((scene) => (
          <button key={scene.id} className={scene.id === activeScene ? "scene-button active" : "scene-button"} onClick={() => onSceneChange(scene.id)}>
            {scene.label}
          </button>
        ))}
      </div>
    </section>
  );
}
