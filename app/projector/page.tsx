import Link from "next/link";

export default function ProjectorPage() {
  return (
    <main className="projector-screen">
      <div className="projector-hero">
        <div>
          <p className="projector-title">Abide in the Light</p>
          <p className="projector-line">We lift our hearts and voices, singing praise to the Lord.</p>
          <p className="projector-caption">Verse 1 • Worship • Full Lyrics Screen</p>
        </div>
        <Link href="/control" className="button subtle">
          Return to Control
        </Link>
      </div>
    </main>
  );
}
