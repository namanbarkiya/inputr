# Architecture

A high-level map of how Inputr works.

## Components

```
                ┌──────────────────────┐
   web page ──▶ │  content script      │  detects file inputs
                │  (entrypoints/       │  applies known-site
                │   content.ts)        │  selectors / regex
                └──────────┬───────────┘
                           │  detection:report
                           ▼
                ┌──────────────────────┐
                │  service worker      │  persists detection,
                │  (entrypoints/       │  updates badge,
                │   background.ts)     │  forwards try-insert
                └──────────┬───────────┘
                           │  (chrome.storage.local)
                           ▼
                ┌──────────────────────┐
                │  side panel          │  reads detection on
                │  (entrypoints/       │  open, mounts the
                │   sidepanel/)        │  user-selected mode
                └──────────────────────┘
```

## Data flow

1. **Detection.** On every page at `document_idle`, the content script walks
   the DOM looking for `<input type="file">` accepting images. For known
   sites (`src/lib/known-sites.ts`) it applies a hardcoded selector. For
   anything else it applies the regex detector (`src/lib/detector.ts`).

2. **Persist.** The detection result is sent to the service worker via
   `chrome.runtime.sendMessage` and saved in `chrome.storage.local` keyed by
   tab id. The badge is updated for the originating tab.

3. **Panel open.** When the user clicks the toolbar action, Chrome opens
   the side panel. The panel reads the active tab's detection from storage.

4. **Mode mount.** The panel mounts the user's default mode. Each mode
   implements the contract in `src/types/modes.ts`: `render(ctx)`,
   `getOutputBlob()`, `destroy()`. The shell knows nothing about
   Cropper.js or canvas internals.

5. **Output.** When the user clicks Download / Copy / Try insert, the panel
   reads the current blob from the mode and dispatches:
   - **Download** → object URL + `<a download>`.
   - **Copy** → `navigator.clipboard.write` of a `ClipboardItem`.
   - **Try insert** → message back through the service worker to the active
     tab's content script, which calls `tryInsertIntoPage` (DataTransfer).
     On failure, the panel falls back to clipboard.

## File map

| Path                      | What lives there                                     |
| ------------------------- | ---------------------------------------------------- |
| `entrypoints/background`  | Service worker (state-light, re-reads storage)       |
| `entrypoints/content`     | Detection + insert injection                         |
| `entrypoints/sidepanel`   | Panel shell, mode tabs, output bar                   |
| `entrypoints/settings`    | Options page                                         |
| `src/lib/`                | Pure utilities (no DOM, no chrome side effects)      |
| `src/components/`         | Shared panel widgets (tabs, toasts, banner)          |
| `src/modes/upload-crop/`  | Upload + Crop (Cropper.js + image-compression)       |
| `src/types/`              | Shared interfaces and discriminated unions           |
| `tests/`                  | Vitest integration + Playwright e2e + DOM fixtures   |

## Key design decisions

- **WXT framework.** Vite-based, smallest bundle output, file-based
  entrypoints, framework-agnostic (so we can add React later if PDF features
  push complexity past vanilla TS). MIT-licensed and actively maintained.
- **Vanilla TypeScript.** v1 UI is small enough that React adds bundle
  weight without payoff.
- **Each mode is a self-contained module** under `src/modes/<mode-id>/`.
  v0.1 ships only Upload + Crop. Future modes drop in by satisfying the
  same `Mode` contract.
- **Pure utilities live in `src/lib/`** — no DOM, no chrome calls. Keeps
  the test surface fast and reliable.
- **Service worker assumes nothing about its own lifetime.** All state is
  re-read from `chrome.storage.local` on each event.
- **No backend.** Even v2's AI mode will use BYO API keys with direct
  `fetch()` to the provider.

## Bundle budget

We ship under 800KB total (uncompressed). The CI bundle-size check fails
the build if it goes over.

## Cross-browser

WXT supports Firefox via a config flag. Inputr is Chrome-first but we keep
APIs cross-compatible. See [BROWSER_COMPAT.md](./BROWSER_COMPAT.md).
