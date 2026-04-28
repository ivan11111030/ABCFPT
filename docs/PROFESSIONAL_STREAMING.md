# Professional Streaming Setup Guide

## Overview

Your ABCFPT application now supports professional-grade livestreaming with two methods:

1. **OBS Studio Integration** (Recommended) - Use OBS for advanced mixing, multiple cameras, effects
2. **Direct RTMP Encoding** - Stream directly from the app with configurable profiles

## Requirements

### For OBS Integration
- **OBS Studio 28.0+** (Windows, macOS, or Linux)
- **WebSocket Server Plugin** (built-in on modern OBS versions)
- **Network connectivity** between server and OBS

### For Direct RTMP
- **FFmpeg** (must be installed on the server)
- **Camera sources** configured (RTSP, NDI, HTTP, or FILE)

---

## Installation

### 1. Install FFmpeg

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install -y ffmpeg
```

**macOS:**
```bash
brew install ffmpeg
```

**Windows:**
Download from https://ffmpeg.org/download.html

### 2. Install Dependencies

```bash
npm install
```

This includes `fluent-ffmpeg` and Socket.io client/server for streaming.

---

## Setup Methods

### Option A: Professional Setup with OBS Studio (Recommended)

#### Why Use OBS?
- ✅ Multi-camera switching in real-time
- ✅ Advanced transitions and effects
- ✅ Audio mixing and filtering
- ✅ Scene management
- ✅ Recording while streaming
- ✅ Professional-grade quality

#### Setup Steps:

1. **Install OBS Studio**: https://obsproject.com/download

2. **Enable WebSocket Server** in OBS:
   - Open OBS → Tools → WebSocket Server Settings
   - Enable checkbox
   - Port: `4444` (default, can customize)
   - Password: (optional, recommended for security)

3. **Configure App Environment Variables**:

Create `.env.local` in the project root:
```env
OBS_HOST=localhost
OBS_PORT=4444
OBS_PASSWORD=your_password_here
```

Or set environment variables on the server:
```bash
export OBS_HOST=localhost
export OBS_PORT=4444
export OBS_PASSWORD=secure_password
```

4. **Start the Server**:
```bash
npm run dev:server
```

You should see:
```
[Server] OBS Studio connected
```

5. **In the App Dashboard**:
   - Go to **Livestream Studio**
   - Enter Facebook RTMP URL and stream key
   - Check **Use OBS** (if available)
   - Click **Start Stream** → OBS will activate streaming

#### Creating OBS Scenes

Set up multiple scenes in OBS for different layouts:

```
Scenes:
├── Worship (Main band)
├── Testimony (Single camera)
├── Lyrics (Lyrics overlay)
├── Slides (Presentation)
└── Breakout (Small group)
```

The app can trigger scene changes via Socket signals for automatic switching.

---

### Option B: Direct RTMP Streaming (Native)

#### Best For:
- Simple single-camera setups
- When OBS isn't available
- Lightweight deployments
- Direct encoding without external software

#### Setup Steps:

1. **Configure Camera Sources**

Edit [server/camera-sources.ts](server/camera-sources.ts):

```typescript
export const CAMERA_SOURCES: CameraConfig[] = [
  {
    id: "camera-01",
    name: "Stage Camera",
    protocol: "RTSP",
    url: "rtsp://192.168.1.101/live",
    username: "admin",
    password: "password",
  },
  {
    id: "camera-02",
    name: "Close-up",
    protocol: "RTSP",
    url: "rtsp://192.168.1.102/stream",
  },
  // Add more cameras...
];
```

2. **Start Server**:
```bash
npm run dev:server
```

3. **In the App Dashboard**:
   - Select camera from **Camera Preview** panel
   - Enter RTMP details
   - Select quality profile (medium/high)
   - Click **Start Stream**

#### Encoding Profiles

Available quality presets:

| Profile | Resolution | Bitrate | FPS | Use Case |
|---------|-----------|---------|-----|----------|
| **low** | 1280×720 | 2500k | 30 | Mobile viewers, poor bandwidth |
| **medium** | 1920×1080 | 5000k | 30 | **Recommended** for most streams |
| **high** | 1920×1080 | 8000k | 60 | Best quality, high bandwidth |
| **ultra** | 3840×2160 | 15000k | 60 | 4K streams (requires high bandwidth) |

---

## Camera Source Types

### RTSP (Most Common)
```typescript
{
  protocol: "RTSP",
  url: "rtsp://192.168.1.101/live",
  username: "admin",
  password: "password123",
}
```

Supported by most:
- IP cameras
- Encoders
- NDI devices with RTSP output

### NDI (Network Device Interface)
```typescript
{
  protocol: "NDI",
  url: "ndi://camera-name",
}
```

Requires: NDI runtime installed on server

### HTTP/MJPEG
```typescript
{
  protocol: "HTTP",
  url: "http://192.168.1.101:8080/stream.mjpg",
}
```

### File/VOD
```typescript
{
  protocol: "FILE",
  url: "/path/to/video.mp4",
}
```

### Test Pattern
```typescript
{
  protocol: "TEST",
  url: "color=c=blue:s=1920x1080",
}
```

---

## Facebook Live Integration

### Get Your Stream Key

1. Go to https://www.facebook.com/live/create
2. Choose "Go Live from Encoder"
3. Copy the **Server URL**: `rtmp://live-api.facebook.com:80/rtmp/`
4. Copy the **Stream Key**: (keep secret!)

