/**
 * Setlist store - tracks which songs are explicitly added to the setlist.
 * 
 * Rules:
 * - Only songs explicitly added should appear in the setlist
 * - Messages and Announcements never appear in setlist
 * - Setlist order is preserved separately from song order
 */

import type { SetlistItem } from "@/src/types/production";
import { sampleSongs } from "@/src/lib/fakeData";

const STORAGE_KEY = "abcfpt_setlist";

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((fn) => fn());
}

function readFromStorage(): SetlistItem[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as SetlistItem[];
    return null;
  } catch {
    return null;
  }
}

function writeToStorage(items: SetlistItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage full or unavailable — silently skip
  }
}

// ── state ──────────────────────────────────────────────────────────────

let setlist: SetlistItem[] = readFromStorage() ?? 
  sampleSongs
    .filter(s => (s.category ?? "song") === "song")
    .map((s, idx) => ({ 
      id: `setlist-${s.id}`, 
      songId: s.id, 
      position: idx 
    }));

// ── public API ─────────────────────────────────────────────────────────

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getSetlist(): SetlistItem[] {
  return setlist;
}

export function setSetlist(next: SetlistItem[]) {
  setlist = next;
  writeToStorage(setlist);
  notify();
}

/** Add a song to the end of the setlist */
export function addToSetlist(songId: string) {
  if (setlist.some((item) => item.songId === songId)) return;
  const newItem: SetlistItem = {
    id: `setlist-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    songId,
    position: setlist.length,
  };
  setlist = [...setlist, newItem];
  writeToStorage(setlist);
  notify();
}

/** Remove a song from the setlist */
export function removeFromSetlist(songId: string) {
  setlist = setlist
    .filter((item) => item.songId !== songId)
    .map((item, idx) => ({ ...item, position: idx }));
  writeToStorage(setlist);
  notify();
}

/** Remove all songs from the setlist */
export function clearSetlist() {
  setlist = [];
  writeToStorage(setlist);
  notify();
}

/** Reorder setlist items */
export function reorderSetlist(songIds: string[]) {
  const reordered: SetlistItem[] = [];
  for (let i = 0; i < songIds.length; i++) {
    const songId = songIds[i];
    const item = setlist.find((item) => item.songId === songId);
    if (item) {
      reordered.push({ ...item, position: i });
    }
  }
  setlist = reordered;
  writeToStorage(setlist);
  notify();
}

/** Check if a song is in the setlist */
export function isInSetlist(songId: string): boolean {
  return setlist.some((item) => item.songId === songId);
}

/** Get songs from server merge - only add if not already in setlist */
export function mergeFromServer(serverSetlist: SetlistItem[]) {
  if (!serverSetlist?.length) return;
  
  // Preserve local additions, but update server items
  const merged = [...setlist];
  for (const serverItem of serverSetlist) {
    const idx = merged.findIndex((item) => item.songId === serverItem.songId);
    if (idx >= 0) {
      merged[idx] = serverItem;
    } else {
      merged.push(serverItem);
    }
  }
  
  setlist = merged;
  writeToStorage(setlist);
  notify();
}
