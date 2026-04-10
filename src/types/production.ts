export type SceneMode = "worship" | "speaker" | "announcement" | "lyrics";

export type Slide = {
  id: string;
  section: string;
  text: string;
  background?: string;
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
