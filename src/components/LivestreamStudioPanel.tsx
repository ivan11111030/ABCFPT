import type { Camera, CameraTransition, SceneMode } from "@/src/types/production";

type LivestreamStudioPanelProps = {
  activeScene: SceneMode;
  activeCamera: Camera;
  transition: CameraTransition;
  isLive: boolean;
  onStart: () => void;
  onStop: () => void;
  onToggleOverlay: () => void;
  onChangeRtmpUrl: (url: string) => void;
  onChangeStreamKey: (key: string) => void;
};

export function LivestreamStudioPanel({
  activeScene,
  activeCamera,
  transition,
  isLive,
  onStart,
  onStop,
  onToggleOverlay,
  onChangeRtmpUrl,
  onChangeStreamKey,
}: LivestreamStudioPanelProps) {
  return (
    <section className="studio-panel">
      <div className="panel-header">
        <p>Livestream Studio</p>
        <p>{isLive ? "Live" : "Standby"}</p>
      </div>
      <div className="studio-line">
        <span>Scene</span>
        <strong>{activeScene}</strong>
      </div>
      <div className="studio-line">
        <span>Camera</span>
        <strong>{activeCamera.name}</strong>
      </div>
      <div className="studio-line">
        <span>Transition</span>
        <strong>{transition}</strong>
      </div>
      <div className="studio-input-group">
        <label>
          Facebook RTMP URL
          <input type="text" placeholder="rtmp://live-api.facebook.com:80/rtmp/" onChange={(event) => onChangeRtmpUrl(event.target.value)} />
        </label>
        <label>
          Stream Key
          <input type="text" placeholder="Enter stream key" onChange={(event) => onChangeStreamKey(event.target.value)} />
        </label>
      </div>
      <div className="studio-control-row">
        <button type="button" className="button primary" onClick={onStart}>
          Start Stream
        </button>
        <button type="button" className="button outline" onClick={onStop}>
          Stop Stream
        </button>
      </div>
      <button type="button" className="button subtle" onClick={onToggleOverlay}>
        Toggle Lyrics Overlay
      </button>
    </section>
  );
}
