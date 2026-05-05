/**
 * Vitest setup. Runs once per worker before any test file.
 *
 * Provides a minimal `chrome` global for unit tests that touch storage or
 * messaging without booting the full extension.
 */

import { vi } from 'vitest';

interface FakeArea {
  data: Record<string, unknown>;
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
}

function makeArea(): FakeArea {
  const data: Record<string, unknown> = {};
  return {
    data,
    async get(key) {
      return { [key]: data[key] };
    },
    async set(items) {
      Object.assign(data, items);
    },
    async remove(key) {
      delete data[key];
    },
  };
}

(globalThis as unknown as { chrome?: unknown }).chrome ??= {
  storage: { local: makeArea(), sync: makeArea() },
  runtime: {
    sendMessage: vi.fn(async () => undefined),
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    getURL: (path: string) => path,
    openOptionsPage: vi.fn(async () => undefined),
  },
  tabs: {
    query: vi.fn(async () => []),
    sendMessage: vi.fn(async () => undefined),
    onRemoved: { addListener: vi.fn() },
    onActivated: { addListener: vi.fn() },
    create: vi.fn(async () => undefined),
  },
  action: {
    setBadgeText: vi.fn(async () => undefined),
    setBadgeBackgroundColor: vi.fn(async () => undefined),
  },
  sidePanel: {
    setPanelBehavior: vi.fn(async () => undefined),
  },
};

// Global structuredClone polyfill if happy-dom is missing it.
if (typeof structuredClone === 'undefined') {
  (globalThis as unknown as { structuredClone: typeof structuredClone }).structuredClone = (
    v: unknown,
  ) => JSON.parse(JSON.stringify(v));
}
