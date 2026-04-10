"use client";

import { useState } from "react";
import type { Camera, CameraProtocol } from "@/src/types/production";

const protocols: CameraProtocol[] = ["RTSP", "NDI", "ONVIF", "WebRTC"];

type CameraDiscoveryPanelProps = {
  onAddCamera?: (camera: Camera) => void;
};

export function CameraDiscoveryPanel({ onAddCamera }: CameraDiscoveryPanelProps) {
  const [cameraName, setCameraName] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [streamUrl, setStreamUrl] = useState("");
  const [protocol, setProtocol] = useState<CameraProtocol>("RTSP");

  const handleAddCamera = () => {
    if (!cameraName || !streamUrl) {
      return;
    }

    const camera: Camera = {
      id: `camera-${Date.now()}`,
      name: cameraName,
      protocol,
      ipAddress,
      streamUrl,
      status: "online",
      supportsPTZ: false,
      signalStrength: "good",
    };

    onAddCamera?.(camera);
    setCameraName("");
    setIpAddress("");
    setStreamUrl("");
    setProtocol("RTSP");
  };

  return (
    <section className="discovery-panel">
      <div className="panel-header">
        <p>Network Camera Entry</p>
      </div>
      <form className="camera-entry-form" onSubmit={(event) => event.preventDefault()}>
        <label>
          Camera Name
          <input value={cameraName} onChange={(event) => setCameraName(event.target.value)} type="text" placeholder="Stage Wide Camera" />
        </label>
        <label>
          Camera IP Address
          <input value={ipAddress} onChange={(event) => setIpAddress(event.target.value)} type="text" placeholder="192.168.1.120" />
        </label>
        <label>
          Stream URL
          <input value={streamUrl} onChange={(event) => setStreamUrl(event.target.value)} type="text" placeholder="rtsp://192.168.1.120/stream" />
        </label>
        <label>
          Protocol Type
          <select value={protocol} onChange={(event) => setProtocol(event.target.value as CameraProtocol)}>
            {protocols.map((protocolOption) => (
              <option key={protocolOption} value={protocolOption}>
                {protocolOption}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="button primary" onClick={handleAddCamera}>
          Add Camera
        </button>
      </form>
    </section>
  );
}
