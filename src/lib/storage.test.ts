import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DetectionResult } from '../types/detection';
import { DEFAULT_SETTINGS } from '../types/modes';

import {
  clearDetection,
  loadDetection,
  loadSettings,
  resetSettings,
  saveDetection,
  saveSettings,
} from './storage';

interface FakeArea {
  data: Record<string, unknown>;
  get: (key: string) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
  remove: (key: string) => Promise<void>;
}

function makeArea(): FakeArea {
  const data: Record<string, unknown> = {};
  return {
    data,
    get: async (key: string) => ({ [key]: data[key] }),
    set: async (items) => {
      Object.assign(data, items);
    },
    remove: async (key: string) => {
      delete data[key];
    },
  };
}

describe('storage', () => {
  let local: FakeArea;
  let sync: FakeArea;

  beforeEach(() => {
    local = makeArea();
    sync = makeArea();
    (globalThis as unknown as { chrome: unknown }).chrome = {
      storage: { local, sync },
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('round-trips a detection result', async () => {
    const result: DetectionResult = {
      detected: true,
      url: 'https://linkedin.com',
      origin: 'https://linkedin.com',
      detectedAt: 1,
      inputCount: 1,
      constraints: {
        width: 1584,
        height: 396,
        acceptedFormats: ['image/png', 'image/jpeg'],
        maxSizeBytes: 8 * 1024 * 1024,
        source: 'known-site',
        siteId: 'linkedin',
      },
    };

    await saveDetection(42, result);
    const loaded = await loadDetection(42);
    expect(loaded).toEqual(result);
  });

  it('returns null when no detection exists', async () => {
    expect(await loadDetection(7)).toBeNull();
  });

  it('clears a detection', async () => {
    await saveDetection(1, {
      detected: false,
      url: 'x',
      origin: 'x',
      detectedAt: 0,
      inputCount: 0,
    });
    await clearDetection(1);
    expect(await loadDetection(1)).toBeNull();
  });

  it('returns defaults when no settings stored', async () => {
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('merges partial settings into existing', async () => {
    await saveSettings({ jpegQuality: 70 });
    await saveSettings({ defaultFormat: 'image/png' });
    const settings = await loadSettings();
    expect(settings.jpegQuality).toBe(70);
    expect(settings.defaultFormat).toBe('image/png');
    expect(settings.showBadge).toBe(DEFAULT_SETTINGS.showBadge);
  });

  it('resets settings to defaults', async () => {
    await saveSettings({ jpegQuality: 1 });
    await resetSettings();
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});
