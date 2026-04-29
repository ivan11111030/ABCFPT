/**
 * Persistent scene template store backed by localStorage.
 *
 * Scenes survive page refreshes. The store provides CRUD + versioning.
 */

import type { SceneTemplate, SceneType, SceneConfig } from "@/src/types/scene";
import { createSceneTemplate, DEFAULT_SCENE_CONFIGS } from "@/src/types/scene";

const STORAGE_KEY = "abcfpt_scenes";

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((fn) => fn());
}

function readFromStorage(): SceneTemplate[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as SceneTemplate[];
    return null;
  } catch {
    return null;
  }
}

function writeToStorage(scenes: SceneTemplate[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scenes));
  } catch { /* skip */ }
}

// ── Default scenes ─────────────────────────────────────────────────────

const defaultScenes: SceneTemplate[] = [
  createSceneTemplate("Default Standby", "standby"),
  createSceneTemplate("Default Worship", "worship"),
  createSceneTemplate("Default Speaker", "speaker"),
  createSceneTemplate("Default Announcement", "announcement"),
];

// ── state ──────────────────────────────────────────────────────────────

let scenes: SceneTemplate[] = readFromStorage() ?? [...defaultScenes];

// ── public API ─────────────────────────────────────────────────────────

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getScenes(): SceneTemplate[] {
  return scenes;
}

export function getScenesByType(type: SceneType): SceneTemplate[] {
  return scenes.filter((s) => s.type === type);
}

export function getScene(id: string): SceneTemplate | undefined {
  return scenes.find((s) => s.id === id);
}

export function setScenes(next: SceneTemplate[]) {
  scenes = next;
  writeToStorage(scenes);
  notify();
}

export function addScene(scene: SceneTemplate) {
  if (scenes.some((s) => s.id === scene.id)) return;
  scenes = [...scenes, scene];
  writeToStorage(scenes);
  notify();
}

export function updateScene(scene: SceneTemplate) {
  scenes = scenes.map((s) => (s.id === scene.id ? { ...scene, updatedAt: Date.now() } : s));
  writeToStorage(scenes);
  notify();
}

export function deleteScene(sceneId: string) {
  scenes = scenes.filter((s) => s.id !== sceneId);
  writeToStorage(scenes);
  notify();
}

/** Duplicate a scene with a new name */
export function duplicateScene(sceneId: string, newName: string): SceneTemplate | null {
  const source = scenes.find((s) => s.id === sceneId);
  if (!source) return null;

  const now = Date.now();
  const dup: SceneTemplate = {
    ...structuredClone(source),
    id: `scene-${now}-${Math.random().toString(36).slice(2, 7)}`,
    name: newName,
    versions: [
      {
        id: `ver-${now}`,
        label: "v1 (duplicated)",
        createdAt: now,
        config: structuredClone(source.config),
      },
    ],
    createdAt: now,
    updatedAt: now,
  };

  scenes = [...scenes, dup];
  writeToStorage(scenes);
  notify();
  return dup;
}

/** Save a new version snapshot for a scene */
export function saveSceneVersion(sceneId: string, label?: string): SceneTemplate | null {
  const scene = scenes.find((s) => s.id === sceneId);
  if (!scene) return null;

  const now = Date.now();
  const versionNum = scene.versions.length + 1;
  const newVersion = {
    id: `ver-${now}`,
    label: label || `v${versionNum}`,
    createdAt: now,
    config: structuredClone(scene.config),
  };

  const updated: SceneTemplate = {
    ...scene,
    versions: [...scene.versions, newVersion],
    updatedAt: now,
  };

  scenes = scenes.map((s) => (s.id === sceneId ? updated : s));
  writeToStorage(scenes);
  notify();
  return updated;
}

/** Restore a previous version */
export function restoreSceneVersion(sceneId: string, versionId: string): SceneTemplate | null {
  const scene = scenes.find((s) => s.id === sceneId);
  if (!scene) return null;

  const version = scene.versions.find((v) => v.id === versionId);
  if (!version) return null;

  const now = Date.now();
  const updated: SceneTemplate = {
    ...scene,
    config: structuredClone(version.config),
    updatedAt: now,
  };

  scenes = scenes.map((s) => (s.id === sceneId ? updated : s));
  writeToStorage(scenes);
  notify();
  return updated;
}

/** Merge scenes from server (state:sync) */
export function mergeFromServer(serverScenes: SceneTemplate[]) {
  if (!serverScenes?.length) return;
  const merged = [...scenes];
  for (const serverScene of serverScenes) {
    const idx = merged.findIndex((s) => s.id === serverScene.id);
    if (idx >= 0) {
      // Keep the newer one
      if ((serverScene.updatedAt ?? 0) > (merged[idx].updatedAt ?? 0)) {
        merged[idx] = serverScene;
      }
    } else {
      merged.push(serverScene);
    }
  }
  scenes = merged;
  writeToStorage(scenes);
  notify();
}
