"use client";

import { useEffect, useRef, useState } from "react";

type AudioDevice = {
  deviceId: string;
  label: string;
};

export function AudioMonitorPanel() {
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState("");
  const [detecting, setDetecting] = useState(false);
  const [monitoring, setMonitoring] = useState(false);
  const [levelLeft, setLevelLeft] = useState(0);
  const [levelRight, setLevelRight] = useState(0);
  const [peak, setPeak] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserLRef = useRef<AnalyserNode | null>(null);
  const analyserRRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);

  const detectDevices = async () => {
    setDetecting(true);
    try {
      const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      tempStream.getTracks().forEach((t) => t.stop());

      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const audioDevices = allDevices
        .filter((d) => d.kind === "audioinput")
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Audio Input ${d.deviceId.slice(0, 6)}`,
        }));
      setDevices(audioDevices);
      if (audioDevices.length > 0 && !selectedDevice) {
        setSelectedDevice(audioDevices[0].deviceId);
      }
    } catch (err) {
      console.error("Audio detection failed:", err);
    }
    setDetecting(false);
  };

  const startMonitoring = async () => {
    if (!selectedDevice) return;
    stopMonitoring();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: selectedDevice } },
      });
      streamRef.current = stream;

      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const splitter = ctx.createChannelSplitter(2);

      const analyserL = ctx.createAnalyser();
      analyserL.fftSize = 256;
      const analyserR = ctx.createAnalyser();
      analyserR.fftSize = 256;

      source.connect(splitter);
      splitter.connect(analyserL, 0);
      try {
        splitter.connect(analyserR, 1);
      } catch {
        splitter.connect(analyserR, 0);
      }

      analyserLRef.current = analyserL;
      analyserRRef.current = analyserR;

      setMonitoring(true);

      const update = () => {
        const bufferL = new Uint8Array(analyserL.frequencyBinCount);
        const bufferR = new Uint8Array(analyserR.frequencyBinCount);
        analyserL.getByteFrequencyData(bufferL);
        analyserR.getByteFrequencyData(bufferR);

        const avgL = bufferL.reduce((sum, val) => sum + val, 0) / bufferL.length / 255;
        const avgR = bufferR.reduce((sum, val) => sum + val, 0) / bufferR.length / 255;

        setLevelLeft(avgL);
        setLevelRight(avgR);
        setPeak(avgL > 0.9 || avgR > 0.9);

        rafRef.current = requestAnimationFrame(update);
      };

      rafRef.current = requestAnimationFrame(update);
    } catch (err) {
      console.error("Audio monitoring failed:", err);
    }
  };

  const stopMonitoring = () => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close().catch(() => {});
    streamRef.current = null;
    audioCtxRef.current = null;
    analyserLRef.current = null;
    analyserRRef.current = null;
    setMonitoring(false);
    setLevelLeft(0);
    setLevelRight(0);
    setPeak(false);
  };

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  return (
    <section className="audio-panel">
      <div className="panel-header">
        <p>Audio Monitor</p>
      </div>

      <button
        type="button"
        className="button outline"
        onClick={detectDevices}
        disabled={detecting}
        style={{ width: "100%", marginBottom: 8 }}
      >
        {detecting ? "Detecting…" : devices.length > 0 ? "Re-detect Audio Devices" : "Detect Audio Devices"}
      </button>

      {devices.length > 0 && (
        <>
          <label style={{ display: "block", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Audio Source</span>
            <select
              value={selectedDevice}
              onChange={(e) => {
                setSelectedDevice(e.target.value);
                if (monitoring) stopMonitoring();
              }}
              style={{
                width: "100%",
                padding: "6px 8px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--card)",
                color: "var(--text)",
                fontSize: 13,
              }}
            >
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>

          {!monitoring ? (
            <button type="button" className="button primary" style={{ width: "100%", marginBottom: 8 }} onClick={startMonitoring}>
              Start Monitoring
            </button>
          ) : (
            <button type="button" className="button danger" style={{ width: "100%", marginBottom: 8 }} onClick={stopMonitoring}>
              Stop Monitoring
            </button>
          )}
        </>
      )}

      <div className="audio-line">
        <span>Source</span>
        <strong>{monitoring ? devices.find((d) => d.deviceId === selectedDevice)?.label || "Active" : "None"}</strong>
      </div>
      <div className="meter-group">
        <div>
          <label>Left</label>
          <div className="meter">
            <span className="meter-fill" style={{ width: `${levelLeft * 100}%` }} />
          </div>
        </div>
        <div>
          <label>Right</label>
          <div className="meter">
            <span className="meter-fill" style={{ width: `${levelRight * 100}%` }} />
          </div>
        </div>
      </div>
      <div className={peak ? "peak-indicator active" : "peak-indicator"}>
        {peak ? "⚠ PEAK" : "Peak: Normal"}
      </div>

      {devices.length === 0 && !detecting && (
        <p style={{ color: "var(--muted)", fontSize: "var(--font-label)", textAlign: "center", padding: "var(--sp-1) 0" }}>
          Click detect to find audio input devices (USB mixer, microphone, etc.)
        </p>
      )}
    </section>
  );
}
