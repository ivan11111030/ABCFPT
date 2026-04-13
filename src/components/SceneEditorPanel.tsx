"use client";

import { useCallback, useRef, useState } from "react";
import type { SceneTemplate, SceneType, SceneConfig, SceneOverlay } from "@/src/types/scene";
import { DEFAULT_SCENE_CONFIGS } from "@/src/types/scene";
import { DraggableOverlay, OverlayManualControls, type OverlayPosition } from "@/src/components/DraggableOverlay";
import type { BackgroundConfig, TextStyle } from "@/src/types/production";

/* ── Animated background presets (same as BackgroundPanel) ── */
const ANIMATED_PRESETS = [
  { id: "gradient-flow", label: "Gradient Flow", css: "linear-gradient(270deg, #0f172a, #1e3a5f, #0f172a)" },
  { id: "aurora", label: "Aurora", css: "linear-gradient(135deg, #0c1445, #1a0a3e, #0d2b45, #0c1445)" },
  { id: "sunset-wave", label: "Sunset Wave", css: "linear-gradient(270deg, #1a0a2e, #2d1b69, #0f172a)" },
  { id: "deep-ocean", label: "Deep Ocean", css: "linear-gradient(270deg, #0a0e27, #0d2b45, #0a192f, #0a0e27)" },
  { id: "northern-lights", label: "Northern Lights", css: "linear-gradient(135deg, #0f0c29, #302b63, #24243e, #0f0c29)" },
  { id: "fire-glow", label: "Fire Glow", css: "linear-gradient(270deg, #1a0000, #4a1414, #2d0a0a, #1a0000)" },
];

const WEB_FONTS = ["Inter", "Arial", "Georgia", "Merriweather", "Roboto", "Oswald", "Playfair Display", "Montserrat", "Open Sans", "Lato"];

type TextStyleControlsProps = {
  style: TextStyle;
  onChange: (s: TextStyle) => void;
};

