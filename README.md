# ABCF Production Team

ABCF Production Team is a unified church production platform for livestream studio control, congregation lyrics presentation, and singer teleprompter synchronization.

## What this repo includes

- **Next.js frontend** with routes for `/control`, `/projector`, `/teleprompter`, `/mobile-camera`, and `/songs`
- **Realtime sync engine** using Socket.io and WebSockets, with optional Firebase-ID-token auth on operator commands (see docs/DEPLOYMENT.md)
- **Mobile/browser camera support** with WebRTC, actually working end-to-end (capture → preview → RTMP)
- **RTSP/NDI/ONVIF camera entries** as manually-entered metadata (name/URL/protocol) — there's no automatic discovery or capture backend for these yet, only WebRTC sources actually stream
- **Direct RTMP encoding** to Facebook Live (or any RTMP endpoint) via a bundled FFmpeg binary, with selectable quality profiles
- **Song management UI** for lyrics, setlists, and import workflows
- **Audio monitor panel** and livestream studio controls
- **Server state persistence** to local JSON files (survives restarts/crashes; see caveat about hosts without persistent disk in docs/DEPLOYMENT.md) — a SQL schema also exists in `db/schema.sql` for a future real-database migration, not yet connected
- **PWA manifest** for desktop and tablet install experience

## Routes

- `/control` — Production control center
- `/projector` — Congregation lyrics projector output
- `/teleprompter` — Singer teleprompter display
- `/mobile-camera` — Connect a phone/tablet camera to the system
- `/songs` — Song management and import workflow

## Key architecture

- `app/` — Next.js App Router pages and shell
- `src/components/` — Reusable UI modules
- `src/lib/` — Socket client and helper utilities
- `src/types/` — Domain models for production data
- `server/` — Socket.io backend and real-time event distribution
- `db/schema.sql` — Database schema for a future real-database migration (not yet connected — see Development notes)
- `public/manifest.json` — PWA metadata
- `docs/` — Architecture and deployment guides

## Getting started

```bash
npm install
npm run dev
```

Open the control panel at `http://localhost:3000/control` and start the socket server on `http://localhost:4000`.

## Deployment

See `docs/DEPLOYMENT.md` for production deployment and PWA instructions.

## Development notes

The current build is a functional production tool with some real gaps still worth closing:
- **User roles/permissions**: operator sign-in is enforced at the socket level (optional, see docs/DEPLOYMENT.md), but there's no distinction between roles yet — anyone with an account has full control. `db/schema.sql`'s `users.role` column is a starting point for this.
- **Full database persistence**: state currently persists to local JSON files on the socket server (see `server/state_snapshot.json`, `server/cloud_songs.json`), not a real database — `db/schema.sql` is prepared for that migration but not connected yet.
- **ONVIF/NDI discovery**: camera entries for these protocols are manually typed in today; there's no real network discovery or capture backend for them (only WebRTC cameras actually stream).
- **Advanced audio mixer integration** via USB/ASIO/Dante is not implemented.
- **OBS Studio integration** is not implemented (direct RTMP encoding is the working streaming path — see docs/PROFESSIONAL_STREAMING.md).
