"use client";

import { useEffect, useState } from "react";
import type { SceneType, SceneTemplate, SceneConfig } from "@/src/types/scene";
import * as sceneStore from "@/src/lib/sceneStore";

type SceneControlPanelProps = {
  activeSceneType: SceneType;
  onSceneChange: (type: SceneType, config: SceneConfig) => void;
  onEditScene: (scene: SceneTemplate) => void;
  onOpenLibrary: () => void;
};

const SCENE_BUTTONS: Array<{ type: SceneType; label: string; icon: string }> = [
  { type: "standby", label: "Standby", icon: "🔲" },
  { type: "worship", label: "Worship", icon: "🎵" },
  { type: "speaker", label: "Speaker", icon: "🎤" },
  { type: "announcement", label: "Announce", icon: "📢" },
];

export function SceneControlPanel({ activeSceneType, onSceneChange, onEditScene, onOpenLibrary }: SceneControlPanelProps) {
  const [scenes, setScenes] = useState<SceneTemplate[]>(sceneStore.getScenes);

  useEffect(() => {
    return sceneStore.subscribe(() => setScenes([...sceneStore.getScenes()]));
  }, []);

  const handleSceneClick = (type: SceneType) => {
    // Find the first scene of this type
    const scene = scenes.find((s) => s.type === type);
    if (scene) {
      onSceneChange(type, scene.config);
    }
  };

  const handleEditClick = (type: SceneType, e: React.MouseEvent) => {
    e.stopPropagation();
    const scene = scenes.find((s) => s.type === type);
    if (scene) onEditScene(scene);
  };

  return (
    <section className="scene-panel">
      <div className="panel-header">
        <p>Scene Controls</p>
        <button
          type="button"
          className="button subtle"
          style={{ padding: "2px 8px", fontSize: 10 }}
          onClick={onOpenLibrary}
          title="Scene Library"
        >
          📚 Library
        </button>
      </div>
      <div className="scene-buttons">
        {SCENE_BUTTONS.map((s) => (
          <div key={s.type} className="scene-button-wrapper">
            <button
              className={s.type === activeSceneType ? "scene-button active" : "scene-button"}
              onClick={() => handleSceneClick(s.type)}
            >
              <span className="scene-button-icon">{s.icon}</span>
              {s.label}
            </button>
            <button
              type="button"
              className="scene-edit-btn"
              onClick={(e) => handleEditClick(s.type, e)}
              title={`Edit ${s.label}`}
            >
              ✏
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
