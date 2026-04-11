import type { Camera } from "@/src/types/production";

type CameraPreviewPanelProps = {
  cameras: Camera[];
  activeCameraId: string;
  programCameraId?: string;
  onSelectCamera: (cameraId: string) => void;
  onHoverCamera?: (cameraId: string) => void;
  onRemoveCamera?: (cameraId: string) => void;
};

export function CameraPreviewPanel({ cameras, activeCameraId, programCameraId, onSelectCamera, onHoverCamera, onRemoveCamera }: CameraPreviewPanelProps) {
  const getTallyClass = (cameraId: string) => {
    if (programCameraId && cameraId === programCameraId) return "camera-card tally-program";
    if (cameraId === activeCameraId) return "camera-card tally-preview";
    return "camera-card";
  };

  return (
    <section className="camera-panel">
      <div className="panel-header">
        <p>Cameras</p>
        <span className="muted" style={{ fontSize: 12, color: "var(--muted)" }}>{cameras.filter(c => c.status === "online").length}/{cameras.length} online</span>
      </div>
      <div className="camera-grid">
        {cameras.map((camera) => (
          <div
            key={camera.id}
            className={getTallyClass(camera.id)}
            style={{ position: "relative" }}
            onMouseEnter={() => onHoverCamera?.(camera.id)}
          >
            {onRemoveCamera && (
              <button
                type="button"
                className="camera-remove-btn"
                title="Remove camera"
                onClick={(e) => { e.stopPropagation(); onRemoveCamera(camera.id); }}
              >
                ✕
              </button>
            )}
            <button
              type="button"
              className="camera-card-inner"
              onClick={() => onSelectCamera(camera.id)}
            >
              <div className="camera-thumbnail" aria-hidden="true">
                <span>{camera.streamUrl?.startsWith("local://") ? "💻" : camera.isMobile ? "📱" : camera.supportsPTZ ? "🎥" : "📷"}</span>
              </div>
              <div className="camera-meta">
                <strong>{camera.name}</strong>
                <small>
                  {camera.protocol}{camera.isMobile ? " • Mobile" : camera.streamUrl?.startsWith("local://") ? " • USB" : ""}
                  {camera.ipAddress && camera.ipAddress !== "local" && camera.ipAddress !== "" ? ` • ${camera.ipAddress}` : ""}
                </small>
                <div className="camera-footer">
                  <span className={camera.status === "online" ? "status online" : camera.status === "offline" ? "status offline" : "status unknown"}>
                    {camera.status === "online" ? "● ONLINE" : camera.status === "offline" ? "● OFFLINE" : "● UNKNOWN"}
                  </span>
                  {programCameraId === camera.id && <span className="status" style={{ background: "rgba(239,68,68,0.2)", color: "#fca5a5" }}>PGM</span>}
                  {activeCameraId === camera.id && programCameraId !== camera.id && <span className="status" style={{ background: "rgba(34,197,94,0.15)", color: "#bbf7d0" }}>PVW</span>}
                </div>
              </div>
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
