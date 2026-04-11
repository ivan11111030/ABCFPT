import type { Camera } from "@/src/types/production";

type CameraPreviewPanelProps = {
  cameras: Camera[];
  activeCameraId: string;
  onSelectCamera: (cameraId: string) => void;
};

export function CameraPreviewPanel({ cameras, activeCameraId, onSelectCamera }: CameraPreviewPanelProps) {
  return (
    <section className="camera-panel">
      <div className="panel-header">
        <p>Cameras</p>
        <span className="muted" style={{ fontSize: 12, color: "var(--muted)" }}>{cameras.filter(c => c.status === "online").length}/{cameras.length} online</span>
      </div>
      <div className="camera-grid">
        {cameras.map((camera) => (
          <button
            key={camera.id}
            type="button"
            className={camera.id === activeCameraId ? "camera-card active" : "camera-card"}
            onClick={() => onSelectCamera(camera.id)}
          >
            <div className="camera-thumbnail" aria-hidden="true">
              <span>{camera.isMobile ? "📱" : camera.supportsPTZ ? "🎥" : "📷"}</span>
            </div>
            <div className="camera-meta">
              <strong>{camera.name}</strong>
              <small>{camera.protocol}{camera.isMobile ? " • Mobile" : ""}</small>
              <div className="camera-footer">
                <span className={camera.status === "online" ? "status online" : camera.status === "offline" ? "status offline" : "status unknown"}>
                  {camera.status === "online" ? "🟢" : camera.status === "offline" ? "🔴" : "🟡"} {camera.status}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
