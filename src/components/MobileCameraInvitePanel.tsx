"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

export function MobileCameraInvitePanel() {
  const [qrData, setQrData] = useState<string>("");
  const [cameraName, setCameraName] = useState("Phone Camera");
  const [connectionUrl, setConnectionUrl] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const baseUrl = window.location.origin;
    const mobileUrl = `${baseUrl}/mobile-camera`;
    setConnectionUrl(mobileUrl);
    QRCode.toDataURL(mobileUrl)
      .then(setQrData)
      .catch(() => setQrData(""));
  }, []);

  const mobileLabel = useMemo(() => `${cameraName} invite`, [cameraName]);

  return (
    <section className="mobile-invite-panel">
      <div className="panel-header">
        <p>Mobile Camera Connect</p>
      </div>
      <div className="camera-invite-grid">
        <div className="invite-card">
          <label>
            Camera name
            <input
              type="text"
              value={cameraName}
              onChange={(event) => setCameraName(event.target.value)}
              placeholder="Phone Camera 1"
            />
          </label>
          <p className="muted-note">Scan the QR code with the mobile device on the same WiFi network.</p>
          <div className="qr-frame">
            {qrData ? <img src={qrData} alt={`QR code for ${mobileLabel}`} /> : <div className="qr-fallback">Generating QR code…</div>}
          </div>
          <p className="connection-url">{connectionUrl}</p>
        </div>
      </div>
    </section>
  );
}
