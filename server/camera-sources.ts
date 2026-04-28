/**
 * Camera source configurations for professional streaming
 * Define your local RTSP/NDI cameras here
 */

export interface CameraConfig {
  id: string;
  name: string;
  protocol: "RTSP" | "NDI" | "HTTP" | "FILE" | "TEST";
  url: string;
  username?: string;
  password?: string;
  description?: string;
}

/**
 * Default camera sources
 * Update these with your actual camera URLs
 */
export const CAMERA_SOURCES: CameraConfig[] = [
  {
    id: "camera-01",
    name: "Stage Wide Camera",
    protocol: "RTSP",
    url: "rtsp://192.168.1.101/live",
    description: "Wide shot of entire stage",
  },
  {
    id: "camera-02",
    name: "Lead Singer Close",
    protocol: "RTSP",
    url: "rtsp://192.168.1.102/stream",
    description: "Close-up of lead singer",
  },
  {
    id: "camera-03",
    name: "Band Overview",
    protocol: "RTSP",
    url: "rtsp://192.168.1.103/live",
    description: "Overview of full band",
  },
  {
    id: "phone-camera",
    name: "Mobile Camera",
    protocol: "RTSP",
    url: "rtsp://192.168.1.201/stream",
    description: "Mobile device camera feed",
  },
  {
    id: "test-pattern",
    name: "Test Pattern",
    protocol: "TEST",
    url: "color=c=blue:s=1920x1080",
    description: "Blue color bars for testing",
  },
];

/**
 * Find camera by ID
 */
export const getCameraById = (id: string): CameraConfig | undefined => {
  return CAMERA_SOURCES.find((cam) => cam.id === id);
};

/**
 * Get all available cameras
 */
export const getAllCameras = (): CameraConfig[] => {
  return CAMERA_SOURCES;
};

/**
 * Get cameras by protocol
 */
export const getCamerasByProtocol = (protocol: string): CameraConfig[] => {
  return CAMERA_SOURCES.filter((cam) => cam.protocol === protocol);
};
