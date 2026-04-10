type TopBarProps = {
  title: string;
  badge: string;
};

export function TopBar({ title, badge }: TopBarProps) {
  return (
    <header className="topbar">
      <div>
        <p className="logo">ABCF Production Team</p>
        <h2>{title}</h2>
      </div>
      <div className="status-row">
        <span className="status-pill">Stream: Ready</span>
        <span className="status-pill active">{badge}</span>
      </div>
    </header>
  );
}
