"use client";

import { useRef, useState } from "react";

type ExternalPresentationPanelProps = {
  active: boolean;
  mode: "presentation" | "camera-overlay";
  cameraPosition: { x: number; y: number; width: number };
  cameraHeight: number;
  onModeChange: (mode: "presentation" | "camera-overlay") => void;
  onCameraPositionChange: (position: { x: number; y: number; width: number }) => void;
  onCameraHeightChange: (height: number) => void;
  onStart: (stream: MediaStream) => void;
  onStop: () => void;
};

export function ExternalPresentationPanel({ active, mode, cameraPosition, cameraHeight, onModeChange, onCameraPositionChange, onCameraHeightChange, onStart, onStop }: ExternalPresentationPanelProps) {
  const [status, setStatus] = useState("");
  const streamRef = useRef<MediaStream | null>(null);

  const selectPowerPoint = async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setStatus("Window capture is not supported in this browser");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30, max: 60 } },
        audio: false,
      });
      streamRef.current = stream;
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        streamRef.current = null;
        onStop();
        setStatus("PowerPoint window disconnected");
      });
      onStart(stream);
      setStatus("PowerPoint window ready");
    } catch (error) {
      if ((error as DOMException)?.name !== "AbortError") {
        setStatus("Window capture was not granted");
      }
    }
  };

  const stopCapture = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    onStop();
    setStatus("PowerPoint window disconnected");
  };

  return (
    <section className="scene-panel external-presentation-panel">
      <div className="panel-header">
        <div>
          <p>External Presentation</p>
          <span className="panel-purpose">Capture a PowerPoint window into the live program</span>
        </div>
        <span className={`status-pill ${active ? "active" : "pending"}`}>{active ? "Ready" : "Off"}</span>
      </div>
      {!active ? (
        <button type="button" className="button outline" onClick={selectPowerPoint}>
          Select PowerPoint Window
        </button>
      ) : (
        <button type="button" className="button danger" onClick={stopCapture}>
          Disconnect PowerPoint
        </button>
      )}
      <label className="external-presentation-mode">
        Live layout
        <select value={mode} onChange={(event) => onModeChange(event.target.value as "presentation" | "camera-overlay")}>
          <option value="presentation">PowerPoint full screen</option>
          <option value="camera-overlay">Camera over PowerPoint</option>
        </select>
      </label>
      {mode === "camera-overlay" && (
        <div className="external-camera-controls">
          <label>X position<input type="range" min="0" max="75" value={cameraPosition.x} onChange={(event) => onCameraPositionChange({ ...cameraPosition, x: Number(event.target.value) })} /></label>
          <label>Y position<input type="range" min="0" max="75" value={cameraPosition.y} onChange={(event) => onCameraPositionChange({ ...cameraPosition, y: Number(event.target.value) })} /></label>
          <label>Camera size<input type="range" min="15" max="60" value={cameraPosition.width} onChange={(event) => onCameraPositionChange({ ...cameraPosition, width: Number(event.target.value) })} /></label>
          <label>Camera height<input type="range" min="15" max="60" value={cameraHeight} onChange={(event) => onCameraHeightChange(Number(event.target.value))} /></label>
        </div>
      )}
      <p className="external-presentation-help">
        Choose the PowerPoint window in the browser picker. Enable it in the live compositor before going live.
      </p>
      {status && <p className="external-presentation-status">{status}</p>}
    </section>
  );
}
