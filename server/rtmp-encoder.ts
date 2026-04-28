import ffmpeg from "fluent-ffmpeg";
import { ChildProcess } from "child_process";

export interface CameraSource {
  id: string;
  url: string;
  protocol: "RTSP" | "NDI" | "HTTP" | "FILE" | "TEST";
  username?: string;
  password?: string;
}

export interface EncodingProfile {
  name: "high" | "medium" | "low" | "ultra";
  bitrate: string;
  fps: number;
  width: number;
  height: number;
  preset: string; // ultrafast, superfast, veryfast, faster, fast, medium, slow, slower, veryslow
}

export const ENCODING_PROFILES: Record<string, EncodingProfile> = {
  high: {
    name: "high",
    bitrate: "8000k",
    fps: 60,
    width: 1920,
    height: 1080,
    preset: "veryfast",
  },
  medium: {
    name: "medium",
    bitrate: "5000k",
    fps: 30,
    width: 1920,
    height: 1080,
    preset: "fast",
  },
  low: {
    name: "low",
    bitrate: "2500k",
    fps: 30,
    width: 1280,
    height: 720,
    preset: "faster",
  },
  ultra: {
    name: "ultra",
    bitrate: "15000k",
    fps: 60,
    width: 3840,
    height: 2160,
    preset: "veryfast",
  },
};

interface StreamConfig {
  rtmpUrl: string;
  streamKey: string;
  cameraSource?: CameraSource;
  profile?: EncodingProfile;
}

type StreamProcess = ChildProcess | null;

const activeStreams = new Map<string, { process: StreamProcess; stats: StreamStats }>();

export interface StreamStats {
  startTime: number;
  frames: number;
  fps: number;
  bitrate: string;
  errors: number;
  lastError?: string;
}

/**
 * Build FFmpeg input options based on camera protocol
 */
const getInputOptions = (source: CameraSource): string[] => {
  const options: string[] = [];

  switch (source.protocol) {
    case "RTSP":
      options.push("-rtsp_transport", "tcp");
      if (source.username && source.password) {
        // Embed credentials in URL if provided
        const url = new URL(source.url);
        url.username = source.username;
        url.password = source.password;
      }
      break;

    case "HTTP":
      options.push("-reconnect", "1");
      options.push("-reconnect_streamed", "1");
      options.push("-reconnect_delay_max", "5");
      break;

    case "NDI":
      // NDI requires NDI runtime installed
      options.push("-i", `pipe:0`); // Will be handled separately
      break;

    case "FILE":
      options.push("-re"); // Read at native frame rate
      break;

    case "TEST":
      // Color bars test pattern
      break;
  }

  return options;
};

/**
 * Get input source string based on protocol
 */
const getInputSource = (source: CameraSource): string => {
  switch (source.protocol) {
    case "RTSP":
    case "HTTP":
    case "NDI":
    case "FILE":
      return source.url;
    case "TEST":
      return "color=c=blue:s=1920x1080:d=1";
    default:
      return source.url;
  }
};

/**
 * Start RTMP stream with professional encoding
 */
export const startRtmpStream = (streamId: string, config: StreamConfig, onStats?: (stats: StreamStats) => void): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      // Stop existing stream if any
      stopRtmpStream(streamId);

      const profile = config.profile || ENCODING_PROFILES.medium;
      const { rtmpUrl, streamKey, cameraSource } = config;
      const fullRtmpUrl = `${rtmpUrl}${streamKey}`;

      const source = cameraSource || { id: "test", url: "", protocol: "TEST" as const };
      const inputSource = getInputSource(source);
      const inputOptions = getInputOptions(source);

      const stats: StreamStats = {
        startTime: Date.now(),
        frames: 0,
        fps: 0,
        bitrate: profile.bitrate,
        errors: 0,
      };

      const command = ffmpeg(inputSource)
        .inputOptions(inputOptions)
        .outputOptions([
          // Video codec and quality
          `-c:v libx264`,
          `-preset ${profile.preset}`,
          `-b:v ${profile.bitrate}`,
          `-maxrate ${profile.bitrate}`,
          `-bufsize ${Math.floor(parseInt(profile.bitrate) * 2)}k`,
          `-r ${profile.fps}`,
          `-g ${profile.fps * 2}`, // Keyframe interval (GOP)
          `-pix_fmt yuv420p`,
          
          // Tune for streaming
          `-tune zerolatency`,
          
          // Audio codec
          `-c:a aac`,
          `-b:a 128k`,
          `-ar 48000`,
          
          // FLV format for RTMP
          `-f flv`,
          
          // Connection options
          `-flvflags no_duration_filesize`,
        ])
        .output(fullRtmpUrl)
        .on("start", (cmd) => {
          console.log(`[RTMP] Stream started: ${streamId}`);
          console.log(`[RTMP] Output: ${fullRtmpUrl}`);
          console.log(`[RTMP] Profile: ${profile.name} (${profile.width}x${profile.height} @ ${profile.fps}fps, ${profile.bitrate})`);
          resolve();
        })
        .on("progress", (progress) => {
          stats.frames = progress.frames || 0;
          stats.fps = progress.currentFps || 0;
          if (onStats) {
            onStats(stats);
          }
        })
        .on("error", (err: Error) => {
          stats.errors++;
          stats.lastError = err.message;
          console.error(`[RTMP] Stream error (${streamId}):`, err.message);
          activeStreams.delete(streamId);
          reject(err);
        })
        .on("end", () => {
          console.log(`[RTMP] Stream ended: ${streamId}`);
          const duration = (Date.now() - stats.startTime) / 1000;
          console.log(`[RTMP] Duration: ${duration.toFixed(2)}s, Frames: ${stats.frames}, FPS: ${stats.fps.toFixed(1)}`);
          activeStreams.delete(streamId);
        });

      const process = command.run();
      activeStreams.set(streamId, { process, stats });
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Stop RTMP stream
 */
export const stopRtmpStream = (streamId: string): void => {
  const stream = activeStreams.get(streamId);
  if (stream?.process) {
    stream.process.kill("SIGTERM");
    activeStreams.delete(streamId);
    console.log(`[RTMP] Stream stopped: ${streamId}`);
  }
};

/**
 * Get stream statistics
 */
export const getStreamStats = (streamId: string): StreamStats | null => {
  return activeStreams.get(streamId)?.stats || null;
};

/**
 * Get status of stream
 */
export const getStreamStatus = (streamId: string): "active" | "inactive" => {
  return activeStreams.has(streamId) ? "active" : "inactive";
};

/**
 * Get all active streams
 */
export const getActiveStreams = (): string[] => {
  return Array.from(activeStreams.keys());
};

/**
 * Get all active streams with stats
 */
export const getActiveStreamsWithStats = (): { id: string; stats: StreamStats }[] => {
  return Array.from(activeStreams.entries()).map(([id, { stats }]) => ({ id, stats }));
};

/**
 * Stop all streams
 */
export const stopAllStreams = (): void => {
  activeStreams.forEach((stream, streamId) => {
    if (stream.process) {
      stream.process.kill("SIGTERM");
    }
    console.log(`[RTMP] Stopped stream: ${streamId}`);
  });
  activeStreams.clear();
};
