export type SceneMode = "worship" | "speaker" | "announcement" | "lyrics";

/** Reusable text style applied to slide text or scene overlays */
export type TextStyle = {
  fontFamily?: string;
  fontSize?: number;      // px
  color?: string;         // hex
  align?: "left" | "center" | "right";
  bold?: boolean;
  italic?: boolean;
};

export type Slide = {
  id: string;
  section: string;
  text: string;
  notes?: string;
  background?: string;
  /** Optional image attached to this slide */
  imageUrl?: string;
  /** Per-slide text style overrides */
  textStyle?: TextStyle;
  /** Base64 rendered image of the original PPTX slide (preserves fonts/layout) */
  renderedImage?: string;
  /** Raw OOXML for the slide (fonts, animations, transitions) */
  rawXml?: string;
  /** Transition metadata extracted from PPTX */
  transition?: SlideTransition;
};

export type SlideTransition = {
  type: string;       // e.g. "fade", "push", "wipe", "split"
  duration: number;   // milliseconds
  advanceAfter?: number; // auto-advance ms (0 = manual)
};

export type BackgroundConfig = {
  type: "color" | "image" | "animated";
  value: string;           // hex color, image URL/data-uri, or animation preset name
  opacity?: number;        // 0-100
  animationPreset?: string; // for animated backgrounds
};

export type CanvaDesign = {
  id: string;
  title: string;
  thumbnailUrl: string;
  exportUrl: string;
  type: "overlay" | "background";
  importedAt: number;
};

export type Song = {
  id: string;
  title: string;
  artist: string;
  key: string;
  tempo: number;
  currentSection: string;
  slides: Slide[];
  favorite: boolean;
  templateMetadata?: {
    originalFormat?: string; // "song" | "message" | "announcement" | "pptx" | "txt" | "lrc"
    backgroundColor?: string;
    embeddedFonts?: string[];
    importedAt?: number;
  };
  updatedAt?: number;
};

export type AudioState = {
  source: string;
  levelLeft: number;
  levelRight: number;
  peak: boolean;
  bpm: number;
};

export type CameraProtocol = "RTSP" | "NDI" | "ONVIF" | "WebRTC";
export type CameraStatus = "online" | "offline" | "unknown";

export type CameraTransition = "cut" | "fade" | "cross-dissolve";

export type Camera = {
  id: string;
  name: string;
  protocol: CameraProtocol;
  ipAddress: string;
  streamUrl: string;
  status: CameraStatus;
  supportsPTZ: boolean;
  enabled?: boolean;
  isMobile?: boolean;
  signalStrength?: "good" | "fair" | "weak";
  presetList?: string[];
};

export type SyncStatus = "connected" | "disconnected" | "pending";

/** Item categories determine where content is displayed */
export type ItemCategory = "song" | "message" | "announcement";

/** Content item that can be added to a setlist */
export type ContentItem = {
  id: string;
  category: ItemCategory;
  title: string;
  artist?: string;
  key?: string;
  tempo?: number;
  favorite: boolean;
  slides: Slide[];
  /** Template metadata for preserving formatting from imported files */
  templateMetadata?: {
    originalFormat: string; // "pptx" | "txt" | "lrc"
    backgroundColor?: string;
    textColor?: string;
    fontFamily?: string;
  };
  updatedAt?: number;
};

/** Represents an item's membership in a setlist */
export type SetlistMembership = {
  id: string;
  setlistId: string;
  itemId: string;
  itemCategory: ItemCategory;
  position: number;
  addedAt: number;
};

export type SetlistItem = {
  id: string;
  songId: string;
  position: number;
};
