"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { getSocketServerUrl } from "@/src/lib/realtimeConfig";

export function MobileCameraInvitePanel() {
  const [qrData, setQrData] = useState<string>("");
  const [cameraName, setCameraName] = useState("Phone Camera");
  const [resolution, setResolution] = useState("720p");
  const [connectionUrl, setConnectionUrl] = useState<string>("");
  const [copyStatus, setCopyStatus] = useState<string>("");
  const socketServerUrl = getSocketServerUrl();
  const usesHostedSocket = /^https?:\/\//.test(socketServerUrl) && !socketServerUrl.includes("localhost");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const base = new URL("../mobile-camera", window.location.href);
    base.searchParams.set("name", cameraName);
    base.searchParams.set("resolution", resolution);
    base.searchParams.set("autostart", "1");
    base.searchParams.set("autoconnect", "1");
    const url = base.toString();
    setConnectionUrl(url);
    QRCode.toDataURL(url)
      .then(setQrData)
      .catch(() => setQrData(""));
  }, [cameraName, resolution]);

  const copyConnectionUrl = async () => {
    if (!connectionUrl) return;
    try {
      await navigator.clipboard.writeText(connectionUrl);
      setCopyStatus("Copied!");
      window.setTimeout(() => setCopyStatus(""), 1500);
    } catch {
      setCopyStatus("Copy failed");
      window.setTimeout(() => setCopyStatus(""), 1500);
    }
  };

  const mobileLabel = useMemo(() => `${cameraName} invite`, [cameraName]);

  return (
    <section className="mobile-invite-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Mobile Camera Connect</p>
          <h2>Invite a phone camera</h2>
        </div>
      </div>
      <div className="camera-invite-grid">
        <div className="invite-card">
          <div className="invite-header">
            <h3>Connect a Phone Camera</h3>
            <p className="muted-note">
              Scan the QR code to open the phone camera page and auto-start the camera.
            </p>
          </div>

          <label className="camera-name-input">
            Camera Name
            <input
              type="text"
              value={cameraName}
              onChange={(event) => setCameraName(event.target.value)}
              placeholder="Stage Phone Camera"
            />
          </label>

          <label className="camera-name-input">
            Preferred Resolution
            <select value={resolution} onChange={(event) => setResolution(event.target.value)}>
              <option value="720p">720p</option>
              <option value="1080p">1080p</option>
            </select>
          </label>

          <p className="muted-note" style={{ margin: "8px 0 0" }}>
            Socket server: {usesHostedSocket ? "Hosted" : "Local / fallback"}
          </p>

          <div className="qr-section">
            {qrData ? (
              <img src={qrData} alt={mobileLabel} />
            ) : (
              <div className="qr-fallback">Generating QR code…</div>
            )}
          </div>

          <div className="invite-link">
            <input value={connectionUrl} readOnly />
            <button type="button" onClick={copyConnectionUrl} disabled={!connectionUrl}>
              {copyStatus || "Copy"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
