/**
 * Global singleton store for camera MediaStreams.
 *
 * MediaStream objects are held outside of React component lifecycle so they
 * survive Next.js page navigations (component mount / unmount cycles).
 * Components subscribe to changes via a simple listener pattern.
 */

type Listener = () => void;

let localStreams: Record<string, MediaStream> = {};
let remoteStreams: Record<string, MediaStream> = {};
let snapshotFrames: Record<string, string> = {};
let peerConnections: Record<string, RTCPeerConnection> = {};
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((fn) => fn());
}

// ── subscriptions ──────────────────────────────────────────────────────

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// ── local streams (USB / webcam) ───────────────────────────────────────

export function getLocalStreams(): Record<string, MediaStream> {
  return localStreams;
}

export function setLocalStream(cameraId: string, stream: MediaStream) {
  localStreams = { ...localStreams, [cameraId]: stream };
  notify();
}

export function removeLocalStream(cameraId: string) {
  const stream = localStreams[cameraId];
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
  }
  const { [cameraId]: _, ...rest } = localStreams;
  localStreams = rest;
  notify();
}

// ── remote streams (mobile WebRTC) ─────────────────────────────────────

export function getRemoteStreams(): Record<string, MediaStream> {
  return remoteStreams;
}

export function setRemoteStream(cameraId: string, stream: MediaStream) {
  remoteStreams = { ...remoteStreams, [cameraId]: stream };
  notify();
}

export function removeRemoteStream(cameraId: string) {
  const { [cameraId]: _, ...rest } = remoteStreams;
  remoteStreams = rest;
  notify();
}

// ── snapshot frames (mobile fallback) ──────────────────────────────────

export function getSnapshotFrames(): Record<string, string> {
  return snapshotFrames;
}

export function setSnapshotFrame(cameraId: string, frame: string) {
  snapshotFrames = { ...snapshotFrames, [cameraId]: frame };
  notify();
}

export function removeSnapshotFrame(cameraId: string) {
  const { [cameraId]: _, ...rest } = snapshotFrames;
  snapshotFrames = rest;
  notify();
}

// ── peer connections ───────────────────────────────────────────────────

export function getPeerConnections(): Record<string, RTCPeerConnection> {
  return peerConnections;
}

export function setPeerConnection(cameraId: string, pc: RTCPeerConnection) {
  peerConnections = { ...peerConnections, [cameraId]: pc };
}

export function removePeerConnection(cameraId: string) {
  const pc = peerConnections[cameraId];
  if (pc) pc.close();
  const { [cameraId]: _, ...rest } = peerConnections;
  peerConnections = rest;
}

// ── combined view ──────────────────────────────────────────────────────

export function getAllStreams(): Record<string, MediaStream> {
  return { ...remoteStreams, ...localStreams };
}

// ── bulk cleanup (only call on explicit user action / logout) ──────────

export function destroyAll() {
  Object.values(localStreams).forEach((s) => s.getTracks().forEach((t) => t.stop()));
  Object.values(peerConnections).forEach((pc) => pc.close());
  localStreams = {};
  remoteStreams = {};
  snapshotFrames = {};
  peerConnections = {};
  notify();
}
