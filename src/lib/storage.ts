/**
 * Typed wrapper around chrome.storage. All access goes through here so the
 * service worker can reload state on every event (workers sleep after 30s)
 * without scattering raw chrome.storage calls through the codebase.
 */

import type { DetectionResult } from '../types/detection';
import type { ModeSettings } from '../types/modes';
import { DEFAULT_SETTINGS } from '../types/modes';

const DETECTION_PREFIX = 'detection:';
const SETTINGS_KEY = 'settings';

function detectionKey(tabId: number): string {
  return `${DETECTION_PREFIX}${tabId}`;
}

function localArea(): chrome.storage.StorageArea | null {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return null;
  return chrome.storage.local;
}

function syncArea(): chrome.storage.StorageArea | null {
  if (typeof chrome === 'undefined' || !chrome.storage?.sync) return null;
  return chrome.storage.sync;
}

export async function saveDetection(
  tabId: number,
  result: DetectionResult,
): Promise<void> {
  const area = localArea();
  if (!area) return;
  await area.set({ [detectionKey(tabId)]: result });
}

export async function loadDetection(
  tabId: number,
): Promise<DetectionResult | null> {
  const area = localArea();
  if (!area) return null;
  const key = detectionKey(tabId);
  const data = (await area.get(key)) as Record<string, DetectionResult | undefined>;
  return data[key] ?? null;
}

export async function clearDetection(tabId: number): Promise<void> {
  const area = localArea();
  if (!area) return;
  await area.remove(detectionKey(tabId));
}

export async function loadSettings(): Promise<ModeSettings> {
  const area = syncArea();
  if (!area) return DEFAULT_SETTINGS;
  const data = (await area.get(SETTINGS_KEY)) as Record<string, Partial<ModeSettings> | undefined>;
  return { ...DEFAULT_SETTINGS, ...(data[SETTINGS_KEY] ?? {}) };
}

export async function saveSettings(settings: Partial<ModeSettings>): Promise<void> {
  const area = syncArea();
  if (!area) return;
  const current = await loadSettings();
  await area.set({ [SETTINGS_KEY]: { ...current, ...settings } });
}

export async function resetSettings(): Promise<void> {
  const area = syncArea();
  if (!area) return;
  await area.set({ [SETTINGS_KEY]: DEFAULT_SETTINGS });
}
