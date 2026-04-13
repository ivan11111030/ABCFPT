"use client";

import { useRef, useState } from "react";
import type { BackgroundConfig } from "@/src/types/production";

const ANIMATED_PRESETS = [
  { id: "gradient-flow", label: "Gradient Flow", css: "linear-gradient(270deg, #0f172a, #1e3a5f, #0f172a)" },
  { id: "aurora", label: "Aurora", css: "linear-gradient(135deg, #0c1445, #1a0a3e, #0d2b45, #0c1445)" },
  { id: "sunset-wave", label: "Sunset Wave", css: "linear-gradient(270deg, #1a0a2e, #2d1b69, #0f172a)" },
  { id: "deep-ocean", label: "Deep Ocean", css: "linear-gradient(270deg, #0a0e27, #0d2b45, #0a192f, #0a0e27)" },
  { id: "northern-lights", label: "Northern Lights", css: "linear-gradient(135deg, #0f0c29, #302b63, #24243e, #0f0c29)" },
  { id: "fire-glow", label: "Fire Glow", css: "linear-gradient(270deg, #1a0000, #4a1414, #2d0a0a, #1a0000)" },
  { id: "particles", label: "Floating Particles", css: "radial-gradient(circle at 20% 80%, rgba(79,195,247,0.15) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(147,51,234,0.15) 0%, transparent 50%), #0f172a" },
  { id: "starfield", label: "Starfield", css: "radial-gradient(2px 2px at 20px 30px, #fff, transparent), radial-gradient(2px 2px at 40px 70px, rgba(255,255,255,0.8), transparent), radial-gradient(1px 1px at 90px 40px, #fff, transparent), radial-gradient(1px 1px at 130px 80px, rgba(255,255,255,0.6), transparent), #0a0e1a" },
];

type BackgroundPanelProps = {
  background: BackgroundConfig;
  onBackgroundChange: (bg: BackgroundConfig) => void;
  standby: boolean;
  onToggleStandby: () => void;
};

export function BackgroundPanel({ background, onBackgroundChange, standby, onToggleStandby }: BackgroundPanelProps) {
  const [tab, setTab] = useState<"color" | "image" | "animated">(background.type);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleColorChange = (value: string) => {
    onBackgroundChange({ type: "color", value, opacity: background.opacity ?? 100 });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    // Limit file to 5MB
    if (file.size > 5 * 1024 * 1024) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      onBackgroundChange({ type: "image", value: dataUrl, opacity: background.opacity ?? 100 });
    };
    reader.readAsDataURL(file);
  };

  const handleAnimatedSelect = (presetId: string) => {
    const preset = ANIMATED_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    onBackgroundChange({
      type: "animated",
      value: preset.css,
      animationPreset: presetId,
      opacity: background.opacity ?? 100,
    });
  };

  const handleOpacityChange = (opacity: number) => {
    onBackgroundChange({ ...background, opacity });
  };

  return (
    <section className="scene-panel">
      <div className="panel-header"><p>Standby &amp; Background</p></div>

      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <button type="button" className={`button ${standby ? "danger" : "outline"}`} style={{ flex: 1 }} onClick={onToggleStandby}>
          {standby ? "⏸ Standby ON" : "▶ Go Live View"}
        </button>
      </div>

      {/* Background type tabs */}
      <div className="bg-tabs">
        <button type="button" className={`button ${tab === "color" ? "primary" : "subtle"}`} onClick={() => setTab("color")} style={{ flex: 1, padding: "6px 8px", fontSize: 11 }}>
          Solid Color
        </button>
        <button type="button" className={`button ${tab === "image" ? "primary" : "subtle"}`} onClick={() => setTab("image")} style={{ flex: 1, padding: "6px 8px", fontSize: 11 }}>
          Image
        </button>
        <button type="button" className={`button ${tab === "animated" ? "primary" : "subtle"}`} onClick={() => setTab("animated")} style={{ flex: 1, padding: "6px 8px", fontSize: 11 }}>
          Animated
        </button>
      </div>

      {/* Color picker */}
      {tab === "color" && (
        <div style={{ marginTop: 8 }}>
          <label style={{ display: "block", marginBottom: 6, fontSize: 12, color: "var(--muted)" }}>
            Background Color
            <input
              type="color"
              value={background.type === "color" ? background.value : "#000000"}
              onChange={(e) => handleColorChange(e.target.value)}
              style={{ width: "100%", height: 32, border: "none", borderRadius: 6, cursor: "pointer" }}
            />
          </label>
        </div>
      )}

      {/* Image upload */}
      {tab === "image" && (
        <div style={{ marginTop: 8 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            style={{ display: "none" }}
          />
          <button
            type="button"
            className="button outline"
            style={{ width: "100%", fontSize: 12, marginBottom: 8 }}
            onClick={() => fileInputRef.current?.click()}
          >
            📁 Upload Background Image
          </button>
          {background.type === "image" && background.value && (
            <div className="bg-image-preview">
              <img src={background.value} alt="Background" style={{ width: "100%", height: 80, objectFit: "cover", borderRadius: 8 }} />
              <button
                type="button"
                className="button subtle"
                style={{ fontSize: 10, padding: "4px 8px", marginTop: 4 }}
                onClick={() => onBackgroundChange({ type: "color", value: "#000000" })}
              >
                Remove
              </button>
            </div>
          )}
        </div>
      )}

      {/* Animated presets */}
      {tab === "animated" && (
        <div className="bg-animated-grid" style={{ marginTop: 8 }}>
          {ANIMATED_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`bg-animated-swatch${background.animationPreset === preset.id ? " active" : ""}`}
              style={{ background: preset.css }}
              onClick={() => handleAnimatedSelect(preset.id)}
              title={preset.label}
            >
              <span>{preset.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Opacity slider */}
      <div className="overlay-manual-row" style={{ marginTop: 8 }}>
        <label>BG Opacity</label>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={background.opacity ?? 100}
          onChange={(e) => handleOpacityChange(Number(e.target.value))}
        />
        <span>{background.opacity ?? 100}%</span>
      </div>
    </section>
  );
}
