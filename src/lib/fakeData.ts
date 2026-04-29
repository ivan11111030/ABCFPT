import type { Camera, Song } from "@/src/types/production";

export const sampleSongs: Song[] = [
  {
    id: "song-001",
    title: "Abide in the Light",
    artist: "ABCF Worship",
    key: "C",
    tempo: 78,
    currentSection: "Verse 1",
    favorite: true,
    slides: [
      { id: "slide-001", section: "Verse 1", text: "Abide in the light, we will sing tonight." },
      { id: "slide-002", section: "Chorus", text: "Let every heart proclaim Your name." },
      { id: "slide-003", section: "Bridge", text: "Spirit move and stir our praise." },
    ],
  },
  {
    id: "song-002",
    title: "Grace Like Rain",
    artist: "ABCF Worship",
    key: "G",
    tempo: 92,
    currentSection: "Chorus",
    favorite: false,
    slides: [
      { id: "slide-004", section: "Verse 1", text: "Falling like rain, Your love comes down." },
      { id: "slide-005", section: "Chorus", text: "Grace like rain, Holy Fire." },
      { id: "slide-006", section: "Tag", text: "We stand in awe of who You are." },
    ],
  },
];

export const sampleCameras: Camera[] = [
  {
    id: "camera-01",
    name: "Stage Wide Camera",
    protocol: "RTSP",
    ipAddress: "192.168.1.101",
    streamUrl: "rtsp://192.168.1.101/live",
    status: "offline",
    supportsPTZ: false,
    presetList: ["Wide Worship", "Full Stage"],
  },
  {
    id: "camera-02",
    name: "Lead Singer Close",
    protocol: "NDI",
    ipAddress: "192.168.1.102",
    streamUrl: "ndi://lead-singer",
    status: "offline",
    supportsPTZ: true,
    presetList: ["Singer Tight", "Face Close"],
  },
  {
    id: "camera-03",
    name: "Pulpit Camera",
    protocol: "ONVIF",
    ipAddress: "192.168.1.103",
    streamUrl: "rtsp://192.168.1.103/stream1",
    status: "offline",
    supportsPTZ: true,
    presetList: ["Speaker Focus", "Audience View"],
  },
  {
    id: "camera-04",
    name: "Audience WebRTC",
    protocol: "WebRTC",
    ipAddress: "192.168.1.104",
    streamUrl: "webrtc://192.168.1.104/offer",
    status: "offline",
    supportsPTZ: false,
  },
];