function TextStyleControls({ style, onChange }: TextStyleControlsProps) {
  return (
    <div className="text-style-controls">
      <div className="tsc-row">
        <label>Font</label>
        <select className="se-input" value={style.fontFamily ?? "Inter"} onChange={(e) => onChange({ ...style, fontFamily: e.target.value })} style={{ flex: 1 }}>
          {WEB_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>
      <div className="tsc-row">
        <label>Size</label>
        <input type="number" className="se-input" min={10} max={120} value={style.fontSize ?? 32} onChange={(e) => onChange({ ...style, fontSize: Number(e.target.value) })} style={{ width: 60 }} />
        <span style={{ fontSize: 10, color: "var(--text-dim)" }}>px</span>
      </div>
      <div className="tsc-row">
        <label>Color</label>
        <input type="color" value={style.color ?? "#ffffff"} onChange={(e) => onChange({ ...style, color: e.target.value })} style={{ width: 36, height: 24, border: "none", borderRadius: 4, cursor: "pointer", background: "none", padding: 0 }} />
        <span style={{ fontSize: 10, color: "var(--text-dim)" }}>{style.color ?? "#ffffff"}</span>
      </div>
      <div className="tsc-row">
        <label>Align</label>
        {(["left", "center", "right"] as const).map((a) => (
          <button key={a} type="button" className={`button ${style.align === a ? "primary" : "subtle"}`} style={{ padding: "2px 7px", fontSize: 11 }} onClick={() => onChange({ ...style, align: a })}>
            {a === "left" ? "⬅" : a === "center" ? "↔" : "➡"}
          </button>
        ))}
      </div>
      <div className="tsc-row">
        <label>Style</label>
        <button type="button" className={`button ${style.bold ? "primary" : "subtle"}`} style={{ padding: "2px 7px", fontSize: 11, fontWeight: 700 }} onClick={() => onChange({ ...style, bold: !style.bold })}>B</button>
        <button type="button" className={`button ${style.italic ? "primary" : "subtle"}`} style={{ padding: "2px 7px", fontSize: 11, fontStyle: "italic" }} onClick={() => onChange({ ...style, italic: !style.italic })}>I</button>
      </div>
    </div>
  );
}

type SceneEditorPanelProps = {
  scene: SceneTemplate;
  onSave: (updated: SceneTemplate) => void;
  onClose: () => void;
  /** Apply changes live to projector */
  onLivePreview?: (config: SceneConfig) => void;
  /** Import a Canva image */
  onCanvaImport?: (imageUrl: string, applyAs: "overlay" | "background") => void;
};

export function SceneEditorPanel({ scene, onSave, onClose, onLivePreview }: SceneEditorPanelProps) {
  const [config, setConfig] = useState<SceneConfig>(() => structuredClone(scene.config));
  const [sceneName, setSceneName] = useState(scene.name);
  const [activeOverlayId, setActiveOverlayId] = useState<string | null>(config.overlays[0]?.id ?? null);
  const [bgTab, setBgTab] = useState<"color" | "image" | "animated">(config.background.type);
  const [dirty, setDirty] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvaFileRef = useRef<HTMLInputElement>(null);

  const activeOverlay = config.overlays.find((o) => o.id === activeOverlayId);

  const update = useCallback((next: SceneConfig) => {
    setConfig(next);
    setDirty(true);
    onLivePreview?.(next);
  }, [onLivePreview]);

  const updateOverlay = useCallback((overlayId: string, patch: Partial<SceneOverlay>) => {
    setConfig((prev) => {
      const next = {
        ...prev,
        overlays: prev.overlays.map((o) => (o.id === overlayId ? { ...o, ...patch } : o)),
      };
      setDirty(true);
      onLivePreview?.(next);
      return next;
    });
  }, [onLivePreview]);

  const addOverlay = (type: SceneOverlay["type"]) => {
    const id = `overlay-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    const newOverlay: SceneOverlay = {
      id,
      type,
      text: type === "image" ? "" : "New text",
      position: { x: 10, y: 50, width: 80 },
      layout: "custom",
      opacity: 100,
      height: 20,
      visible: true,
    };
    const next = { ...config, overlays: [...config.overlays, newOverlay] };
    update(next);
    setActiveOverlayId(id);
  };

  const removeOverlay = (overlayId: string) => {
    const next = { ...config, overlays: config.overlays.filter((o) => o.id !== overlayId) };
    update(next);
    if (activeOverlayId === overlayId) {
      setActiveOverlayId(next.overlays[0]?.id ?? null);
    }
  };

  const handleBgColor = (value: string) => {
    update({ ...config, background: { type: "color", value, opacity: config.background.opacity ?? 100 } });
  };

  const handleBgImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => {
      update({ ...config, background: { type: "image", value: reader.result as string, opacity: config.background.opacity ?? 100 } });
    };
    reader.readAsDataURL(file);
  };

  const handleBgAnimated = (presetId: string) => {
    const preset = ANIMATED_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    update({ ...config, background: { type: "animated", value: preset.css, animationPreset: presetId, opacity: config.background.opacity ?? 100 } });
  };

  const handleCanvaFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      // Add as an image overlay
      const id = `canva-${Date.now()}`;
      const overlay: SceneOverlay = {
        id,
        type: "image",
        imageUrl: url,
        position: { x: 0, y: 0, width: 100 },
        layout: "full",
        opacity: 100,
        height: 100,
        visible: true,
      };
      const next = { ...config, overlays: [...config.overlays, overlay] };
      update(next);
      setActiveOverlayId(id);
    };
    reader.readAsDataURL(file);
    if (canvaFileRef.current) canvaFileRef.current.value = "";
  };

  const handleSave = () => {
    const updated: SceneTemplate = {
      ...scene,
      name: sceneName,
      config: structuredClone(config),
      updatedAt: Date.now(),
    };
    onSave(updated);
    setDirty(false);
  };

  // Scene-type specific fields
  const renderTypeFields = () => {
    switch (scene.type) {
      case "standby":
        return (
          <div className="se-field">
            <label>Standby Text</label>
            <textarea
              className="se-textarea"
              value={config.standbyText ?? ""}
              onChange={(e) => {
                const val = e.target.value;
                update({ ...config, standbyText: val });
                // Also update the standby overlay text
                const overlay = config.overlays.find((o) => o.id === "standby-text");
                if (overlay) updateOverlay(overlay.id, { text: val });
              }}
              rows={2}
            />
          </div>
        );
      case "speaker":
        return (
          <>
            <div className="se-field">
              <label>Speaker Name</label>
              <input
                className="se-input"
                value={config.speakerName ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  update({ ...config, speakerName: val });
                  const overlay = config.overlays.find((o) => o.type === "lower-third");
                  if (overlay) updateOverlay(overlay.id, { text: val });
                }}
              />
            </div>
            <div className="se-field">
              <label>Title</label>
              <input
                className="se-input"
                value={config.speakerTitle ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  update({ ...config, speakerTitle: val });
                  const overlay = config.overlays.find((o) => o.type === "lower-third");
                  if (overlay) updateOverlay(overlay.id, { subtitle: val });
                }}
              />
            </div>
          </>
        );
      case "announcement":
        return (
          <div className="se-field">
            <label>Event Details (one per line)</label>
            <textarea
              className="se-textarea"
              value={(config.announcementLines ?? []).join("\n")}
              onChange={(e) => {
                const lines = e.target.value.split("\n");
                update({ ...config, announcementLines: lines });
                const bodyOverlay = config.overlays.find((o) => o.id === "announce-body");
                if (bodyOverlay) updateOverlay(bodyOverlay.id, { text: lines.map((l) => `• ${l}`).join("\n") });
              }}
              rows={4}
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="scene-editor">
      {/* Header */}
      <div className="se-header">
        <div style={{ flex: 1 }}>
          <input
            className="se-name-input"
            value={sceneName}
            onChange={(e) => { setSceneName(e.target.value); setDirty(true); }}
            placeholder="Scene name"
          />
          <span className="se-type-badge">{scene.type}</span>
        </div>
        <div className="se-header-actions">
          {dirty && <span className="se-unsaved">Unsaved</span>}
          <button type="button" className="button primary" style={{ padding: "6px 16px", fontSize: 12 }} onClick={handleSave}>
            Save
          </button>
          <button type="button" className="button subtle" style={{ padding: "6px 12px", fontSize: 12 }} onClick={onClose}>
            ✕
          </button>
        </div>
      </div>

      <div className="se-body">
        {/* Left: Preview */}
        <div className="se-preview">
          <div
            className="se-preview-canvas"
            style={{
              background: config.background.type === "animated"
                ? config.background.value
                : config.background.type === "color"
                ? config.background.value
                : undefined,
              backgroundImage: config.background.type === "image" ? `url(${config.background.value})` : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
              ...(config.background.type === "animated" ? { backgroundSize: "400% 400%", animation: "bg-animate 8s ease infinite" } : {}),
            }}
          >
            {config.overlays.filter((o) => o.visible).map((overlay) => (
              <DraggableOverlay
                key={overlay.id}
                position={overlay.position}
                onPositionChange={(pos) => updateOverlay(overlay.id, { position: pos })}
                opacity={overlay.opacity}
                height={overlay.height}
                interactive
              >
                <div
                  className={`se-overlay-content${overlay.id === activeOverlayId ? " selected" : ""}`}
                  onClick={(e) => { e.stopPropagation(); setActiveOverlayId(overlay.id); }}
                >
                  {overlay.type === "image" && overlay.imageUrl ? (
                    <img src={overlay.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  ) : overlay.type === "lower-third" ? (
                    <div className="se-lower-third-preview" style={{ fontFamily: overlay.textStyle?.fontFamily, color: overlay.textStyle?.color }}>
                      <strong style={{ fontSize: overlay.textStyle?.fontSize, fontWeight: overlay.textStyle?.bold === false ? 400 : 700, fontStyle: overlay.textStyle?.italic ? "italic" : undefined }}>{overlay.text}</strong>
                      {overlay.subtitle && <span>{overlay.subtitle}</span>}
                    </div>
                  ) : (
                    <p style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: overlay.textStyle?.fontSize ?? 14, color: overlay.textStyle?.color ?? "#fff", fontFamily: overlay.textStyle?.fontFamily, textAlign: overlay.textStyle?.align ?? "center", fontWeight: overlay.textStyle?.bold ? 700 : undefined, fontStyle: overlay.textStyle?.italic ? "italic" : undefined }}>{overlay.text}</p>
                  )}
                </div>
              </DraggableOverlay>
            ))}
          </div>
        </div>

        {/* Right: Properties */}
        <div className="se-properties">
          {/* Type-specific fields */}
          {renderTypeFields()}

          {/* Background */}
          <div className="se-section">
            <p className="se-section-title">Background</p>
            <div className="bg-tabs" style={{ marginBottom: 6 }}>
              <button type="button" className={`button ${bgTab === "color" ? "primary" : "subtle"}`} onClick={() => setBgTab("color")} style={{ flex: 1, padding: "4px 6px", fontSize: 10 }}>Color</button>
              <button type="button" className={`button ${bgTab === "image" ? "primary" : "subtle"}`} onClick={() => setBgTab("image")} style={{ flex: 1, padding: "4px 6px", fontSize: 10 }}>Image</button>
              <button type="button" className={`button ${bgTab === "animated" ? "primary" : "subtle"}`} onClick={() => setBgTab("animated")} style={{ flex: 1, padding: "4px 6px", fontSize: 10 }}>Animated</button>
            </div>
            {bgTab === "color" && (
              <input type="color" value={config.background.type === "color" ? config.background.value : "#000000"} onChange={(e) => handleBgColor(e.target.value)} style={{ width: "100%", height: 28, border: "none", borderRadius: 6, cursor: "pointer" }} />
            )}
            {bgTab === "image" && (
              <>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleBgImage} style={{ display: "none" }} />
                <button type="button" className="button outline" style={{ width: "100%", fontSize: 11, padding: "6px" }} onClick={() => fileInputRef.current?.click()}>
                  Upload Image
                </button>
              </>
            )}
            {bgTab === "animated" && (
              <div className="bg-animated-grid" style={{ marginTop: 4 }}>
                {ANIMATED_PRESETS.map((p) => (
                  <button key={p.id} type="button" className={`bg-animated-swatch${config.background.animationPreset === p.id ? " active" : ""}`} style={{ background: p.css, height: 32 }} onClick={() => handleBgAnimated(p.id)} title={p.label}>
                    <span>{p.label}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="overlay-manual-row" style={{ marginTop: 6 }}>
              <label>Opacity</label>
              <input type="range" min={0} max={100} value={config.background.opacity ?? 100} onChange={(e) => update({ ...config, background: { ...config.background, opacity: Number(e.target.value) } })} />
              <span>{config.background.opacity ?? 100}%</span>
            </div>
          </div>

          {/* Transition */}
          <div className="se-section">
            <p className="se-section-title">Transition</p>
            <div style={{ display: "flex", gap: 4 }}>
              {["fade", "push", "wipe"].map((t) => (
                <button key={t} type="button" className={`button ${config.transition.type === t ? "primary" : "subtle"}`} style={{ flex: 1, padding: "4px 6px", fontSize: 10 }} onClick={() => update({ ...config, transition: { ...config.transition, type: t } })}>
                  {t}
                </button>
              ))}
            </div>
            <div className="overlay-manual-row" style={{ marginTop: 4 }}>
              <label>Duration</label>
              <input type="range" min={100} max={2000} step={100} value={config.transition.duration} onChange={(e) => update({ ...config, transition: { ...config.transition, duration: Number(e.target.value) } })} />
              <span>{config.transition.duration}ms</span>
            </div>
          </div>

          {/* Overlays list */}
          <div className="se-section">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p className="se-section-title">Overlays</p>
              <div style={{ display: "flex", gap: 3 }}>
                <button type="button" className="button subtle" style={{ padding: "3px 6px", fontSize: 10 }} onClick={() => addOverlay("text-box")}>+ Text</button>
                <button type="button" className="button subtle" style={{ padding: "3px 6px", fontSize: 10 }} onClick={() => addOverlay("lower-third")}>+ L3</button>
                <button type="button" className="button subtle" style={{ padding: "3px 6px", fontSize: 10 }} onClick={() => addOverlay("image")}>+ Img</button>
              </div>
            </div>
            <div className="se-overlay-list">
              {config.overlays.map((o) => (
                <div
                  key={o.id}
                  className={`se-overlay-item${o.id === activeOverlayId ? " active" : ""}`}
                  onClick={() => setActiveOverlayId(o.id)}
                >
                  <span style={{ flex: 1, fontSize: 11 }}>{o.type}: {o.text?.slice(0, 20) || o.id}</span>
                  <button type="button" className="button subtle" style={{ padding: "2px 5px", fontSize: 9 }} onClick={(e) => { e.stopPropagation(); updateOverlay(o.id, { visible: !o.visible }); }}>
                    {o.visible ? "👁" : "👁‍🗨"}
                  </button>
                  <button type="button" className="button subtle" style={{ padding: "2px 5px", fontSize: 9, color: "var(--danger)" }} onClick={(e) => { e.stopPropagation(); removeOverlay(o.id); }}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Active overlay properties */}
          {activeOverlay && (
            <div className="se-section">
              <p className="se-section-title">Overlay: {activeOverlay.type}</p>
              {activeOverlay.type !== "image" && (
                <div className="se-field">
                  <label>Text</label>
                  <textarea
                    className="se-textarea"
                    value={activeOverlay.text ?? ""}
                    onChange={(e) => updateOverlay(activeOverlay.id, { text: e.target.value })}
                    rows={2}
                  />
                </div>
              )}
              {activeOverlay.type === "lower-third" && (
                <div className="se-field">
                  <label>Subtitle</label>
                  <input
                    className="se-input"
                    value={activeOverlay.subtitle ?? ""}
                    onChange={(e) => updateOverlay(activeOverlay.id, { subtitle: e.target.value })}
                  />
                </div>
              )}
              {activeOverlay.type !== "image" && (
                <>
                  <p className="se-section-title" style={{ marginTop: 8 }}>Text Style</p>
                  <TextStyleControls
                    style={activeOverlay.textStyle ?? {}}
                    onChange={(ts) => updateOverlay(activeOverlay.id, { textStyle: ts })}
                  />
                </>
              )}
              <OverlayManualControls
                position={activeOverlay.position}
                onPositionChange={(pos) => updateOverlay(activeOverlay.id, { position: pos })}
                opacity={activeOverlay.opacity}
                onOpacityChange={(v) => updateOverlay(activeOverlay.id, { opacity: v })}
                height={activeOverlay.height}
                onHeightChange={(v) => updateOverlay(activeOverlay.id, { height: v })}
              />
            </div>
          )}

          {/* Canva import */}
          <div className="se-section">
            <p className="se-section-title">Canva Import</p>
            <input ref={canvaFileRef} type="file" accept="image/*" onChange={handleCanvaFile} style={{ display: "none" }} />
            <button type="button" className="button outline" style={{ width: "100%", fontSize: 11, padding: "6px" }} onClick={() => canvaFileRef.current?.click()}>
              Import Canva Design (PNG/JPG)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
