export interface ServerStateSync {
  songs?: unknown[];
  currentSongId?: string;
  currentSlide?: number;
  overlayEnabled?: boolean;
  overlayPosition?: unknown;
  standby?: boolean;
  background?: unknown;
  currentScene?: string;
  projectorFontSize?: number;
  teleprompterFontSize?: number;
  cameras?: unknown[];
  activeCameraId?: string;
  cameraTransition?: string;
  isLive?: boolean;
  [key: string]: unknown;
}

export type ControlScenePayload =
  | string
  | {
      scene?: string;
      sceneType?: string;
      sceneConfig?: unknown;
    };
