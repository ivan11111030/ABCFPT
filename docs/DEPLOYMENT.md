# ABCF Production Team Deployment Guide

## Requirements

- Node.js 20+ or compatible runtime
- npm 10+ / pnpm / yarn
- **FFmpeg** (for RTMP/Facebook Live streaming)
- Local network access for WebRTC and mobile camera connections
- Optional: Linux desktop or laptop for PWA install

### Installing FFmpeg

**Ubuntu/Debian:**
```bash
sudo apt-get update && sudo apt-get install -y ffmpeg
```

**macOS:**
```bash
brew install ffmpeg
```

**Windows:**
Download from https://ffmpeg.org/download.html

## Deployment Options

### Local Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Make sure FFmpeg is installed and accessible
3. Start the socket server:
   ```bash
   npm run dev:server
   ```
4. Start the Next.js app (in another terminal):
   ```bash
   npm run dev:web
   ```
5. Open the dashboard at `http://localhost:3000/ABCFPT/control`

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

## Facebook Live / RTMP Streaming

The app now supports professional-grade streaming to Facebook Live and other RTMP endpoints.

**For detailed professional streaming setup, see [PROFESSIONAL_STREAMING.md](PROFESSIONAL_STREAMING.md)**

### Quick Start

1. **With OBS Studio (Recommended):**
   - Install OBS Studio
   - Enable WebSocket Server in OBS (Tools → WebSocket Server Settings)
   - Set environment variables: `OBS_HOST`, `OBS_PORT`, `OBS_PASSWORD`
   - Start server: `npm run dev:server`
   - OBS will auto-connect

2. **With Direct RTMP:**
   - Configure cameras in [server/camera-sources.ts](server/camera-sources.ts)
   - Get stream key from Facebook Live
   - In app dashboard: Select camera, enter RTMP URL & key, choose quality profile
   - Click **Start Stream**

### Key Features

- ✅ OBS Studio integration (multi-camera, transitions, effects)
- ✅ Direct RTMP encoding (standalone operation)
- ✅ Multiple encoding profiles (low/medium/high/ultra)
- ✅ Support for RTSP, NDI, HTTP camera sources
- ✅ Real-time stream statistics and monitoring
- ✅ Automatic fallback (OBS → native RTMP)

**Important Notes:**
- FFmpeg must be installed on the server (required for native encoding)
- Stream keys should never be exposed in client-side code
- Use 2-3x stream bitrate for network bandwidth to ensure stability
- OBS integration recommended for professional multi-camera productions

See [PROFESSIONAL_STREAMING.md](PROFESSIONAL_STREAMING.md) for complete setup and troubleshooting.

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
- RTMP streaming requires FFmpeg to be installed on the server
- Stream keys should never be exposed in client-side code or logs

