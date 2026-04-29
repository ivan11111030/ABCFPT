/**
 * Persistent song store backed by localStorage.
 *
 * Songs survive page refreshes and navigations. The store is the single
 * source of truth; React components subscribe for re-renders.
 *
 * Cloud sync: upload pushes the full setlist with timestamps to the server.
 * Download fetches only songs newer than the last sync timestamp.
 */

import type { Song } from "@/src/types/production";
import { sampleSongs } from "@/src/lib/fakeData";
import { getSocketServerUrl } from "@/src/lib/realtimeConfig";

const STORAGE_KEY = "abcfpt_songs";
const SYNC_TS_KEY = "abcfpt_last_cloud_sync";

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((fn) => fn());
}

// ── helpers ────────────────────────────────────────────────────────────

function now(): number {
  return Date.now();
}

function stamp(song: Song): Song {
  return { ...song, updatedAt: now() };
}

function readFromStorage(): Song[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as Song[];
    return null;
  } catch {
    return null;
  }
}

function writeToStorage(songs: Song[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
  } catch {
    // Storage full or unavailable — silently skip
  }
}

function getLastSyncTs(): number {
  if (typeof window === "undefined") return 0;
  try {
    return Number(localStorage.getItem(SYNC_TS_KEY)) || 0;
  } catch {
    return 0;
  }
}

function setLastSyncTs(ts: number) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SYNC_TS_KEY, String(ts));
  } catch { /* skip */ }
}

// ── state ──────────────────────────────────────────────────────────────

let songs: Song[] = readFromStorage() ?? [...sampleSongs];

// ── public API ─────────────────────────────────────────────────────────

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getSongs(): Song[] {
  return songs;
}

export function setSongs(next: Song[]) {
  songs = next;
  writeToStorage(songs);
  notify();
}

export function addSong(song: Song) {
  if (songs.some((s) => s.id === song.id)) return;
  songs = [...songs, stamp(song)];
  writeToStorage(songs);
  notify();
}

export function updateSong(song: Song) {
  const idx = songs.findIndex((s) => s.id === song.id);
  if (idx < 0) return;
  songs = songs.map((s) => (s.id === song.id ? stamp(song) : s));
  writeToStorage(songs);
  notify();
}

export function deleteSong(songId: string) {
  songs = songs.filter((s) => s.id !== songId);
  writeToStorage(songs);
  notify();
}

export function reorderSongs(songIds: string[]) {
  const ordered: Song[] = [];
  for (const id of songIds) {
    const song = songs.find((s) => s.id === id);
    if (song) ordered.push(song);
  }
  for (const song of songs) {
    if (!ordered.some((s) => s.id === song.id)) ordered.push(song);
  }
  songs = ordered;
  writeToStorage(songs);
  notify();
}

/**
 * Merge songs from server state:sync without overwriting local additions.
 */
export function mergeFromServer(serverSongs: Song[]) {
  if (!serverSongs?.length) return;
  const merged = [...songs];
  for (const serverSong of serverSongs) {
    const idx = merged.findIndex((s) => s.id === serverSong.id);
    if (idx >= 0) {
      merged[idx] = serverSong;
    } else {
      merged.push(serverSong);
    }
  }
  songs = merged;
  writeToStorage(songs);
  notify();
}

// ── cloud sync ─────────────────────────────────────────────────────────

function apiBase(): string {
  return getSocketServerUrl();
}

/**
 * Upload the full current setlist to the cloud server.
 * The server replaces its stored setlist with the uploaded version.
 */
export async function uploadToCloud(): Promise<{ ok: boolean; message: string }> {
  try {
    const uploadTs = now();
    // Stamp any songs that don't yet have an updatedAt
    const payload = songs.map((s) => ({ ...s, updatedAt: s.updatedAt ?? uploadTs }));

    const res = await fetch(`${apiBase()}/api/songs/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ songs: payload, uploadedAt: uploadTs }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { ok: false, message: err || `Server error ${res.status}` };
    }

    // Update local songs with the timestamps we sent
    songs = payload;
    writeToStorage(songs);
    setLastSyncTs(uploadTs);
    notify();

    return { ok: true, message: `Uploaded ${songs.length} song(s) to cloud.` };
  } catch (err: any) {
    return { ok: false, message: err?.message || "Network error" };
  }
}

/**
 * Download songs from the cloud server.
 * If `sinceLastSync` is true, only fetches songs modified after the last sync.
 * Merges server songs into local: server version wins if it's newer.
 */
export async function downloadFromCloud(sinceLastSync = true): Promise<{ ok: boolean; message: string; count: number }> {
  try {
    const since = sinceLastSync ? getLastSyncTs() : 0;
    const res = await fetch(`${apiBase()}/api/songs/download?since=${since}`);

    if (!res.ok) {
      const err = await res.text();
      return { ok: false, message: err || `Server error ${res.status}`, count: 0 };
    }

    const data = await res.json() as { songs: Song[]; serverTimestamp: number };
    const serverSongs: Song[] = data.songs ?? [];

    if (serverSongs.length === 0) {
      return { ok: true, message: "Already up to date — no new songs on server.", count: 0 };
    }

    // Merge: for each server song, keep the newer version
    const merged = [...songs];
    let added = 0;
    let updated = 0;

    for (const serverSong of serverSongs) {
      const idx = merged.findIndex((s) => s.id === serverSong.id);
      if (idx >= 0) {
        const localTs = merged[idx].updatedAt ?? 0;
        const remoteTs = serverSong.updatedAt ?? 0;
        if (remoteTs >= localTs) {
          merged[idx] = serverSong;
          updated++;
        }
      } else {
        merged.push(serverSong);
        added++;
      }
    }

    songs = merged;
    writeToStorage(songs);
    setLastSyncTs(data.serverTimestamp ?? now());
    notify();

    const parts: string[] = [];
    if (added > 0) parts.push(`${added} new`);
    if (updated > 0) parts.push(`${updated} updated`);
    return { ok: true, message: `Downloaded ${parts.join(", ")} song(s) from cloud.`, count: added + updated };
  } catch (err: any) {
    return { ok: false, message: err?.message || "Network error", count: 0 };
  }
}
