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
          <div className="invite-header">
            <h3>Connect a Phone Camera</h3>
            <p className="muted-note">
              Scan the QR code using the phone you want to use as a camera.
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
