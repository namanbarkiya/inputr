/**
 * Content script — runs on every page at document_idle.
 *
 * Walks the DOM looking for `<input type="file">` elements that accept
 * images. For each, applies known-site selectors first and falls back to
 * regex-based detection. Reports the result up to the service worker.
 */

import { defineContentScript } from 'wxt/sandbox';

import { base64ToBlob } from '../src/lib/clipboard';
import { detectFromInput, inputAcceptsImages } from '../src/lib/detector';
import { autoInsert, findImageFileInputs } from '../src/lib/inserter';
import { matchKnownSite } from '../src/lib/known-sites';
import { log } from '../src/lib/logger';
import { onMessage, sendMessage } from '../src/lib/messaging';
import type {
  DetectedConstraints,
  DetectionResult,
} from '../src/types/detection';

const RESCAN_DEBOUNCE_MS = 400;

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  allFrames: false,
  main() {
    let scheduled: number | null = null;

    function scheduleScan(): void {
      if (scheduled !== null) {
        clearTimeout(scheduled);
      }
      scheduled = window.setTimeout(() => {
        scheduled = null;
        void runScan();
      }, RESCAN_DEBOUNCE_MS);
    }

    async function runScan(): Promise<void> {
      try {
        const result = scanPage();
        await sendMessage({ kind: 'detection:report', payload: result });
      } catch (err) {
        log.warn('content', 'scan failed', err);
      }
    }

    // Initial scan
    void runScan();

    // Watch for DOM mutations — many sites lazy-mount upload forms.
    const observer = new MutationObserver(() => scheduleScan());
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['accept', 'type'],
    });

    // Allow the panel to request a manual rescan.
    onMessage('detection:rescan', async () => {
      await runScan();
      return { ok: true };
    });

    // The panel asks us to attempt a DataTransfer insertion. The bytes
    // arrive as base64 because chrome.runtime.sendMessage strips Blobs.
    onMessage('page:try-insert', (msg) => {
      try {
        const blob = base64ToBlob(msg.payload.dataB64, msg.payload.mime);
        const result = autoInsert(blob, msg.payload.filename);
        return {
          kind: 'page:try-insert:result' as const,
          payload: result,
        };
      } catch (err) {
        log.warn('content', 'try-insert decode failed', err);
        return {
          kind: 'page:try-insert:result' as const,
          payload: { ok: false, reason: 'decode-failed' },
        };
      }
    });
  },
});

function scanPage(): DetectionResult {
  const url = window.location.href;
  const origin = window.location.origin;
  const now = Date.now();

  const known = matchKnownSite(url);
  const inputs = findImageFileInputs(document);

  // Known-site path: trust the hardcoded selector unless the site requires
  // a DOM selector check that fails.
  if (known) {
    if (known.domSelectors && known.domSelectors.length > 0) {
      const allPresent = known.domSelectors.every((sel) =>
        document.querySelector(sel),
      );
      if (!allPresent) {
        // Fall through to generic detection
      } else {
        return {
          detected: true,
          url,
          origin,
          detectedAt: now,
          inputCount: inputs.length,
          constraints: known.constraints,
        };
      }
    } else {
      return {
        detected: true,
        url,
        origin,
        detectedAt: now,
        inputCount: inputs.length,
        constraints: known.constraints,
      };
    }
  }

  // Generic path: try regex detection on each image-accepting input,
  // returning the first success.
  for (const input of inputs) {
    if (!inputAcceptsImages(input)) continue;
    const constraints: DetectedConstraints | null = detectFromInput(input);
    if (constraints) {
      return {
        detected: true,
        url,
        origin,
        detectedAt: now,
        inputCount: inputs.length,
        constraints,
      };
    }
  }

  return {
    detected: false,
    url,
    origin,
    detectedAt: now,
    inputCount: inputs.length,
  };
}
