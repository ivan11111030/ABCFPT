"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

export function MobileCameraInvitePanel() {
  const [qrData, setQrData] = useState<string>("");
  const [cameraName, setCameraName] = useState("Phone Camera");
  const [connectionUrl, setConnectionUrl] = useState<string>("");
  const [copyStatus, setCopyStatus] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mobileUrl = new URL("../mobile-camera", window.location.href).toString();
    setConnectionUrl(mobileUrl);
    QRCode.toDataURL(mobileUrl)
      .then(setQrData)
      .catch(() => setQrData(""));
  }, []);

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
          <label>
            Camera name
            <input
              type="text"
              value={cameraName}
              onChange={(event) => setCameraName(event.target.value)}
              placeholder="Phone Camera 1"
            />
          </label>
          <p className="muted-note">Scan the QR code or copy the link to open the mobile camera page on the same network.</p>
          <div className="qr-frame">
            {qrData ? <img src={qrData} alt={`QR code for ${mobileLabel}`} /> : <div className="qr-fallback">Generating QR code…</div>}
          </div>
          <div className="invite-actions">
            <button type="button" className="button subtle" onClick={copyConnectionUrl} disabled={!connectionUrl}>
              {copyStatus || "Copy invite link"}
            </button>
            <p className="connection-url">{connectionUrl}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
