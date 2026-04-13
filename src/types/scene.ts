import type { BackgroundConfig, SlideTransition } from "./production";
import type { OverlayPosition, OverlayLayout } from "@/src/components/DraggableOverlay";

/* ─────────────────────────────────────────────────────
   Scene Template types
   ───────────────────────────────────────────────────── */

export type SceneType = "standby" | "worship" | "speaker" | "announcement";

/** A single overlay element within a scene */
export type SceneOverlay = {
  id: string;
  type: "lyrics" | "lower-third" | "text-box" | "image";
  /** For text-based overlays */
  text?: string;
  /** Secondary line (e.g. speaker title) */
  subtitle?: string;
  /** For image overlays – data-uri or URL */
  imageUrl?: string;
  position: OverlayPosition;
  layout: OverlayLayout;
  opacity: number;   // 0–100
  height: number;    // % 5–100
  visible: boolean;
};

/** A single version snapshot of a scene */
export type SceneVersion = {
  id: string;
  label: string;           // e.g. "v1", "v2 – updated lyrics"
  createdAt: number;
  config: SceneConfig;
};

/** Full configuration for a scene (what gets applied to projector) */
export type SceneConfig = {
  background: BackgroundConfig;
  overlays: SceneOverlay[];
  transition: SlideTransition;
  /** For standby scenes */
  standbyText?: string;
  /** For speaker scenes */
  speakerName?: string;
  speakerTitle?: string;
  /** For announcement scenes */
  announcementLines?: string[];
  /** Whether PPTX raw data is preserved */
  preservedPptx?: boolean;
  /** Raw PPTX XML for export fidelity */
  rawSlideXml?: string;
};

/** A saved scene template in the library */
export type SceneTemplate = {
  id: string;
  name: string;
  type: SceneType;
  config: SceneConfig;
  /** Thumbnail preview (data-uri) */
  thumbnail?: string;
  versions: SceneVersion[];
  createdAt: number;
  updatedAt: number;
};

/** Default scene configs per type */
export const DEFAULT_SCENE_CONFIGS: Record<SceneType, SceneConfig> = {
  standby: {
    background: { type: "color", value: "#0f172a", opacity: 100 },
    overlays: [
      {
        id: "standby-text",
        type: "text-box",
        text: "Service will begin shortly.",
        position: { x: 10, y: 40, width: 80 },
        layout: "full",
        opacity: 100,
        height: 20,
        visible: true,
      },
    ],
    transition: { type: "fade", duration: 800 },
    standbyText: "Service will begin shortly.",
  },
  worship: {
    background: { type: "animated", value: "linear-gradient(135deg, #0c1445, #1a0a3e, #0d2b45, #0c1445)", opacity: 100, animationPreset: "aurora" },
    overlays: [
      {
        id: "worship-lyrics",
        type: "lyrics",
        text: "",
        position: { x: 0, y: 75, width: 100 },
        layout: "lower-third",
        opacity: 100,
        height: 25,
        visible: true,
      },
    ],
    transition: { type: "fade", duration: 500 },
  },
  speaker: {
    background: { type: "color", value: "#000000", opacity: 100 },
    overlays: [
      {
        id: "speaker-lower-third",
        type: "lower-third",
        text: "Pastor Name",
        subtitle: "Senior Pastor",
        position: { x: 0, y: 82, width: 50 },
        layout: "lower-third",
        opacity: 95,
        height: 18,
        visible: true,
      },
    ],
    transition: { type: "fade", duration: 500 },
    speakerName: "Pastor Name",
    speakerTitle: "Senior Pastor",
  },
  announcement: {
    background: { type: "color", value: "#1e293b", opacity: 100 },
    overlays: [
      {
        id: "announce-title",
        type: "text-box",
        text: "Upcoming Events",
        position: { x: 10, y: 10, width: 80 },
        layout: "top-bar",
        opacity: 100,
        height: 12,
        visible: true,
      },
      {
        id: "announce-body",
        type: "text-box",
        text: "• Event details go here\n• Second event\n• Third event",
        position: { x: 10, y: 30, width: 80 },
        layout: "full",
        opacity: 90,
        height: 55,
        visible: true,
      },
    ],
    transition: { type: "fade", duration: 600 },
    announcementLines: ["Event details go here", "Second event", "Third event"],
  },
};

/** Helper to create a fresh scene template */
export function createSceneTemplate(
  name: string,
  type: SceneType,
  config?: Partial<SceneConfig>,
): SceneTemplate {
  const now = Date.now();
  const base = { ...DEFAULT_SCENE_CONFIGS[type], ...config };
  return {
    id: `scene-${now}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    type,
    config: base,
    versions: [
      {
        id: `ver-${now}`,
        label: "v1",
        createdAt: now,
        config: structuredClone(base),
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}
