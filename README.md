# ABCF Production Team

ABCF Production Team is a unified church production platform for livestream studio control, congregation lyrics presentation, and singer teleprompter synchronization.

## What this repo includes

- **Next.js frontend** with routes for `/control`, `/projector`, `/teleprompter`, `/mobile-camera`, and `/songs`
- **Realtime sync engine** using Socket.io and WebSockets
- **Mobile camera support** with WebRTC low-latency streaming
- **Network camera support** for RTSP, NDI, ONVIF, and WebRTC sources
- **Song management UI** for lyrics, setlists, and import workflows
- **Audio monitor panel** and livestream studio controls
- **Database schema** for songs, slides, setlists, users, cameras, and audio sources
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
- `db/schema.sql` — Database schema for the production platform
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

The current build is a polished functional scaffold and can be extended with:
- authentication and user roles
- persisted storage in Supabase/Firebase or a SQL database
- RTMP encoder integration for Facebook Live
- ONVIF discovery and NDI discovery backends
- advanced audio mixer integration via USB/ASIO/Dante
