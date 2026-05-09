# Inputr

> Fix any image upload box on the web. Detects upload constraints and lets
> you crop the image you have to the exact target dimensions, in the same
> tab.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Built with WXT](https://img.shields.io/badge/Built%20with-WXT-15a14a.svg)](https://wxt.dev)

Every site that accepts image uploads has different constraints. LinkedIn
banner is 1584×396, GitHub avatar is square at 1MB, YouTube watermark is
150×150. Inputr collapses the "open Photoshop, resize, export, re-upload"
dance into a sidebar that lives in the same tab.

## What ships in v0.1

Three modes, all locked to the detected (or chosen) target dimensions and
size budget.

- **Crop** — drop an image, frame the crop, get a perfectly sized output.
  Auto-compresses to the size budget and auto-converts to an accepted
  format.
- **Create** — drop a background image or pick a color, drop your logo,
  type one line of text. Drag logo and text on the preview to position.
  Composed at the exact target dimensions.
- **Draw** — quick whiteboard for diagrams, workflows, and annotations.
  Pen, rectangle, ellipse, arrow, text, with multi-select via shift-click
  or marquee drag, group move, group delete, undo, and clear.

Three output paths, available on every result:

- **Download.** Saves to disk with a smart filename like
  `linkedin-banner-1584x396.png`.
- **Copy** to clipboard. Paste into the upload box on sites that accept
  paste.
- **Try insert.** Uses `DataTransfer` to set the page's file input
  directly. Falls back to clipboard with a clear toast if the site blocks
  programmatic insertion.

## Install

### From a release zip (recommended)

1. Grab the latest zip from the [Releases page](https://github.com/namanbarkiya/inputr/releases).
   Pick `inputr-<version>-chrome.zip` for Chrome / Edge / Brave / Arc, or
   `inputr-<version>-firefox.zip` for Firefox.
2. Unzip it.
3. **Chrome / Edge / Brave / Arc:** open `chrome://extensions`, turn on
   **Developer mode**, click **Load unpacked**, and pick the unzipped
   folder.
4. **Firefox:** open `about:debugging#/runtime/this-firefox`, click **Load
   Temporary Add-on**, and pick the `manifest.json` inside the unzipped
   folder.

Pin the toolbar icon and click it on any page with an upload box. The side
panel opens with the detected target.

### From source (dev)

```bash
npm install
npm run dev          # Chrome dev mode with hot reload
npm run dev:firefox  # Firefox dev mode
```

### Build your own zip

```bash
npm install
npm run zip          # inputr-<version>-chrome.zip
npm run zip:firefox  # inputr-<version>-firefox.zip
```

Output lands in `.output/`.

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

## Landing page

Static HTML/CSS/JS in [`landing/`](./landing). Deployed on Vercel via the
root `vercel.json` (skips the extension build, serves `landing/` directly).
Local preview: `npx --yes http-server landing -p 4321 -o`.

## Contributing

Issues and PRs welcome. Read [CONTRIBUTING.md](./CONTRIBUTING.md) for setup,
coding standards, and how to add new sites or modes. We follow the
[Contributor Covenant](./CODE_OF_CONDUCT.md).

## License

[MIT](./LICENSE). Free forever, open source.
