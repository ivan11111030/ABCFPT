"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createSocketClient } from "@/src/lib/socket";

const socket = createSocketClient();

const resolutions = [
  { value: "720p", label: "720p" },
  { value: "1080p", label: "1080p" },
];

export default function MobileCameraPage() {
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

  const startLocalCamera = async () => {
    setStreamState("starting");
    const constraints: MediaStreamConstraints = {
      video: { facingMode, width: resolution === "1080p" ? 1920 : 1280, height: resolution === "1080p" ? 1080 : 720 },
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
      name: `Phone Camera (${navigator.platform || "Mobile"})`,
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
    setFacingMode((current) => (current === "environment" ? "user" : "environment"));
    stopCamera();
    await startLocalCamera();
  };

  const connectionBadge = useMemo(() => {
    if (status === "connected") return "Connected to server";
    if (status === "disconnected") return "Waiting for connection";
    return "Unknown";
  }, [status]);

  const streamStateLabel = useMemo(() => {
    if (streamState === "ready") return "Camera ready";
    if (streamState === "connecting") return "Connecting...";
    if (streamState === "starting") return "Starting camera";
    if (streamState === "error") return "Camera error";
    return "Camera inactive";
  }, [streamState]);

  return (
    <main className="mobile-camera-shell">
      <header className="panel-header preview-header">
        <div>
          <p className="eyebrow">Mobile Camera</p>
          <h1>Use this phone as a wireless livestream camera.</h1>
        </div>
        <div className="badge-row">
          <span className={`status-pill ${status === "connected" ? "active" : "offline"}`}>{connectionBadge}</span>
        </div>
      </header>

      <section className="mobile-preview-card">
        <video ref={videoRef} autoPlay muted playsInline className="mobile-video-preview" />
        <div className="mobile-preview-overlay">
          <span>{streamStateLabel}</span>
          <span className={`signal signal-${signalStrength}`}>● {signalStrength}</span>
        </div>
      </section>

      <section className="mobile-controls">
        <button className="button primary" onClick={startLocalCamera} disabled={cameraEnabled}>
          Activate Camera
        </button>

        <div className="control-group">
          <button className="button subtle" onClick={switchCamera} disabled={!cameraEnabled}>
            Switch Camera
          </button>

          <label>
            Audio
            <input type="checkbox" checked={audioEnabled} onChange={() => setAudioEnabled((current) => !current)} />
          </label>
        </div>

        <label>
          Resolution
          <select value={resolution} onChange={(event) => setResolution(event.target.value)}>
            {resolutions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <button
          className="button broadcast"
          onClick={connectStream}
          disabled={!cameraEnabled || streamState === "connecting" || status !== "connected"}
        >
          GO LIVE
        </button>

        <button className="button outline" onClick={stopCamera} disabled={!cameraEnabled}>
          Stop Camera
        </button>
      </section>
    </main>
  );
}
