import { io as ioClient, Socket as ClientSocket } from "socket.io-client";

export interface OBSSceneItem {
  id: number;
  name: string;
  visible: boolean;
  locked: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OBSScene {
  name: string;
  items: OBSSceneItem[];
}

export interface StreamSettings {
  server: string;
  key: string;
  bitrate: number;
  fps: number;
}

/**
 * OBS WebSocket Controller for professional streaming
 * Communicates with OBS Studio running locally or remotely
 */
export class OBSController {
  private socket: ClientSocket | null = null;
  private host: string;
  private port: number;
  private password: string;
  private connected = false;

  constructor(host = "localhost", port = 4444, password = "") {
    this.host = host;
    this.port = port;
    this.password = password;
  }

  /**
   * Connect to OBS WebSocket server
   */
  async connect(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const url = `ws://${this.host}:${this.port}`;
        this.socket = ioClient(url, {
          transports: ["websocket"],
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: 5,
        });

        this.socket.on("connect", () => {
          console.log("[OBS] Connected to OBS WebSocket");
          this.connected = true;
          resolve(true);
        });

        this.socket.on("disconnect", () => {
          console.log("[OBS] Disconnected from OBS");
          this.connected = false;
        });

        this.socket.on("error", (error: Error) => {
          console.error("[OBS] Connection error:", error);
          this.connected = false;
          resolve(false);
        });
      } catch (error) {
        console.error("[OBS] Failed to connect:", error);
        resolve(false);
      }
    });
  }

  /**
   * Check if connected to OBS
   */
  isConnected(): boolean {
    return this.connected && this.socket?.connected === true;
  }

  /**
   * Get list of scenes
   */
  async getScenes(): Promise<OBSScene[]> {
    if (!this.isConnected() || !this.socket) return [];
    
    return new Promise((resolve) => {
      this.socket?.emit("GetSceneList", {}, (response: any) => {
        if (response?.scenes) {
          resolve(response.scenes);
        } else {
          resolve([]);
        }
      });
    });
  }

  /**
   * Switch to specific scene
   */
  async setScene(sceneName: string): Promise<boolean> {
    if (!this.isConnected() || !this.socket) return false;

    return new Promise((resolve) => {
      this.socket?.emit("SetCurrentScene", { sceneName }, (response: any) => {
        resolve(response?.status === "ok");
      });
    });
  }

  /**
   * Get current scene
   */
  async getCurrentScene(): Promise<string | null> {
    if (!this.isConnected() || !this.socket) return null;

    return new Promise((resolve) => {
      this.socket?.emit("GetCurrentScene", {}, (response: any) => {
        resolve(response?.name || null);
      });
    });
  }

  /**
   * Start streaming
   */
  async startStreaming(settings: StreamSettings): Promise<boolean> {
    if (!this.isConnected() || !this.socket) return false;

    return new Promise((resolve) => {
      this.socket?.emit(
        "StartStreaming",
        {
          streamSettings: {
            server: settings.server,
            key: settings.key,
          },
        },
        (response: any) => {
          resolve(response?.status === "ok");
        }
      );
    });
  }

  /**
   * Stop streaming
   */
  async stopStreaming(): Promise<boolean> {
    if (!this.isConnected() || !this.socket) return false;

    return new Promise((resolve) => {
      this.socket?.emit("StopStreaming", {}, (response: any) => {
        resolve(response?.status === "ok");
      });
    });
  }

  /**
   * Get streaming status
   */
  async getStreamingStatus(): Promise<{
    isStreaming: boolean;
    isRecording: boolean;
    isReplayBufferActive: boolean;
    totalStreamTime?: number;
    totalFrames?: number;
    droppedFrames?: number;
  } | null> {
    if (!this.isConnected() || !this.socket) return null;

    return new Promise((resolve) => {
      this.socket?.emit("GetStreamingStatus", {}, (response: any) => {
        if (response?.status === "ok") {
          resolve({
            isStreaming: response["streaming"],
            isRecording: response["recording"],
            isReplayBufferActive: response["replayBuffer"],
            totalStreamTime: response["totalStreamTime"],
            totalFrames: response["totalFrames"],
            droppedFrames: response["droppedFrames"],
          });
        } else {
          resolve(null);
        }
      });
    });
  }

  /**
   * Set scene item visibility
   */
  async setSourceVisibility(sceneName: string, sourceName: string, visible: boolean): Promise<boolean> {
    if (!this.isConnected() || !this.socket) return false;

    return new Promise((resolve) => {
      this.socket?.emit(
        "SetSourceRender",
        {
          scene: sceneName,
          source: sourceName,
          render: visible,
        },
        (response: any) => {
          resolve(response?.status === "ok");
        }
      );
    });
  }

  /**
   * Disconnect from OBS
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.connected = false;
    }
  }
}
