"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getIceServers } from "@/src/lib/realtimeConfig";
import { createSocketClient } from "@/src/lib/socket";

const socket = createSocketClient();
const iceServers = getIceServers();

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
  const autoStart = searchParams.get("autostart") === "1";
  const autoConnect = searchParams.get("autoconnect") === "1";
  const initialResolution = searchParams.get("resolution");
  const cameraIdRef = useRef(`camera-phone-${Date.now()}`);
  const pendingConnectRef = useRef(false);
  const [status, setStatus] = useState("disconnected");
  const [streamState, setStreamState] = useState("idle");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [resolution, setResolution] = useState(initialResolution === "1080p" ? "1080p" : "720p");
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [signalStrength, setSignalStrength] = useState("good");
  const [errorMessage, setErrorMessage] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const snapshotIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const webrtcTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [streamMode, setStreamMode] = useState<"webrtc" | "snapshot" | "none">("none");

  const removeCameraFromControl = () => {
    socket.emit("camera:remove", cameraIdRef.current);
  };

  const closePeerConnection = () => {
    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }
  };

  const stopSnapshotMode = () => {
    if (snapshotIntervalRef.current) {
      clearInterval(snapshotIntervalRef.current);
      snapshotIntervalRef.current = null;
    }
  };

  const startSnapshotMode = () => {
    stopSnapshotMode();
    setStreamMode("snapshot");
    setStreamState("streaming");
    setSignalStrength("fair");
    setErrorMessage("");

    const fps = 8; // 8 fps through socket — decent for a camera feed
    snapshotIntervalRef.current = setInterval(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      canvas.width = 640;
      canvas.height = 360;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, 640, 360);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.6);

      socket.emit("mobile-camera:snapshot", {
        cameraId: cameraIdRef.current,
        frame: dataUrl,
      });
    }, 1000 / fps);
  };

  useEffect(() => {
    const emitJoin = () => {
      socket.emit("mobile-camera:join", {
        cameraId: cameraIdRef.current,
        device: navigator.userAgent,
        cameraName,
        supportedResolutions: ["720p", "1080p"],
      });
    };

    socket.on("connect", () => {
      setStatus("connected");
      emitJoin();

      if (pendingConnectRef.current && streamRef.current) {
        void connectStream(true);
      }
    });

    socket.on("disconnect", () => {
      setStatus("disconnected");
      setStreamState((current) => (current === "streaming" ? "connecting" : current));
    });

    // If socket was already connected before listeners were attached, join immediately.
    if (socket.connected) {
      setStatus("connected");
      emitJoin();
    }
    socket.on("mobile-camera:answer", async (payload: any) => {
      const description: RTCSessionDescriptionInit = payload?.description ?? payload;
      const payloadCameraId: string | undefined = payload?.cameraId;

      if (payloadCameraId && payloadCameraId !== cameraIdRef.current) return;

      if (pcRef.current && description?.type) {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(description));
        setStreamState("streaming");
        setErrorMessage("");
      }
    });

    socket.on("mobile-camera:candidate", async (payload: any) => {
      const candidate: RTCIceCandidateInit = payload?.candidate ?? payload;
      const payloadCameraId: string | undefined = payload?.cameraId;

      if (payloadCameraId && payloadCameraId !== cameraIdRef.current) return;

      if (pcRef.current && candidate?.candidate) {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    return () => {
      closePeerConnection();
      stopSnapshotMode();
      removeCameraFromControl();
      socket.off("connect");
      socket.off("disconnect");
      socket.off("mobile-camera:answer");
      socket.off("mobile-camera:candidate");
    };
  }, [cameraName]);

  useEffect(() => {
    const cleanup = () => {
      closePeerConnection();
      stopSnapshotMode();
      removeCameraFromControl();
    };

    window.addEventListener("beforeunload", cleanup);
    return () => window.removeEventListener("beforeunload", cleanup);
  }, []);

  const startLocalCamera = async (overrideFacing?: "user" | "environment") => {
    setStreamState("starting");
    setErrorMessage("");
    const facing = overrideFacing ?? facingMode;

    try {
      closePeerConnection();
      streamRef.current?.getTracks().forEach((track) => track.stop());

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: resolution === "1080p" ? 1920 : 1280 },
          height: { ideal: resolution === "1080p" ? 1080 : 720 },
        },
        audio: audioEnabled,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      socket.emit("camera:add", {
        id: cameraIdRef.current,
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
      setCameraEnabled(true);
      setStreamState("ready");
      setSignalStrength("good");

      if (pendingConnectRef.current && socket.connected) {
        await connectStream(true);
      }
    } catch (error) {
      console.error(error);
      setStreamState("error");
      setErrorMessage("Camera permission was denied or the selected camera mode is unavailable.");
    }
  };

  const stopCamera = () => {
    pendingConnectRef.current = false;
    if (webrtcTimeoutRef.current) { clearTimeout(webrtcTimeoutRef.current); webrtcTimeoutRef.current = null; }
    stopSnapshotMode();
    closePeerConnection();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraEnabled(false);
    setStreamState("idle");
    setStreamMode("none");
    setErrorMessage("");
    removeCameraFromControl();
  };

  const connectStream = async (skipEnsureCamera = false) => {
    pendingConnectRef.current = true;

    if (!socket.connected) {
      setStreamState("connecting");
      return;
    }

    if (!streamRef.current) {
      if (skipEnsureCamera) return;
      await startLocalCamera();
    }

    if (!streamRef.current) {
      return;
    }

    closePeerConnection();

    const pc = new RTCPeerConnection({ iceServers });
    pcRef.current = pc;

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === "connected") {
        if (webrtcTimeoutRef.current) { clearTimeout(webrtcTimeoutRef.current); webrtcTimeoutRef.current = null; }
        stopSnapshotMode();
        setStreamMode("webrtc");
        setStreamState("streaming");
        setSignalStrength("good");
        setErrorMessage("");
      } else if (state === "connecting") {
        setStreamState("connecting");
      } else if (state === "failed") {
        // WebRTC failed — auto-fallback to snapshot mode
        closePeerConnection();
        startSnapshotMode();
      } else if (state === "disconnected") {
        setStreamState("connecting");
        setSignalStrength("fair");
      } else if (state === "closed") {
        setStreamState(cameraEnabled ? "ready" : "idle");
      }
    };

    streamRef.current.getTracks().forEach((track) => pc.addTrack(track, streamRef.current as MediaStream));

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("mobile-camera:candidate", {
          cameraId: cameraIdRef.current,
          candidate: event.candidate,
        });
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("mobile-camera:offer", {
      cameraId: cameraIdRef.current,
      cameraName,
      description: offer,
    });
    setStreamState("connecting");

    // Auto-fallback: if WebRTC doesn't connect in 8 seconds, use snapshot mode
    if (webrtcTimeoutRef.current) clearTimeout(webrtcTimeoutRef.current);
    webrtcTimeoutRef.current = setTimeout(() => {
      if (pcRef.current && pcRef.current.connectionState !== "connected") {
        closePeerConnection();
        startSnapshotMode();
      }
    }, 8000);
  };

  const switchCamera = async () => {
    const nextFacing = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextFacing);
    const reconnectAfterSwitch = pendingConnectRef.current;
    pendingConnectRef.current = false;
    closePeerConnection();
    await startLocalCamera(nextFacing);

    if (reconnectAfterSwitch) {
      pendingConnectRef.current = true;
      await connectStream();
    }
  };

  useEffect(() => {
    if (!autoStart) return;

    pendingConnectRef.current = autoConnect;
    void startLocalCamera();
  }, [autoStart, autoConnect]);

  const connectionBadge = useMemo(() => {
    if (status === "connected") return "Connected to Production";
    return "Waiting for connection";
  }, [status]);

  const streamStateLabel = useMemo(() => {
    if (streamState === "ready") return "🟢 Camera Ready";
    if (streamState === "streaming" && streamMode === "snapshot") return "🟠 Live (Relay Mode)";
    if (streamState === "streaming") return "🔴 Live in Production";
    if (streamState === "connecting") return "🟡 Connecting...";
    if (streamState === "starting") return "🟡 Starting camera";
    if (streamState === "error") return "🔴 Camera error";
    return "Camera inactive";
  }, [streamState, streamMode]);

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
        <canvas ref={canvasRef} style={{ display: "none" }} />
        <div className="mobile-preview-overlay">
          <span>{streamStateLabel}</span>
          <span className={`signal signal-${signalStrength}`}>● {signalLabel}</span>
        </div>
      </section>

      {/* Controls */}
      <section className="mobile-controls">
        <button className="button primary" onClick={() => startLocalCamera()} disabled={cameraEnabled} style={{ padding: "16px", fontSize: "16px" }}>
          {autoStart ? "Camera Activated" : "Activate Camera"}
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
          onClick={() => void connectStream()}
          disabled={!cameraEnabled || streamState === "connecting" || streamState === "streaming" || status !== "connected"}
        >
          {streamState === "streaming" ? "LIVE" : "GO LIVE"}
        </button>

        {errorMessage && (
          <p style={{ margin: 0, fontSize: 13, color: "var(--danger)" }}>{errorMessage}</p>
        )}

        <button className="button danger" onClick={stopCamera} disabled={!cameraEnabled} style={{ width: "100%", padding: "14px" }}>
          Stop Camera
        </button>
      </section>
    </main>
  );
}
