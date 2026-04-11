"use client";

import { useEffect, useRef, useState } from "react";
import type { Camera } from "@/src/types/production";

type LocalCameraPanelProps = {
  onAddCamera: (camera: Camera, stream?: MediaStream) => void;
};

type DetectedDevice = {
  deviceId: string;
  label: string;
};

export function LocalCameraPanel({ onAddCamera }: LocalCameraPanelProps) {
  const [devices, setDevices] = useState<DetectedDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const detectCameras = async () => {
    setDetecting(true);
    try {
      // Request permission first so labels are available
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
      tempStream.getTracks().forEach((t) => t.stop());

      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices
        .filter((d) => d.kind === "videoinput")
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${d.deviceId.slice(0, 6)}`,
        }));
      setDevices(videoDevices);
      if (videoDevices.length > 0 && !selectedDevice) {
        setSelectedDevice(videoDevices[0].deviceId);
      }
    } catch (err) {
      console.error("Camera detection failed:", err);
    }
    setDetecting(false);
  };

  const startPreview = async () => {
    if (!selectedDevice) return;
    stopPreview();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: selectedDevice }, width: 1280, height: 720 },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setPreviewing(true);
    } catch (err) {
      console.error("Preview failed:", err);
    }
  };

  const stopPreview = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setPreviewing(false);
  };

  const addAsCamera = () => {
    const device = devices.find((d) => d.deviceId === selectedDevice);
    if (!device) return;

    const camera: Camera = {
      id: `usb-${device.deviceId.slice(0, 8)}`,
      name: device.label,
      protocol: "WebRTC",
      ipAddress: "local",
      streamUrl: `local://${device.deviceId}`,
      status: "online",
      supportsPTZ: false,
      signalStrength: "good",
    };
    onAddCamera(camera, streamRef.current ?? undefined);
  };

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <section className="local-camera-panel">
      <div className="panel-header">
        <p>USB / Webcam</p>
      </div>

      <button type="button" className="button outline" onClick={detectCameras} disabled={detecting} style={{ width: "100%" }}>
        {detecting ? "Detecting…" : devices.length > 0 ? "Re-detect Cameras" : "Detect Local Cameras"}
      </button>

      {devices.length > 0 && (
        <>
          <label className="local-camera-select">
            Select Camera
            <select value={selectedDevice} onChange={(e) => { setSelectedDevice(e.target.value); stopPreview(); }}>
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
              ))}
            </select>
          </label>

          <div className="local-camera-preview">
            <video ref={videoRef} autoPlay muted playsInline className="local-camera-video" />
          </div>

          <div className="local-camera-actions">
            {!previewing ? (
              <button type="button" className="button outline" onClick={startPreview}>Preview</button>
            ) : (
              <>
                <button type="button" className="button primary" onClick={addAsCamera}>Add to Cameras</button>
                <button type="button" className="button subtle" onClick={stopPreview}>Stop</button>
              </>
            )}
          </div>
        </>
      )}

      {devices.length === 0 && !detecting && (
        <p style={{ color: "var(--muted)", fontSize: "var(--font-label)", textAlign: "center", padding: "var(--sp-1) 0" }}>
          Click detect to find USB cameras & webcams connected to this computer.
        </p>
      )}
    </section>
  );
}