### Configure in App

**Livestream Studio Panel:**
```
RTMP URL: rtmp://live-api.facebook.com:80/rtmp/
Stream Key: your_stream_key_here
Quality: Medium (5000k)
Camera: Select your main camera
Start Stream!
```

### Security Best Practices

⚠️ **Never commit stream keys to Git:**
```bash
# Use environment variables instead
export STREAM_KEY=your_secret_key
```

- Rotate keys regularly
- Use application-specific keys if available
- Monitor active streams from Facebook Creator Studio

---

## Performance Optimization

### Bandwidth Calculation

Expected upstream bandwidth needed:

| Profile | Bitrate | Min Bandwidth |
|---------|---------|---------------|
| Low | 2.5 Mbps | 5 Mbps |
| Medium | 5 Mbps | 10 Mbps |
| High | 8 Mbps | 15 Mbps |
| Ultra | 15 Mbps | 30 Mbps |

**Recommendation**: Use 2-3x higher than stream bitrate

### Network Testing

Test your connection:
```bash
# Check upload speed
speedtest-cli --simple

# Or visit: https://speedtest.net
```

### CPU Optimization

Encoding presets affect CPU usage:

| Preset | CPU Load | Quality | Recommended For |
|--------|----------|---------|-----------------|
| ultrafast | Low | Lower | Weak CPUs |
| veryfast | Medium | Good | **Most servers** |
| fast | Higher | Better | High-end servers |
| medium+ | Very High | Best | Dedicated encoding |

---

## Deployment to Render

### Updated Render Configuration

Your `render.yaml` already supports streaming:

```yaml
services:
  - type: web
    name: abcfpt-socket
    runtime: node
    buildCommand: npm install && apt-get update && apt-get install -y ffmpeg
    startCommand: npm run dev:server
    envVars:
      - key: OBS_HOST
        value: your_obs_machine_ip
      - key: OBS_PORT
        value: 4444
```

### Considerations for Cloud Deployment

1. **FFmpeg Installation**: Render needs FFmpeg (`apt-get install ffmpeg`)
2. **OBS Remote**: Point to OBS running locally or on your network
3. **Bandwidth Limits**: Render free tier has limited outbound bandwidth
4. **Recommended**: Use OBS locally, not on Render

---

## Troubleshooting

### Connection Issues

**OBS not connecting:**
```bash
# Check if OBS WebSocket is enabled
# Tools → WebSocket Server Settings
# Port should match OBS_PORT environment variable
```

**RTMP stream fails:**
```bash
# Check FFmpeg installed
ffmpeg -version

# Test camera connection
ffmpeg -i rtsp://192.168.1.101/live -t 5 -f null -
```

### Stream Quality Issues

**Choppy/dropped frames:**
- Lower encoding profile (high → medium)
- Check network bandwidth availability
- Reduce camera resolution/FPS

**Audio missing:**
- Ensure camera has audio output
- Check FFmpeg audio codec support

### Performance

**High CPU usage:**
- Use veryfast preset instead of fast
- Lower encoding bitrate
- Reduce FPS (60 → 30)

---

## Monitoring & Statistics

### Stream Health Dashboard

Check stream stats via the status endpoint:

```bash
curl http://localhost:4000/status
```

Response includes:
```json
{
  "streams": [
    {
      "id": "stream-xyz",
      "stats": {
        "frames": 1200,
        "fps": 29.8,
        "bitrate": "5000k",
        "errors": 0
      }
    }
  ],
  "obs": { "connected": true }
}
```

### Monitoring Commands

```bash
# List active streams
curl http://localhost:4000/streams

# List available cameras
curl http://localhost:4000/cameras

# Check server health
curl http://localhost:4000/status
```

---

## Advanced: Custom Camera Integration

### Adding a New Camera Protocol

1. Update [server/camera-sources.ts](server/camera-sources.ts)
2. Add protocol case in `getInputOptions()` in [server/rtmp-encoder.ts](server/rtmp-encoder.ts)
3. Test with FFmpeg manually first

### Example: Adding SRT Protocol

```typescript
// camera-sources.ts
{
  id: "srt-camera",
  protocol: "SRT",
  url: "srt://192.168.1.101:1234?mode=listener",
}

// rtmp-encoder.ts
case "SRT":
  options.push("-i", source.url);
  break;
```

---

## Support & Resources

- **OBS Documentation**: https://obsproject.com/wiki/
- **FFmpeg Documentation**: https://ffmpeg.org/documentation.html
- **Facebook Live Streaming**: https://www.facebook.com/help/
- **Socket.io**: https://socket.io/docs/

---

**Ready to stream professionally! Start with OBS integration for best results.**
