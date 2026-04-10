import type { CameraProtocol } from "@/src/types/production";

const protocols: CameraProtocol[] = ["RTSP", "NDI", "ONVIF", "WebRTC"];

export function CameraDiscoveryPanel() {
  return (
    <section className="discovery-panel">
      <div className="panel-header">
        <p>Network Camera Entry</p>
      </div>
      <form className="camera-entry-form">
        <label>
          Camera Name
          <input type="text" placeholder="Stage Wide Camera" />
        </label>
        <label>
          Camera IP Address
          <input type="text" placeholder="192.168.1.120" />
        </label>
        <label>
          Stream URL
          <input type="text" placeholder="rtsp://192.168.1.120/stream" />
        </label>
        <label>
          Protocol Type
          <select>
            {protocols.map((protocol) => (
              <option key={protocol} value={protocol}>
                {protocol}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="button primary">
          Add Camera
        </button>
      </form>
    </section>
  );
}
