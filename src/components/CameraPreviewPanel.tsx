import type { Camera } from "@/src/types/production";

type CameraPreviewPanelProps = {
  cameras: Camera[];
  activeCameraId: string;
  programCameraId?: string;
  overlayEnabled: boolean;
  onToggleOverlay: () => void;
  onToggleFullScreen?: () => void;
  isFullScreen?: boolean;
  onOpenCameraModal?: () => void;
  onSelectCamera: (cameraId: string) => void;
  onHoverCamera?: (cameraId: string) => void;
  onRemoveCamera?: (cameraId: string) => void;
  streams?: Record<string, MediaStream>;
  combined?: boolean;
  onToggleCombined?: () => void;
};

export function CameraPreviewPanel({ cameras, activeCameraId, programCameraId, overlayEnabled, onToggleOverlay, onToggleFullScreen, isFullScreen, onOpenCameraModal, onSelectCamera, onHoverCamera, onRemoveCamera, streams, combined, onToggleCombined }: CameraPreviewPanelProps) {
  const getTallyClass = (cameraId: string) => {
    if (programCameraId && cameraId === programCameraId) return "camera-card tally-program";
    if (cameraId === activeCameraId) return "camera-card tally-preview";
    return "camera-card";
  };

  return (
    <section className="camera-panel">
      <div className="panel-header camera-panel-header">
        <div>
          <p>Cameras</p>
          <span className="muted" style={{ fontSize: 12, color: "var(--muted)" }}>{cameras.filter((c) => c.status === "online").length}/{cameras.length} online</span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {onOpenCameraModal && (
            <button type="button" className="button outline" onClick={onOpenCameraModal}>
              Add Camera
            </button>
          )}
          {/* overlay toggle removed per user request */}
          {onToggleFullScreen && (
            <button type="button" className={`button outline ${isFullScreen ? "active" : ""}`} onClick={onToggleFullScreen}>
              {isFullScreen ? "Exit Full Screen" : "Full Screen"}
            </button>
          )}
          {onToggleCombined && cameras.length > 1 && (
            <button type="button" className={`button outline ${combined ? "active" : ""}`} onClick={onToggleCombined}>
              {combined ? "Single View" : "Combine Cameras"}
            </button>
          )}
        </div>
      </div>
      <div className="camera-grid">
        {cameras.map((camera) => (
          <div
            key={camera.id}
            className={getTallyClass(camera.id)}
            style={{ position: "relative" }}
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
                  {streams?.[camera.id]?.getAudioTracks().length ? <span className="status audio-present">AUDIO</span> : null}
                  {/* overlay badge removed per user request */}
                </div>
              </div>
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
