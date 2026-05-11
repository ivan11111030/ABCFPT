/**
 * Setlist membership store - tracks which items are explicitly added to setlists.
 *
 * Maintains membership relationships separately from item storage.
 * Items can exist as Songs/Messages/Announcements without being in any setlist.
 * Setlist only shows items with explicit membership.
 */

import type { SetlistMembership, ItemCategory } from "@/src/types/production";

const STORAGE_KEY = "abcfpt_setlist_memberships";
const DEFAULT_SETLIST_ID = "default-setlist";

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((fn) => fn());
}

// ── helpers ────────────────────────────────────────────────────────────

function now(): number {
  return Date.now();
}

function readFromStorage(): SetlistMembership[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as SetlistMembership[];
    return null;
  } catch {
    return null;
  }
}

function writeToStorage(memberships: SetlistMembership[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memberships));
  } catch {
    // Storage full or unavailable
  }
}

// ── state ──────────────────────────────────────────────────────────────

let memberships: SetlistMembership[] = readFromStorage() ?? [];

// ── public API ─────────────────────────────────────────────────────────

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Get all items in a specific setlist, ordered by position */
export function getSetlistItems(setlistId: string = DEFAULT_SETLIST_ID): SetlistMembership[] {
  return memberships
    .filter((m) => m.setlistId === setlistId)
    .sort((a, b) => a.position - b.position);
}

/** Check if an item is in a setlist */
export function isItemInSetlist(
  itemId: string,
  itemCategory: ItemCategory,
  setlistId: string = DEFAULT_SETLIST_ID
): boolean {
  return memberships.some(
    (m) =>
      m.setlistId === setlistId &&
      m.itemId === itemId &&
      m.itemCategory === itemCategory
  );
}

/** Add an item to a setlist at a specific position */
export function addItemToSetlist(
  itemId: string,
  itemCategory: ItemCategory,
  setlistId: string = DEFAULT_SETLIST_ID,
  position?: number
): SetlistMembership {
  // Check if already exists
  if (isItemInSetlist(itemId, itemCategory, setlistId)) {
    throw new Error(`Item ${itemId} already in setlist ${setlistId}`);
  }

  // Determine position (end of list by default)
  const currentItems = getSetlistItems(setlistId);
  const finalPosition = position ?? currentItems.length;

  // If inserting in middle, shift other items down
  if (finalPosition < currentItems.length) {
    memberships = memberships.map((m) =>
      m.setlistId === setlistId && m.position >= finalPosition
        ? { ...m, position: m.position + 1 }
        : m
    );
  }

  const membership: SetlistMembership = {
    id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    setlistId,
    itemId,
    itemCategory,
    position: finalPosition,
    addedAt: now(),
  };

  memberships.push(membership);
  writeToStorage(memberships);
  notify();

  return membership;
}

/** Remove an item from a setlist */
export function removeItemFromSetlist(
  itemId: string,
  itemCategory: ItemCategory,
  setlistId: string = DEFAULT_SETLIST_ID
): boolean {
  const index = memberships.findIndex(
    (m) =>
      m.setlistId === setlistId &&
      m.itemId === itemId &&
      m.itemCategory === itemCategory
  );

  if (index === -1) return false;

  const removedPosition = memberships[index].position;
  memberships.splice(index, 1);

  // Shift remaining items up
  memberships = memberships.map((m) =>
    m.setlistId === setlistId && m.position > removedPosition
      ? { ...m, position: m.position - 1 }
      : m
  );

  writeToStorage(memberships);
  notify();

  return true;
}

/** Reorder items in a setlist */
export function reorderItems(
  sourceItemId: string,
  sourceItemCategory: ItemCategory,
  targetPosition: number,
  setlistId: string = DEFAULT_SETLIST_ID
): boolean {
  const sourceMem = memberships.find(
    (m) =>
      m.setlistId === setlistId &&
      m.itemId === sourceItemId &&
      m.itemCategory === sourceItemCategory
  );

  if (!sourceMem) return false;

  const currentPosition = sourceMem.position;
  if (currentPosition === targetPosition) return false;

  // Shift items between old and new position
  if (currentPosition < targetPosition) {
    // Moving down
    memberships = memberships.map((m) =>
      m.setlistId === setlistId &&
      m.position > currentPosition &&
      m.position <= targetPosition
        ? { ...m, position: m.position - 1 }
        : m
    );
  } else {
    // Moving up
    memberships = memberships.map((m) =>
      m.setlistId === setlistId &&
      m.position >= targetPosition &&
      m.position < currentPosition
        ? { ...m, position: m.position + 1 }
        : m
    );
  }

  // Update source position
  sourceMem.position = targetPosition;

  writeToStorage(memberships);
  notify();

  return true;
}

/** Clear all items from a setlist */
export function clearSetlist(setlistId: string = DEFAULT_SETLIST_ID): number {
  const countBefore = memberships.length;
  memberships = memberships.filter((m) => m.setlistId !== setlistId);
  const removed = countBefore - memberships.length;

  if (removed > 0) {
    writeToStorage(memberships);
    notify();
  }

  return removed;
}

/** Add multiple items to setlist (for bulk operations) */
export function addItemsToSetlist(
  items: Array<{ itemId: string; itemCategory: ItemCategory }>,
  setlistId: string = DEFAULT_SETLIST_ID
): SetlistMembership[] {
  const added: SetlistMembership[] = [];
  let position = getSetlistItems(setlistId).length;

  for (const item of items) {
    if (!isItemInSetlist(item.itemId, item.itemCategory, setlistId)) {
      const membership: SetlistMembership = {
        id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        setlistId,
        itemId: item.itemId,
        itemCategory: item.itemCategory,
        position,
        addedAt: now(),
      };
      memberships.push(membership);
      added.push(membership);
      position++;
    }
  }

  if (added.length > 0) {
    writeToStorage(memberships);
    notify();
  }

  return added;
}

/** Get all memberships (for debugging or export) */
export function getAllMemberships(): SetlistMembership[] {
  return JSON.parse(JSON.stringify(memberships));
}
