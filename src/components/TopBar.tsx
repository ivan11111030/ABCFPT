"use client";

import { useEffect, useState } from "react";

type TopBarProps = {
  title: string;
  badge: string;
  currentSong?: string;
  isLive?: boolean;
};

export function TopBar({ title, badge, currentSong, isLive }: TopBarProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setElapsed((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const seconds = String(elapsed % 60).padStart(2, "0");

  return (
    <header className="topbar">
      <div className="topbar-left">
        <span className="topbar-title">{title}</span>
        {isLive && <span className="status-pill live">🔴 LIVE</span>}
      </div>
      <div className="topbar-info">
        {currentSong && (
          <span className="topbar-song">
            Now: <strong>{currentSong}</strong>
          </span>
        )}
        <span className="topbar-timer">{minutes}:{seconds}</span>
      </div>
      <div className="topbar-right">
        <span className={`status-pill ${badge === "Live Sync" ? "active" : "offline"}`}>
          {badge === "Live Sync" ? "🟢" : "🔴"} {badge}
        </span>
      </div>
    </header>
  );
}
