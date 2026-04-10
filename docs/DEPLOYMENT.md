# ABCF Production Team Deployment Guide

## Requirements

- Node.js 20+ or compatible runtime
- npm 10+ / pnpm / yarn
- Local network access for WebRTC and mobile camera connections
- Optional: Linux desktop or laptop for PWA install

## Deployment Options

### Local Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the socket server:
   ```bash
   npm run dev:server
   ```
3. Start the Next.js app:
   ```bash
   npm run dev:web
   ```
4. Open the dashboard at `http://localhost:3000/control`

### Combined Development

Run both front-end and socket server together:
```bash
npm run dev
```

### Production Build

1. Build the Next.js app:
   ```bash
   npm run build
   ```
2. Start the production server:
   ```bash
   npm run start
   ```

### Recommended Architecture for Production

- Frontend served by a static-capable host or Node.js server
- Socket server deployed as a separate backend process with WebSocket access
- Use HTTPS for secure WebRTC and camera signaling
- Cache static assets at the edge for low latency

## PWA Installation

- Open the app in Chrome or Edge on laptop/tablet
- Choose `Install ABCF Production Team`
- The app will launch in standalone mode from the `control` route

## Mobile Camera Workflow

1. Open the public `mobile-camera` route on a phone browser
2. Activate the rear camera
3. Scan the QR code from the production dashboard
4. The phone appears in the camera roster as a WebRTC source

## Notes

- WebRTC signaling is proxied through Socket.io in this scaffold
- For production, lock down socket origins and use SSL certificates
- Add real RTMP encoder integration for Facebook Live in the `LivestreamStudioPanel` workflow
