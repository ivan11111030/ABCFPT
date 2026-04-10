import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="landing-page">
      {/* Hero Section */}
      <section className="landing-hero">
        <div className="hero-content">
          <div className="logo-row">
            <div className="logo-box">
              <Image src="/logo-left.svg" alt="ABCF logo left" width={120} height={120} />
            </div>
            <div className="logo-box">
              <Image src="/logo-right.svg" alt="ABCF logo right" width={120} height={120} />
            </div>
          </div>
          <p className="eyebrow">ABCF Production Team</p>
          <h1 className="hero-title">Church live production, simplified.</h1>
          <p className="hero-description">
            A unified platform for livestream studio control, congregation lyrics, and singer teleprompter synchronization.
          </p>
          <div className="hero-actions">
            <Link href="/auth" className="btn btn-primary">
              Sign In / Register
            </Link>
            <Link href="/control" className="btn btn-secondary">
              Open Control Center
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="landing-features">
        <h2 className="section-title">Core Features</h2>
        <div className="features-grid">
          {/* Livestream Studio */}
          <div className="feature-card">
            <div className="feature-icon livestream">📡</div>
            <h3>Livestream Studio</h3>
            <p>One-click Facebook Live RTMP control, scene switching, countdowns, lower thirds and stream overlays.</p>
            <Link href="/control" className="feature-link">
              Open Studio <span>→</span>
            </Link>
          </div>

          {/* Song Management */}
          <div className="feature-card">
            <div className="feature-icon songs">🎵</div>
            <h3>Song & Setlist Management</h3>
            <p>Upload songs, auto-create lyrics slides, reorder setlists and search for worship content in seconds.</p>
            <Link href="/songs" className="feature-link">
              Manage Songs <span>→</span>
            </Link>
          </div>

          {/* Teleprompter */}
          <div className="feature-card">
            <div className="feature-icon teleprompter">📱</div>
            <h3>Teleprompter Sync</h3>
            <p>Tablet-optimized auto-scrolling lyrics with real-time follow, dark mode, and next-line preview.</p>
            <Link href="/teleprompter" className="feature-link">
              Open Teleprompter <span>→</span>
            </Link>
          </div>

          {/* Camera Streaming */}
          <div className="feature-card">
            <div className="feature-icon camera">📹</div>
            <h3>Mobile Camera Streaming</h3>
            <p>Connect phones as wireless cameras with low-latency streaming and seamless integration into your production.</p>
            <Link href="/mobile-camera" className="feature-link">
              Connect Camera <span>→</span>
            </Link>
          </div>

          {/* Real-time Sync */}
          <div className="feature-card">
            <div className="feature-icon sync">⚡</div>
            <h3>Real-time Device Sync</h3>
            <p>Keep every device synced with live WebSocket events for a consistent worship experience across all displays.</p>
            <div className="feature-link">Status: Connected</div>
          </div>

          {/* Projector Display */}
          <div className="feature-card">
            <div className="feature-icon projector">🖥️</div>
            <h3>Projector Output</h3>
            <p>Beautiful full-screen lyrics display with smooth fade transitions and professional presentation controls.</p>
            <Link href="/projector" className="feature-link">
              View Projector <span>→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Info Section */}
      <section className="landing-info">
        <div className="info-content">
          <h2>Designed for Production Teams</h2>
          <p>
            Reduce volunteer complexity and provide a consistent worship experience across projector, livestream, and performer displays. 
            Built with real-time synchronization, intuitive controls, and broadcast-quality output.
          </p>
          <div className="info-highlights">
            <div className="highlight">
              <span className="highlight-number">4</span>
              <span className="highlight-label">Display Modes</span>
            </div>
            <div className="highlight">
              <span className="highlight-number">∞</span>
              <span className="highlight-label">Real-time Sync</span>
            </div>
            <div className="highlight">
              <span className="highlight-number">1-Click</span>
              <span className="highlight-label">Broadcasting</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="landing-cta">
        <h2>Ready to streamline your production?</h2>
        <p>Start managing your livestream, songs, and teleprompter all from one place.</p>
        <div className="cta-actions">
          <Link href="/auth" className="btn btn-primary">
            Get Started
          </Link>
          <Link href="/control" className="btn btn-outline">
            View Demo
          </Link>
        </div>
      </section>
    </main>
  );
}
