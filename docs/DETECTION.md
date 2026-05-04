# Detection

Two strategies, applied in order:

## 1. Known-site selectors

Hardcoded entries in `src/lib/known-sites.ts`. Each entry binds a list of
hostnames (and optional path includes / DOM selectors) to a fixed set of
constraints. When the current URL matches, that site's constraints win.

These are deliberately sparse — five sites in v1. We only add a site if its
constraints are stable and broadly useful.

## 2. Regex-based generic detector

For unknown sites, the content script:

1. Locates `<input type="file">` elements that accept images (via the
   `accept` attribute).
2. Walks up to four ancestors, concatenates their `textContent`.
3. Runs two regexes:
   - **Dimensions:** `/(\d{2,5})\s?[x×]\s?(\d{2,5})/i` — matches "1500x500",
     "1500 × 500", "1500X500".
   - **Max size:** `/(\d+(?:\.\d+)?)\s?(MB|KB|GB)\b/i` — matches "5MB",
     "1.5 MB", "500KB".
4. Parses the input's `accept` attribute into accepted MIME types.

If dimensions can't be found, detection fails for that input — the panel
opens to a manual override.

## Debugging detection on a page

1. Open the side panel. The detection banner shows what was detected.
2. Use the **Rescan** link to re-run detection (useful on lazy-mounted
   forms).
3. If something is wrong, check the page's DOM — the helper text containing
   dimensions might have moved more than four levels away, or the input
   might be inside a shadow root.

## Limitations

- **Shadow DOM.** Inputs inside a closed shadow root are invisible to the
  content script. (Open shadow roots are scanned.)
- **Dynamic forms.** A debounced `MutationObserver` re-scans on changes,
  but very late-binding upload widgets may need a manual rescan.
- **Hidden file inputs proxied by buttons.** Our DataTransfer auto-insert
  targets the actual `<input type="file">`, which may be `display:none`. We
  still set `files` on it and dispatch `change`, which is the spec's
  required behavior — but sites doing custom synthetic events won't react.
- **Sites with multiple upload boxes.** We pick the first visible one.
