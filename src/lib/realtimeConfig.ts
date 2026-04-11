const DEFAULT_SOCKET_SERVER_URL = "http://localhost:4000";

function parseIceServersFromJson(value: string | undefined): RTCIceServer[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as RTCIceServer[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getSocketServerUrl(): string {
  return process.env.NEXT_PUBLIC_SOCKET_SERVER_URL?.trim() || DEFAULT_SOCKET_SERVER_URL;
}

export function getIceServers(): RTCIceServer[] {
  const configured = parseIceServersFromJson(process.env.NEXT_PUBLIC_WEBRTC_ICE_SERVERS);

  if (configured.length > 0) {
    return configured;
  }

  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL?.trim();
  const turnUsername = process.env.NEXT_PUBLIC_TURN_USERNAME?.trim();
  const turnCredential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL?.trim();

  const fallbackServers: RTCIceServer[] = [
    {
      urls: [
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302",
        "stun:stun2.l.google.com:19302",
        "stun:stun3.l.google.com:19302",
        "stun:stun4.l.google.com:19302",
      ],
    },
  ];

  if (turnUrl && turnUsername && turnCredential) {
    fallbackServers.push({
      urls: [turnUrl],
      username: turnUsername,
      credential: turnCredential,
    });
  }

  return fallbackServers;
}