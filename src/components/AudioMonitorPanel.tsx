import type { AudioState } from "@/src/types/production";

const demoAudio: AudioState = {
  source: "USB Mixer 1",
  levelLeft: 0.63,
  levelRight: 0.55,
  peak: false,
  bpm: 92,
};

export function AudioMonitorPanel() {
  return (
    <section className="audio-panel">
      <div className="panel-header">
        <p>Audio Monitor</p>
      </div>
      <div className="audio-line">
        <span>Source</span>
        <strong>{demoAudio.source}</strong>
      </div>
      <div className="meter-group">
        <div>
          <label>Left</label>
          <div className="meter">
            <span className="meter-fill" style={{ width: `${demoAudio.levelLeft * 100}%` }} />
          </div>
        </div>
        <div>
          <label>Right</label>
          <div className="meter">
            <span className="meter-fill" style={{ width: `${demoAudio.levelRight * 100}%` }} />
          </div>
        </div>
      </div>
      <div className="audio-line">
        <span>Tempo</span>
        <strong>{demoAudio.bpm} BPM</strong>
      </div>
      <div className={demoAudio.peak ? "peak-indicator active" : "peak-indicator"}>Peak status active</div>
    </section>
  );
}
