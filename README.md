# Inputr

> Fix any image upload box on the web. Detects upload constraints, lets you
> upload+crop, create from text, or draw — at the exact target dimensions.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Built with WXT](https://img.shields.io/badge/Built%20with-WXT-15a14a.svg)](https://wxt.dev)

Every site that accepts image uploads has different constraints — LinkedIn
banner is 1584×396, GitHub avatar is square at 1MB, YouTube watermark is
150×150. Inputr collapses the "open Photoshop, resize, export, re-upload"
dance into a sidebar that lives in the same tab.

## Modes

- **Upload + Crop** — drop an image, auto-crop to the detected aspect ratio,
  auto-compress to the size budget, auto-convert to an accepted format.
- **Create** — background (solid / gradient / image) + text + optional logo
  composed onto a canvas at the exact target dimensions.
- **Draw** — sketch on a canvas locked to target dimensions. Pen, eraser,
  shapes, undo/redo.

After producing an image, you can **Download**, **Copy** to clipboard, or
**Try insert** which uses `DataTransfer` to set the page's file input
directly (with clipboard fallback).

## Install

### From source (dev)

```bash
npm install
npm run dev    # launches Chrome with the extension loaded
```

### From a release build

```bash
npm run build
npm run zip    # produces inputr-<version>-chrome.zip
```

Then in Chrome:

1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Drag the zip onto the page (or click "Load unpacked" and pick `.output/chrome-mv3`)

## Supported sites (v1)

Hardcoded constraints applied automatically when you visit:

| Site              | Upload type    | Dimensions | Max size |
| ----------------- | -------------- | ---------- | -------- |
| LinkedIn          | Profile banner | 1584×396   | 8 MB     |
| X / Twitter       | Profile banner | 1500×500   | 5 MB     |
| GitHub (settings) | Avatar         | 460×460    | 1 MB     |
| Notion            | Page cover     | 1500×600   | 5 MB     |
| YouTube           | Branding mark  | 150×150    | 1 MB     |

For everything else, Inputr scans the upload box for nearby text containing
dimensions ("1200x630") and a size hint ("max 5MB"). If detection fails, the
panel opens to a manual override.

Want a site added? Open a [site request issue](./.github/ISSUE_TEMPLATE/site_request.md).

## How it works

A content script runs on every page at `document_idle`, finds image-accepting
file inputs, and reports the detected constraints to the service worker. The
side panel reads the result for the active tab from `chrome.storage.local` on
open. Each mode mounts a self-contained module into the panel, paints a
canvas at the native target resolution, and offers three output paths.

Architecture deep-dive: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

## Privacy

Inputr is local-first forever. No analytics. No telemetry. No accounts. No
third-party network calls.

## Contributing

Issues and PRs welcome. Read [CONTRIBUTING.md](./CONTRIBUTING.md) for setup,
coding standards, and how to add new sites or modes. We follow the
[Contributor Covenant](./CODE_OF_CONDUCT.md).

## License

[MIT](./LICENSE) — free forever, open source.
