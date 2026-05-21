"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type TopBarProps = {
  title: string;
  badge: string;
  currentSong?: string;
  isLive?: boolean;
  cameraCount?: number;
  onlineCameraCount?: number;
  activeScene?: string;
  showRightPanel?: boolean;
  onToggleRightPanel?: () => void;
};

export function TopBar({ title, badge, currentSong, isLive, cameraCount, onlineCameraCount, activeScene, showRightPanel, onToggleRightPanel }: TopBarProps) {
  const [elapsed, setElapsed] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!isLive) {
      setElapsed(0);
      return;
    }
    const interval = setInterval(() => setElapsed((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [isLive]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    // Initialize state
    setIsFullscreen(Boolean(document.fullscreenElement));
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (e) {
      // ignore failures (user gesture required in some browsers)
      // Could surface UI feedback here if desired.
    }
  };

  const minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const seconds = String(elapsed % 60).padStart(2, "0");

  return (
    <header className="topbar">
      <div className="topbar-left">
        <span className="topbar-title">{title}</span>
        {isLive && <span className="status-pill live">🔴 LIVE</span>}
        <nav className="topbar-nav">
          <Link href="/control" className="topbar-nav-link">Control</Link>
          <Link href="/songs" className="topbar-nav-link">Songs</Link>
          <Link href="/teleprompter" className="topbar-nav-link">Teleprompter</Link>
          <Link href="/projector" className="topbar-nav-link">Projector</Link>
        </nav>
      </div>
      <div className="topbar-info">
        {activeScene && (
          <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, background: "rgba(79,195,247,0.12)", color: "var(--accent)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {activeScene}
          </span>
        )}
        {cameraCount !== undefined && (
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            📷 {onlineCameraCount ?? 0}/{cameraCount}
          </span>
        )}
        {currentSong && (
          <span className="topbar-song">
            Now: <strong>{currentSong}</strong>
          </span>
        )}
        <span className="topbar-timer">{isLive ? `${minutes}:${seconds}` : "--:--"}</span>
      </div>
      <div className="topbar-right">
        {onToggleRightPanel && (
          <button type="button" className="button subtle topbar-toggle" onClick={onToggleRightPanel}>
            {showRightPanel ? "Hide Panel ◀" : "Show Panel ▶"}
          </button>
        )}
        <button type="button" className="button subtle topbar-toggle" onClick={toggleFullscreen} aria-pressed={isFullscreen} aria-label={isFullscreen ? "Exit full screen" : "Enter full screen"}>
          {isFullscreen ? "Exit Full Screen ✕" : "Full Screen ⛶"}
        </button>
        <span className={`status-pill ${badge === "Live Sync" ? "active" : "offline"}`}>
          {badge === "Live Sync" ? "🟢" : "🔴"} {badge}
        </span>
      </div>
    </header>
  );
}
