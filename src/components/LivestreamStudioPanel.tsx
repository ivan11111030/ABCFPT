import { useState } from "react";
import type { Camera, CameraTransition, SceneMode } from "@/src/types/production";

type LivestreamStudioPanelProps = {
  activeScene: SceneMode;
  activeCamera: Camera;
  transition: CameraTransition;
  isLive: boolean;
  streamStatus?: string;
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
  streamStatus,
  onStart,
  onStop,
  onToggleOverlay,
  onChangeRtmpUrl,
  onChangeStreamKey,
}: LivestreamStudioPanelProps) {
  const [rtmpUrl, setRtmpUrl] = useState("rtmps://live-api-s.facebook.com:443/rtmp/");
  const [streamKey, setStreamKey] = useState("");

  return (
    <section className="studio-panel">
      <div className="panel-header">
        <p>Livestream Studio</p>
        <span style={{ fontSize: 12, fontWeight: 700, color: isLive ? "var(--danger)" : "var(--muted)" }}>
          {isLive ? "🔴 LIVE" : "⏸ Standby"}
        </span>
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
        <label htmlFor="rtmp-url">
          Facebook RTMP URL
          <input
            id="rtmp-url"
            name="rtmp-url"
            type="text"
            value={rtmpUrl}
            placeholder="rtmps://live-api-s.facebook.com:443/rtmp/"
            onChange={(event) => {
              setRtmpUrl(event.target.value);
              onChangeRtmpUrl(event.target.value);
            }}
          />
        </label>
        <label htmlFor="stream-key">
          Stream Key
          <input
            id="stream-key"
            name="stream-key"
            type="password"
            value={streamKey}
            placeholder="Enter your Facebook stream key"
            onChange={(event) => {
              setStreamKey(event.target.value);
              onChangeStreamKey(event.target.value);
            }}
          />
        </label>
      </div>
      {streamStatus && (
        <div style={{
          padding: "8px 12px",
          borderRadius: 8,
          marginBottom: 8,
          fontSize: 13,
          background: streamStatus.toLowerCase().includes("error") ? "var(--danger)" : streamStatus === "Live" ? "var(--success)" : streamStatus === "Connecting..." ? "#f59e0b" : "var(--card)",
          color: streamStatus.toLowerCase().includes("error") || streamStatus === "Live" || streamStatus === "Connecting..." ? "#fff" : "var(--text)",
        }}>
          {streamStatus}
        </div>
      )}
      <div className="studio-control-row">
        {!isLive ? (
          <button
            type="button"
            className="button broadcast"
            onClick={onStart}
            disabled={!streamKey.trim()}
            style={{ flex: 1 }}
          >
            🔴 GO LIVE
          </button>
        ) : (
          <button type="button" className="button danger" onClick={onStop} style={{ flex: 1 }}>
            ⏹ STOP
          </button>
        )}
      </div>
      <button type="button" className="button subtle" onClick={onToggleOverlay} style={{ width: "100%" }}>
        Toggle Lyrics Overlay
      </button>
      {!streamKey.trim() && (
        <p style={{ fontSize: 11, color: "var(--muted)", textAlign: "center", marginTop: 6 }}>
          Enter your stream key to enable streaming. Get it from Facebook Live Producer.
        </p>
      )}
    </section>
  );
}
