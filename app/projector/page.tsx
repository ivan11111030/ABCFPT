"use client";

import { useEffect, useRef, useState } from "react";
import { createSocketClient } from "@/src/lib/socket";
import { sampleSongs } from "@/src/lib/fakeData";
import { DraggableOverlay, LAYOUT_PRESETS, type OverlayPosition } from "@/src/components/DraggableOverlay";
import type { Song } from "@/src/types/production";

const socket = createSocketClient();

export default function ProjectorPage() {
  const [song, setSong] = useState<Song>(sampleSongs[0]);
  const [slideIndex, setSlideIndex] = useState(0);
  const [overlayEnabled, setOverlayEnabled] = useState(true);
  const [overlayPos, setOverlayPos] = useState<OverlayPosition>(LAYOUT_PRESETS["lower-third"]);
  const [hasVideoStream, setHasVideoStream] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    socket.on("control:slide", setSlideIndex);
    socket.on("control:song", (songId: string) => {
      const nextSong = sampleSongs.find((item) => item.id === songId);
      if (nextSong) {
        setSong(nextSong);
        setSlideIndex(0);
      }
    });

    socket.on("stream:overlayToggled", (payload: { enabled: boolean }) => {
      setOverlayEnabled(payload.enabled);
    });

    socket.on("stream:overlayPosition", (pos: OverlayPosition) => {
      setOverlayPos(pos);
    });

    // Receive the active camera's WebRTC offer forwarded by control
    socket.on("projector:offer", async (payload: { description: RTCSessionDescriptionInit }) => {
      if (!payload.description?.type) return;

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
      });
      pcRef.current = pc;

      pc.ontrack = (event) => {
        const [stream] = event.streams;
        if (stream && videoRef.current) {
          videoRef.current.srcObject = stream;
          setHasVideoStream(true);
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("projector:candidate", event.candidate);
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(payload.description));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("projector:answer", answer);
    });

    socket.on("projector:candidate", async (candidate: RTCIceCandidateInit) => {
      if (pcRef.current && candidate?.candidate) {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    return () => {
      socket.off("control:slide");
      socket.off("control:song");
      socket.off("stream:overlayToggled");
      socket.off("stream:overlayPosition");
      socket.off("projector:offer");
      socket.off("projector:candidate");
      pcRef.current?.close();
    };
  }, []);

  const currentSlide = song.slides[slideIndex] ?? song.slides[0];

  return (
    <main className="projector-screen">
      {/* Video background when stream is available */}
      {hasVideoStream && (
        <video ref={videoRef} autoPlay muted playsInline className="projector-video-bg" />
      )}

      {/* If no video stream, show lyrics fullscreen (classic mode) */}
      {!hasVideoStream && (
        <div className="projector-content">
          <p className="projector-line" key={`${song.id}-${slideIndex}`}>
            {currentSlide.text}
          </p>
          <p className="projector-section">
            {currentSlide.section} • {song.title}
          </p>
        </div>
      )}

      {/* Lyrics overlay on top of video */}
      {hasVideoStream && overlayEnabled && (
        <DraggableOverlay position={overlayPos} interactive={false}>
          <div className="overlay-lyrics projector-overlay-lyrics">
            <p key={`${song.id}-${slideIndex}`}>{currentSlide.text}</p>
            <span className="overlay-section">{currentSlide.section} • {song.title}</span>
          </div>
        </DraggableOverlay>
      )}
    </main>
  );
}
