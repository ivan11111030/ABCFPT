"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type TopBarProps = {
  title: string;
  badge: string;
  currentSong?: string;
  isLive?: boolean;
  showRightPanel?: boolean;
  onToggleRightPanel?: () => void;
};

export function TopBar({ title, badge, currentSong, isLive, showRightPanel, onToggleRightPanel }: TopBarProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isLive) {
      setElapsed(0);
      return;
    }
    const interval = setInterval(() => setElapsed((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [isLive]);

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
        <span className={`status-pill ${badge === "Live Sync" ? "active" : "offline"}`}>
          {badge === "Live Sync" ? "🟢" : "🔴"} {badge}
        </span>
      </div>
    </header>
  );
}
