export type SceneMode = "worship" | "speaker" | "announcement" | "lyrics";

export type Slide = {
  id: string;
  section: string;
  text: string;
  notes?: string;
  background?: string;
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

export type SetlistItem = {
  id: string;
  songId: string;
  position: number;
};
