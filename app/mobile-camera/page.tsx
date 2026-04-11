"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createSocketClient } from "@/src/lib/socket";

const socket = createSocketClient();

const resolutions = [
  { value: "720p", label: "720p" },
  { value: "1080p", label: "1080p" },
];

export default function MobileCameraPage() {
  return (
    <Suspense fallback={<div style={{ display: "grid", placeItems: "center", minHeight: "100vh", color: "var(--muted)" }}>Loading camera...</div>}>
      <MobileCameraInner />
    </Suspense>
  );
}

function MobileCameraInner() {
  const searchParams = useSearchParams();
  const cameraName = searchParams.get("name") || "Phone Camera";
  const [status, setStatus] = useState("disconnected");
  const [streamState, setStreamState] = useState("idle");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [resolution, setResolution] = useState("720p");
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [signalStrength, setSignalStrength] = useState("good");
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    socket.on("connect", () => {
      setStatus("connected");
      socket.emit("mobile-camera:join", {
        device: navigator.userAgent,
        cameraName,
        supportedResolutions: ["720p", "1080p"],
      });
    });

    socket.on("disconnect", () => setStatus("disconnected"));
    socket.on("mobile-camera:answer", async (description: RTCSessionDescriptionInit) => {
      if (pcRef.current) {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(description));
      }
    });

    socket.on("mobile-camera:candidate", async (candidate: RTCIceCandidateInit) => {
      if (pcRef.current) {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("mobile-camera:answer");
      socket.off("mobile-camera:candidate");
    };
  }, []);

  const startLocalCamera = async (overrideFacing?: "user" | "environment") => {
    setStreamState("starting");
    const facing = overrideFacing ?? facingMode;
    const constraints: MediaStreamConstraints = {
      video: { facingMode: facing, width: resolution === "1080p" ? 1920 : 1280, height: resolution === "1080p" ? 1080 : 720 },
      audio: audioEnabled,
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraEnabled(true);
      setStreamState("ready");
    } catch (error) {
      console.error(error);
      setStreamState("error");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraEnabled(false);
    setStreamState("idle");
  };

  const connectStream = async () => {
    if (!streamRef.current) {
      await startLocalCamera();
    }

    if (!streamRef.current) {
      return;
    }

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
    });
    pcRef.current = pc;

    streamRef.current.getTracks().forEach((track) => pc.addTrack(track, streamRef.current as MediaStream));

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("mobile-camera:candidate", event.candidate);
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("mobile-camera:offer", offer);
    socket.emit("camera:add", {
      id: `camera-phone-${Date.now()}`,
      name: cameraName,
      protocol: "WebRTC",
      ipAddress: "",
      streamUrl: "webrtc://mobile",
      status: "online",
      supportsPTZ: false,
      isMobile: true,
      enabled: true,
      signalStrength: "good",
    });
    setStreamState("connecting");
  };

  const switchCamera = async () => {
    const nextFacing = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextFacing);
    stopCamera();
    await startLocalCamera(nextFacing);
  };

  const connectionBadge = useMemo(() => {
    if (status === "connected") return "Connected to Production";
    return "Waiting for connection";
  }, [status]);

  const streamStateLabel = useMemo(() => {
    if (streamState === "ready") return "🟢 Camera Ready";
    if (streamState === "connecting") return "🟡 Connecting...";
    if (streamState === "starting") return "🟡 Starting camera";
    if (streamState === "error") return "🔴 Camera error";
    return "Camera inactive";
  }, [streamState]);

  const signalLabel = useMemo(() => {
    if (signalStrength === "good") return "Signal: Strong";
    if (signalStrength === "fair") return "Signal: Fair";
    return "Signal: Weak";
  }, [signalStrength]);

  return (
    <main className="mobile-camera-shell">
      {/* Header */}
      <div className="mobile-camera-header">
        <h1>{cameraName}</h1>
        <p>{connectionBadge}</p>
        <span className={`status-pill ${status === "connected" ? "active" : "offline"}`}>
          {status === "connected" ? "🟢" : "🔴"} {status}
        </span>
      </div>

      {/* Video Preview (full width, dominant) */}
      <section className="mobile-preview-card">
        <video ref={videoRef} autoPlay muted playsInline className="mobile-video-preview" />
        <div className="mobile-preview-overlay">
          <span>{streamStateLabel}</span>
          <span className={`signal signal-${signalStrength}`}>● {signalLabel}</span>
        </div>
      </section>

      {/* Controls */}
      <section className="mobile-controls">
        <button className="button primary" onClick={() => startLocalCamera()} disabled={cameraEnabled} style={{ padding: "16px", fontSize: "16px" }}>
          Activate Camera
        </button>

        <div className="control-group">
          <button className="button outline" onClick={switchCamera} disabled={!cameraEnabled} style={{ flex: 1 }}>
            Switch Camera
          </button>
          <label style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--muted)" }}>
            Audio
            <input type="checkbox" checked={audioEnabled} onChange={() => setAudioEnabled((c) => !c)} />
          </label>
        </div>

        <div className="mobile-meta-row">
          <span>Resolution: {resolution}</span>
          <select value={resolution} onChange={(e) => setResolution(e.target.value)} style={{
            padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border)",
            background: "var(--card)", color: "var(--text)", fontSize: 14
          }}>
            {resolutions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <button
          className="button broadcast"
          onClick={connectStream}
          disabled={!cameraEnabled || streamState === "connecting" || status !== "connected"}
        >
          GO LIVE
        </button>

        <button className="button danger" onClick={stopCamera} disabled={!cameraEnabled} style={{ width: "100%", padding: "14px" }}>
          Stop Camera
        </button>
      </section>
    </main>
  );
}
