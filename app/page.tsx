import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero-card">
        <div>
          <p className="eyebrow">ABCF Production Team</p>
          <h1>Church live production, simplified.</h1>
          <p className="hero-copy">
            A unified platform for livestream studio control, congregation lyrics, and singer teleprompter synchronization.
          </p>
        </div>
        <div className="hero-actions">
          <Link href="/auth" className="button primary">
            Sign In / Register
          </Link>
          <Link href="/control" className="button secondary">
            Open Control Center
          </Link>
          <Link href="/songs" className="button subtle">
            Manage Songs
          </Link>
          <Link href="/mobile-camera" className="button subtle">
            Connect Mobile Camera
          </Link>
        </div>
      </section>

      <section className="feature-grid">
        <article>
          <h2>Livestream Studio</h2>
          <p>One-click Facebook Live RTMP control, scene switching, countdowns, lower thirds and stream overlays.</p>
        </article>
        <article>
          <h2>Song & Setlist Management</h2>
          <p>Upload songs, auto-create lyrics slides, reorder setlists and search for worship content in seconds.</p>
        </article>
        <article>
          <h2>Teleprompter Sync</h2>
          <p>Tablet-optimized auto-scrolling lyrics with real-time follow, dark mode, and next-line preview.</p>
        </article>
      </section>

      <section className="info-panel">
        <div>
          <h3>Designed for production teams</h3>
          <p>
            Keep every device synced with live WebSocket events, reduce volunteer complexity, and provide a consistent worship experience across projector,
            livestream, and performer displays.
          </p>
        </div>
      </section>
    </main>
  );
}
