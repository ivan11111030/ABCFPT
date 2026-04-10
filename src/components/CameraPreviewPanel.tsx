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
        <p>Camera Preview</p>
        <p>{cameras.length} cameras found</p>
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
              <span>{camera.protocol}</span>
            </div>
            <div className="camera-meta">
              <strong>{camera.name}</strong>
              <small>{camera.streamUrl}</small>
              <div className="camera-footer">
                <span className={camera.status === "online" ? "status online" : camera.status === "offline" ? "status offline" : "status unknown"}>
                  {camera.status}
                </span>
                {camera.isMobile && <span className="status mobile">Mobile</span>}
                {camera.signalStrength && <span className={`status signal ${camera.signalStrength}`}>{camera.signalStrength}</span>}
                {camera.supportsPTZ && <span className="status ptz">PTZ</span>}
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
