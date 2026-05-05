/**
 * Type-safe message contract between content script ↔ service worker ↔ panel.
 *
 * Every message has a `kind` discriminator. Wrappers in `src/lib/messaging.ts`
 * give callers a typed sendMessage / onMessage pair.
 */

import type { DetectionResult } from './detection';

export type Message =
  | { kind: 'detection:report'; payload: DetectionResult }
  | { kind: 'detection:request'; payload: { tabId?: number } }
  | { kind: 'detection:rescan' }
  // File payloads are base64-encoded because chrome.runtime.sendMessage
  // JSON-serializes messages — Blobs / ArrayBuffers do not survive transit.
  | {
      kind: 'page:try-insert';
      payload: { dataB64: string; mime: string; filename: string };
    }
  | {
      kind: 'page:try-insert:result';
      payload: { ok: boolean; reason?: string };
    }
  | { kind: 'panel:open'; payload: { tabId: number } };

export type MessageKind = Message['kind'];

export type MessageOf<K extends MessageKind> = Extract<Message, { kind: K }>;
