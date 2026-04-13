"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SceneTemplate, SceneType, SceneConfig, SceneVersion } from "@/src/types/scene";
import { createSceneTemplate } from "@/src/types/scene";
import * as sceneStore from "@/src/lib/sceneStore";
import { exportSceneToPptx } from "@/src/lib/sceneExporter";

type SceneLibraryPanelProps = {
  onLoadScene: (scene: SceneTemplate) => void;
  onEditScene: (scene: SceneTemplate) => void;
  onClose: () => void;
};

const TYPE_LABELS: Record<SceneType, string> = {
  standby: "🔲 Standby",
  worship: "🎵 Worship",
  speaker: "🎤 Speaker",
  announcement: "📢 Announcement",
};

const TYPE_ORDER: SceneType[] = ["standby", "worship", "speaker", "announcement"];

export function SceneLibraryPanel({ onLoadScene, onEditScene, onClose }: SceneLibraryPanelProps) {
  const [scenes, setScenes] = useState<SceneTemplate[]>(sceneStore.getScenes);
  const [filter, setFilter] = useState<SceneType | "all">("all");
  const [search, setSearch] = useState("");
  const [versionPanel, setVersionPanel] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [newSceneType, setNewSceneType] = useState<SceneType | null>(null);
  const [newSceneName, setNewSceneName] = useState("");

  useEffect(() => {
    return sceneStore.subscribe(() => setScenes([...sceneStore.getScenes()]));
  }, []);

  const filtered = useMemo(() => {
    let list = filter === "all" ? scenes : scenes.filter((s) => s.type === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s) => s.name.toLowerCase().includes(q));
    }
    return list.sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) || b.updatedAt - a.updatedAt);
  }, [scenes, filter, search]);

  const grouped = useMemo(() => {
    const groups: Record<SceneType, SceneTemplate[]> = { standby: [], worship: [], speaker: [], announcement: [] };
    for (const s of filtered) groups[s.type].push(s);
    return groups;
  }, [filtered]);

  const handleDuplicate = (scene: SceneTemplate) => {
    sceneStore.duplicateScene(scene.id, `${scene.name} (Copy)`);
  };

  const handleDelete = (scene: SceneTemplate) => {
    if (confirm(`Delete "${scene.name}"?`)) {
      sceneStore.deleteScene(scene.id);
    }
  };

  const handleExport = async (scene: SceneTemplate) => {
    await exportSceneToPptx(scene.config, `${scene.name}.pptx`);
  };

  const handleRename = (scene: SceneTemplate) => {
    setRenaming(scene.id);
    setRenameValue(scene.name);
  };

  const submitRename = (scene: SceneTemplate) => {
    if (renameValue.trim()) {
      sceneStore.updateScene({ ...scene, name: renameValue.trim() });
    }
    setRenaming(null);
  };

  const handleNewScene = () => {
    if (!newSceneType || !newSceneName.trim()) return;
    const template = createSceneTemplate(newSceneName.trim(), newSceneType);
    sceneStore.addScene(template);
    setNewSceneType(null);
    setNewSceneName("");
  };

  const handleRestoreVersion = (sceneId: string, version: SceneVersion) => {
    sceneStore.restoreSceneVersion(sceneId, version.id);
    setVersionPanel(null);
  };

  const handleSaveVersion = (sceneId: string) => {
    const label = prompt("Version label (optional):");
    sceneStore.saveSceneVersion(sceneId, label || undefined);
  };

  return (
    <div className="scene-library">
      {/* Header */}
      <div className="sl-header">
        <h3 style={{ margin: 0, fontSize: 14 }}>Scene Library</h3>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            className="se-input"
            placeholder="Search scenes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 140, padding: "4px 8px", fontSize: 11 }}
          />
          <button type="button" className="button subtle" style={{ padding: "4px 10px", fontSize: 11 }} onClick={onClose}>
            ✕
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="sl-filters">
        <button type="button" className={`button ${filter === "all" ? "primary" : "subtle"}`} style={{ fontSize: 10, padding: "3px 8px" }} onClick={() => setFilter("all")}>
          All
        </button>
        {TYPE_ORDER.map((t) => (
          <button key={t} type="button" className={`button ${filter === t ? "primary" : "subtle"}`} style={{ fontSize: 10, padding: "3px 8px" }} onClick={() => setFilter(t)}>
            {TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {/* New scene */}
      <div className="sl-new-scene">
        {newSceneType === null ? (
          <button type="button" className="button outline" style={{ width: "100%", fontSize: 11, padding: "6px" }} onClick={() => setNewSceneType("standby")}>
            + New Scene
          </button>
        ) : (
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <select
              className="se-input"
              value={newSceneType}
              onChange={(e) => setNewSceneType(e.target.value as SceneType)}
              style={{ fontSize: 11, padding: "4px 6px" }}
            >
              {TYPE_ORDER.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <input
              className="se-input"
              placeholder="Scene name"
              value={newSceneName}
              onChange={(e) => setNewSceneName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleNewScene(); }}
              style={{ flex: 1, fontSize: 11, padding: "4px 6px" }}
              autoFocus
            />
            <button type="button" className="button primary" style={{ fontSize: 10, padding: "4px 8px" }} onClick={handleNewScene}>Add</button>
            <button type="button" className="button subtle" style={{ fontSize: 10, padding: "4px 6px" }} onClick={() => setNewSceneType(null)}>✕</button>
          </div>
        )}
      </div>

      {/* Grouped scene list */}
      <div className="sl-list">
        {TYPE_ORDER.map((type) => {
          const items = grouped[type];
          if (!items.length) return null;
          return (
            <div key={type} className="sl-group">
              <p className="sl-group-title">{TYPE_LABELS[type]}</p>
              {items.map((scene) => (
                <div key={scene.id} className="sl-scene-card">
                  {/* Thumbnail */}
                  <div
                    className="sl-scene-thumb"
                    style={{
                      background: scene.config.background.type === "color" || scene.config.background.type === "animated"
                        ? scene.config.background.value
                        : "#1e293b",
                      backgroundImage: scene.config.background.type === "image" ? `url(${scene.config.background.value})` : undefined,
                      backgroundSize: "cover",
                    }}
                  />
                  {/* Info */}
                  <div className="sl-scene-info">
                    {renaming === scene.id ? (
                      <input
                        className="se-input"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => submitRename(scene)}
                        onKeyDown={(e) => { if (e.key === "Enter") submitRename(scene); if (e.key === "Escape") setRenaming(null); }}
                        autoFocus
                        style={{ fontSize: 11, padding: "2px 4px" }}
                      />
                    ) : (
                      <span className="sl-scene-name" onDoubleClick={() => handleRename(scene)}>{scene.name}</span>
                    )}
                    <span className="sl-scene-meta">
                      {scene.versions.length} version{scene.versions.length !== 1 ? "s" : ""} · {new Date(scene.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  {/* Actions */}
                  <div className="sl-scene-actions">
                    <button type="button" className="button primary" style={{ padding: "3px 8px", fontSize: 10 }} onClick={() => onLoadScene(scene)} title="Load">Load</button>
                    <button type="button" className="button outline" style={{ padding: "3px 6px", fontSize: 10 }} onClick={() => onEditScene(scene)} title="Edit">Edit</button>
                    <button type="button" className="button subtle" style={{ padding: "3px 6px", fontSize: 10 }} onClick={() => handleDuplicate(scene)} title="Duplicate">⧉</button>
                    <button type="button" className="button subtle" style={{ padding: "3px 6px", fontSize: 10 }} onClick={() => handleRename(scene)} title="Rename">✏</button>
                    <button type="button" className="button subtle" style={{ padding: "3px 6px", fontSize: 10 }} onClick={() => setVersionPanel(versionPanel === scene.id ? null : scene.id)} title="Versions">📋</button>
                    <button type="button" className="button subtle" style={{ padding: "3px 6px", fontSize: 10 }} onClick={() => handleExport(scene)} title="Export PPTX">⬇</button>
                    <button type="button" className="button subtle" style={{ padding: "3px 6px", fontSize: 10, color: "var(--danger)" }} onClick={() => handleDelete(scene)} title="Delete">🗑</button>
                  </div>
                  {/* Version history panel */}
                  {versionPanel === scene.id && (
                    <div className="sl-version-panel">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text)" }}>Version History</span>
                        <button type="button" className="button outline" style={{ padding: "2px 6px", fontSize: 9 }} onClick={() => handleSaveVersion(scene.id)}>+ Save Version</button>
                      </div>
                      {scene.versions.length === 0 && <p style={{ fontSize: 10, color: "var(--text-dim)" }}>No versions saved yet.</p>}
                      {scene.versions.map((v) => (
                        <div key={v.id} className="sl-version-item">
                          <span style={{ flex: 1, fontSize: 10 }}>{v.label}</span>
                          <span style={{ fontSize: 9, color: "var(--text-dim)" }}>{new Date(v.createdAt).toLocaleString()}</span>
                          <button type="button" className="button subtle" style={{ padding: "2px 5px", fontSize: 9 }} onClick={() => handleRestoreVersion(scene.id, v)} title="Restore">↩</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
