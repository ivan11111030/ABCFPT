"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "abcfpt-production-settings";

type Settings = {
  fontSize: number;
  fontColor: string;
  highContrast: boolean;
  backgroundTheme: string;
  transition: "cut" | "fade" | "push" | "wipe";
  obsSource: string;
  overlayLyrics: boolean;
  overlayScripture: boolean;
  overlayVisuals: boolean;
  bitrate: "low" | "medium" | "high" | "ultra";
  quickActions: string[];
  defaultCamera: string;
  resolution: "720p" | "1080p";
  frameRate: "24" | "30" | "60";
  overlayFont: string;
  overlayColor: string;
  overlayOpacity: number;
};

const DEFAULTS: Settings = {
  fontSize: 42,
  fontColor: "#ffffff",
  highContrast: true,
  backgroundTheme: "Deep Ocean",
  transition: "fade",
  obsSource: "ABCF Production Control",
  overlayLyrics: true,
  overlayScripture: true,
  overlayVisuals: true,
  bitrate: "medium",
  quickActions: ["next", "title", "closing"],
  defaultCamera: "Auto-select first online camera",
  resolution: "1080p",
  frameRate: "30",
  overlayFont: "Inter",
  overlayColor: "#ffffff",
  overlayOpacity: 90,
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [saved, setSaved] = useState(false);
  const backgroundInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setSettings({ ...DEFAULTS, ...JSON.parse(stored) });
    } catch {
      // Keep defaults if local storage is unavailable or malformed.
    }
  }, []);

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setSaved(false);
  };

  const saveSettings = () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  };

  const toggleQuickAction = (id: string) => {
    const next = settings.quickActions.includes(id)
      ? settings.quickActions.filter((action) => action !== id)
      : [...settings.quickActions, id];
    update("quickActions", next);
  };

  const handleBackgroundUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => update("backgroundTheme", "Custom image ready in Control Center");
    reader.readAsDataURL(file);
  };

  return (
    <main className="settings-page">
      <header className="settings-header">
        <div>
          <span className="eyebrow">Production configuration</span>
          <h1>Settings</h1>
          <p>Prepare defaults before service. Live actions stay in Control Center.</p>
        </div>
        <div className="settings-header-actions">
          <Link href="/control" className="button subtle">Back to Slides</Link>
          <button type="button" className="button primary" onClick={saveSettings}>{saved ? "Saved" : "Save Settings"}</button>
        </div>
      </header>

      <div className="settings-layout">
        <section className="settings-section">
          <div className="settings-section-heading"><span className="settings-icon">Aa</span><div><h2>Font &amp; readability</h2><p>Global defaults for projector, teleprompter, and overlays.</p></div></div>
          <div className="settings-grid">
            <label>Default font size<input type="number" min={24} max={120} value={settings.fontSize} onChange={(event) => update("fontSize", Number(event.target.value) || 42)} /></label>
            <label>Default font color<input type="color" value={settings.fontColor} onChange={(event) => update("fontColor", event.target.value)} /></label>
            <label className="settings-toggle"><input type="checkbox" checked={settings.highContrast} onChange={(event) => update("highContrast", event.target.checked)} /><span>High-contrast text shadow</span></label>
          </div>
          <p className="settings-note">Per-slide font, size, color, alignment, and emphasis remain available in the Slides tab.</p>
        </section>

        <section className="settings-section">
          <div className="settings-section-heading"><span className="settings-icon">BG</span><div><h2>Background themes</h2><p>Keep worship visuals calm, readable, and consistent.</p></div></div>
          <div className="settings-grid">
            <label>Default theme<select value={settings.backgroundTheme} onChange={(event) => update("backgroundTheme", event.target.value)}><option>Deep Ocean</option><option>Solid Black</option><option>Gradient Flow</option><option>Custom image ready in Control Center</option></select></label>
            <div><input ref={backgroundInputRef} type="file" accept="image/*" hidden onChange={handleBackgroundUpload} /><button type="button" className="button outline" onClick={() => backgroundInputRef.current?.click()}>Upload custom background</button></div>
          </div>
        </section>

        <section className="settings-section">
          <div className="settings-section-heading"><span className="settings-icon">FX</span><div><h2>Transition effects</h2><p>Choose the default motion for lyric and visual changes.</p></div></div>
          <div className="settings-choice-row">{(["cut", "fade", "push", "wipe"] as Settings["transition"][]).map((transition) => <button type="button" key={transition} className={`settings-choice ${settings.transition === transition ? "active" : ""}`} onClick={() => update("transition", transition)}>{transition}</button>)}</div>
        </section>

        <section className="settings-section">
          <div className="settings-section-heading"><span className="settings-icon">OBS</span><div><h2>Livestream &amp; OBS</h2><p>Defaults for the app window source, overlays, and encoder.</p></div></div>
          <div className="settings-grid">
            <label>OBS source name<input value={settings.obsSource} onChange={(event) => update("obsSource", event.target.value)} /></label>
            <label>Bitrate profile<select value={settings.bitrate} onChange={(event) => update("bitrate", event.target.value as Settings["bitrate"])}><option value="low">Low · 1 Mbps</option><option value="medium">Medium · 2.5 Mbps</option><option value="high">High · 4.5 Mbps</option><option value="ultra">Ultra · 8 Mbps</option></select></label>
          </div>
          <div className="settings-checks"><label><input type="checkbox" checked={settings.overlayLyrics} onChange={(event) => update("overlayLyrics", event.target.checked)} /> Lyrics</label><label><input type="checkbox" checked={settings.overlayScripture} onChange={(event) => update("overlayScripture", event.target.checked)} /> Scripture</label><label><input type="checkbox" checked={settings.overlayVisuals} onChange={(event) => update("overlayVisuals", event.target.checked)} /> Visuals</label></div>
          <p className="settings-note">Run the OBS preview and 2–3 minute rehearsal from Control Center after saving.</p>
        </section>

        <section className="settings-section">
          <div className="settings-section-heading"><span className="settings-icon">CAM</span><div><h2>Camera &amp; connection preferences</h2><p>Set defaults before connecting mobile or network cameras.</p></div></div>
          <div className="settings-grid">
            <label>Default camera<select value={settings.defaultCamera} onChange={(event) => update("defaultCamera", event.target.value)}><option>Auto-select first online camera</option><option>Program camera</option><option>Preview camera</option></select></label>
            <label>Resolution<select value={settings.resolution} onChange={(event) => update("resolution", event.target.value as Settings["resolution"])}><option>720p</option><option>1080p</option></select></label>
            <label>Frame rate<select value={settings.frameRate} onChange={(event) => update("frameRate", event.target.value as Settings["frameRate"])}><option value="24">24 fps</option><option value="30">30 fps</option><option value="60">60 fps</option></select></label>
          </div>
          <div className="settings-link-row"><Link href="/control#cameras" className="button outline">Open camera detection</Link><Link href="/control#audio" className="button outline">Open audio monitor</Link></div>
        </section>

        <section className="settings-section">
          <div className="settings-section-heading"><span className="settings-icon">TXT</span><div><h2>Overlay styles</h2><p>Set a readable baseline for lyrics, scripture, and visuals.</p></div></div>
          <div className="settings-grid">
            <label>Overlay font<select value={settings.overlayFont} onChange={(event) => update("overlayFont", event.target.value)}><option>Inter</option><option>Merriweather</option><option>Montserrat</option><option>Oswald</option></select></label>
            <label>Overlay color<input type="color" value={settings.overlayColor} onChange={(event) => update("overlayColor", event.target.value)} /></label>
            <label>Transparency<input type="range" min={30} max={100} value={settings.overlayOpacity} onChange={(event) => update("overlayOpacity", Number(event.target.value))} /><span className="range-value">{settings.overlayOpacity}%</span></label>
          </div>
        </section>

        <section className="settings-section">
          <div className="settings-section-heading"><span className="settings-icon">GO</span><div><h2>Quick actions</h2><p>Choose which fallback actions appear in the live dock.</p></div></div>
          <div className="settings-checks quick-action-settings"><label><input type="checkbox" checked={settings.quickActions.includes("next")} onChange={() => toggleQuickAction("next")} /> Next Visual</label><label><input type="checkbox" checked={settings.quickActions.includes("title")} onChange={() => toggleQuickAction("title")} /> Return to Title</label><label><input type="checkbox" checked={settings.quickActions.includes("closing")} onChange={() => toggleQuickAction("closing")} /> Closing Slide</label></div>
        </section>
      </div>
    </main>
  );
}
