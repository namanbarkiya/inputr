# Inputr — v1 Build Spec

**Project:** Inputr — Chrome extension that fixes any file upload box on the web.
**License:** MIT, free forever, open source
**Repo type:** Public, contribution-friendly, maintained codebase

---

## 1. What Inputr is (one paragraph)

Inputr is a Chrome extension that detects image upload boxes on any website, reads what they want (dimensions, file format, file size limit), and lets the user produce a perfectly-fitting image without leaving the page. v1 supports three modes: **Upload + Crop** (bring an existing image, auto-crop and compress to constraints), **Create** (text + logo + background → rendered image at exact dimensions), and **Draw** (sketch on a canvas locked to target dimensions). v1 is image-only and has no AI. v2 will add PDF/document handling (split, merge, page reorder, page delete) and optional AI generation.

---

## 2. Why Inputr exists (the user's problem)

Every website that accepts image uploads has different constraints — LinkedIn banner is 1584×396, YouTube watermark is 150×150 max 1MB, Twitter banner is 1500×500, GitHub avatar is square, Notion banner is 1500×600. When users hit these constraints, they currently:

1. Get rejected or get a weird auto-crop
2. Read the small grey constraint text
3. Open Photoshop / Figma / Photopea
4. Resize, maybe add text/logo, maybe compress
5. Re-export and re-upload

This is a 5-15 minute task that happens constantly. Inputr collapses it to under 60 seconds in the same tab.

The product bar: as prevalent as **Video Speed Controller** — a free open-source Chrome extension with millions of installs that becomes invisible infrastructure devs install once and forget.

---

## 3. v1 scope

### Three modes

**Mode 1 — Upload + Crop** (the killer mode, build first)

- User drops or picks an existing image
- Auto-crops to detected ratio with adjustable crop window
- Auto-compresses if file size exceeds detected limit
- Auto-converts format if source format is not in detected `accept` list
- Live preview at exact target dimensions

**Mode 2 — Create**

- Background: solid color, gradient, or upload background image
- Text input with font, color, size, position
- Optional logo upload with position and size
- Live preview at exact target dimensions
- Renders to canvas at native target resolution

**Mode 3 — Draw**

- Drawing canvas locked to target dimensions
- Tools: pen, color picker, brush size, eraser, undo/redo, clear
- Optional shapes: rectangle, circle, line, arrow, text label
- Export at exact dimensions

### Three output paths (always available)

After a result is created, the user can:

- **Download** — saves to disk with smart filename like `linkedin-banner-1584x396.png`
- **Copy to clipboard** — uses Clipboard API; user can paste into upload box on sites that accept paste
- **Try insert into page** — attempts DataTransfer drag-drop simulation to set the file input's value. Falls back to clipboard with a clear toast if it fails.

### Detection

A content script runs on every page (or on activation) and scans for `<input type="file">` elements that accept images. When detected, it stores constraints in `chrome.storage.local`:

- Target dimensions (read from nearby text via regex `\d{2,4}\s?[x×]\s?\d{2,4}` OR from hardcoded selectors for known sites)
- Accepted formats (read from the input's `accept` attribute)
- Max file size (read from nearby text via regex `\d+\s?(MB|KB)`, default 10MB if not found)

The extension toolbar icon shows a green dot badge when detection succeeds on the current tab.

### Hardcoded site selectors for v1 (5 sites)

When detection runs on these sites, use known constraints instead of relying on regex parsing:

1. **LinkedIn** — banner upload: 1584×396, JPEG/PNG, max 8MB
2. **X / Twitter** — banner upload: 1500×500, JPEG/PNG, max 5MB
3. **GitHub** — avatar: square (recommend 460×460), JPEG/PNG/GIF, max 1MB
4. **Notion** — page cover: 1500×600 (5:2 ratio), JPEG/PNG, max 5MB
5. **YouTube** — branding watermark: 150×150, PNG/JPEG/BMP/GIF (no animation), max 1MB

For unknown sites, fall back to the regex-based generic detector. If detection fails entirely, the panel opens to manual dimension input.

### Settings (minimal)

A small settings page accessible via right-click on the extension icon:

- Default mode (Upload / Create / Draw)
- Default output format preference (JPEG / PNG / Auto)
- Default JPEG quality (1-100, default 85)
- Show toolbar badge on detection (toggle)
- Reset all settings

All settings persist via `chrome.storage.sync`.

### What v1 does NOT include

- AI image generation (v2)
- PDF/document handling (v2)
- Auto-detection on arbitrary sites beyond regex (v2 with smarter heuristics)
- Cloud sync, accounts, login (never — extension is forever local)
- Templates library (v2 if requested)
- Mobile / Safari / Firefox versions (v2)
- Multi-language support (v2)
- Image filters, color adjustments, effects (out of scope — Inputr is constraint-fitting, not editing)

---

## 4. Technical stack — the 2026 best-in-class choices

This stack is chosen specifically for 2026 conditions: best-maintained tooling, smallest bundle sizes, MV3 compliance, framework-agnostic where possible, and minimum technical debt for v2 expansion.

### Build framework: **WXT**

WXT is the consensus 2026 winner for Chrome extension development. CRXJS had maintainer issues in 2025; Plasmo produces ~43% larger bundles. WXT is most actively maintained, framework-agnostic, file-based entrypoints, cross-browser by default, smallest output bundles, and Vite-based.

WXT version: latest stable.

### UI: **Vanilla TypeScript** for v1 (React kept as escape hatch via WXT)

v1 has a small enough UI surface that React is overkill. Vanilla TypeScript with WXT's HTML entrypoints is sufficient.

If v2's PDF features push UI complexity past a tipping point, switch to React (WXT supports both in the same project).

### Image cropping: **Cropper.js v2**

Framework-agnostic, mature, full feature set, ~30KB minified+gzipped, MIT licensed.

Package: `cropperjs` (latest v2)

### Image compression: **browser-image-compression**

Has `maxSizeMB` option that does iterative quality stepdown automatically. Web Worker support built in. 2.5x more downloads than compressorjs in 2026.

Package: `browser-image-compression` (latest v2)

### Drawing canvas: **Konva.js**

Most-downloaded canvas library on npm. Multi-layer rendering. Built-in event system, drag-and-drop, transformer for resize/rotate. Framework-agnostic. MIT licensed.

Package: `konva` (latest v9+)

### Format conversion utility: **Native canvas.toBlob**

The browser's native `canvas.toBlob('image/jpeg', quality)` handles all v1 format conversion needs. No additional library.

### TypeScript: **TypeScript 5.7+**

TypeScript everywhere. No untyped JS in 2026.

---

## 5. Stack for v2 (forward-looking, do not build yet but architect for)

### v2: PDF handling — **pdf-lib** + **pdfjs-dist**

- **pdf-lib** for manipulation (merge, split, delete pages, reorder, add images)
- **pdfjs-dist** for rendering page thumbnails

Both MIT, both bundle cleanly into MV3. Don't include in v1.

### v2: AI image generation — **direct fetch to provider APIs, BYO key**

User pastes their own API key, stored in `chrome.storage.sync`. Direct `fetch()` to provider's API. No SDK, no proxy, no Inputr-hosted backend.

### v2: Document support — **mammoth.js** for .docx (if needed)

Combined with pdf-lib for output. Not a priority.

---

## 6. File structure (with WXT)

Maintainability principle: **a new contributor should be able to find any feature within 30 seconds of opening the repo.**

```
inputr/
├── README.md                      # Project overview, install, usage
├── CONTRIBUTING.md                # How to contribute, dev setup, PR rules
├── CODE_OF_CONDUCT.md             # Standard contributor covenant
├── LICENSE                        # MIT
├── CHANGELOG.md                   # Auto-generated from commits
├── SECURITY.md                    # Where to report security issues
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   ├── feature_request.md
│   │   └── site_request.md        # "Add support for site X"
│   ├── PULL_REQUEST_TEMPLATE.md
│   ├── workflows/
│   │   ├── ci.yml                 # Lint + typecheck + test on every PR
│   │   ├── release.yml            # Auto-release on tag
│   │   └── codeql.yml             # GitHub security scanning
│   └── dependabot.yml             # Auto dependency updates
├── wxt.config.ts                  # WXT framework config
├── package.json
├── tsconfig.json                  # Strict mode enabled
├── eslint.config.js               # ESLint flat config
├── prettier.config.js             # Code formatting
├── vitest.config.ts               # Unit test config
├── playwright.config.ts           # E2E test config
├── entrypoints/
│   ├── background.ts              # Service worker
│   ├── content.ts                 # Detection content script
│   ├── sidepanel/
│   │   ├── index.html
│   │   ├── main.ts
│   │   └── sidepanel.css
│   └── settings/
│       ├── index.html
│       ├── main.ts
│       └── settings.css
├── src/
│   ├── components/                # Shared UI components
│   │   ├── ModeTabs.ts
│   │   ├── OutputBar.ts
│   │   ├── DetectionBanner.ts
│   │   └── Toast.ts
│   ├── modes/
│   │   ├── upload-crop/
│   │   │   ├── index.ts
│   │   │   ├── ui.ts
│   │   │   └── upload-crop.test.ts
│   │   ├── create/
│   │   │   ├── index.ts
│   │   │   ├── ui.ts
│   │   │   ├── renderer.ts
│   │   │   └── create.test.ts
│   │   └── draw/
│   │       ├── index.ts
│   │       ├── ui.ts
│   │       ├── tools.ts
│   │       └── draw.test.ts
│   ├── lib/
│   │   ├── compressor.ts          # browser-image-compression wrapper
│   │   ├── inserter.ts            # DataTransfer auto-insert
│   │   ├── known-sites.ts         # Hardcoded site selectors
│   │   ├── detector.ts            # Generic regex-based detection
│   │   ├── filename.ts            # Smart filename generator
│   │   ├── storage.ts             # chrome.storage wrapper with types
│   │   ├── messaging.ts           # Type-safe message passing
│   │   └── *.test.ts              # Co-located unit tests
│   └── types/
│       ├── detection.ts
│       ├── modes.ts
│       └── messages.ts
├── tests/
│   ├── e2e/
│   │   ├── linkedin.spec.ts
│   │   ├── github.spec.ts
│   │   └── fixtures/              # Sample images for tests
│   └── integration/
│       └── detection.spec.ts
├── public/
│   ├── icon-16.png
│   ├── icon-48.png
│   ├── icon-128.png
│   └── icon-active-128.png
└── docs/
    ├── ARCHITECTURE.md            # System design overview
    ├── DETECTION.md               # How detection logic works
    ├── ADDING_A_SITE.md           # Step-by-step for adding a known site
    ├── ADDING_A_MODE.md           # How to add a new mode
    └── BROWSER_COMPAT.md          # Browser support matrix
```

### Why this structure

- **Each mode is its own folder** with `index.ts` + `ui.ts` + tests. A contributor wanting to fix Mode 2 doesn't need to look at Modes 1 or 3.
- **`src/lib/` is for pure utilities** — no DOM, no Chrome APIs side effects, fully unit-testable.
- **Tests are co-located with the code they test.** `compressor.ts` and `compressor.test.ts` live in the same folder. This convention is universal in modern TS projects and makes tests discoverable.
- **`docs/` is real documentation, not marketing copy.** ARCHITECTURE.md tells someone "what is this thing." ADDING_A_SITE.md tells them how to send a useful PR.
- **`.github/` templates standardize contributions.** Bug reports come in with the same fields. Feature requests are filtered. Site-add requests have their own template (this will be the most common request).

---

## 7. wxt.config.ts (skeleton)

```typescript
import { defineConfig } from "wxt";

export default defineConfig({
    manifest: {
        name: "Inputr",
        description:
            "Fix any image upload box on the web. Detects constraints, lets you upload+crop, create, or draw at the exact dimensions.",
        version: "0.1.0",
        permissions: ["sidePanel", "storage", "activeTab", "scripting"],
        host_permissions: ["<all_urls>"],
        side_panel: {
            default_path: "sidepanel.html",
        },
        action: {
            default_title: "Inputr — click to open",
        },
    },
    // Enable strict TypeScript
    vite: () => ({
        build: {
            sourcemap: true,
        },
    }),
});
```

---

## 8. Service worker behavior

The service worker (`entrypoints/background.ts`):

- Sets up `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` on install
- Listens for messages from content scripts about detection state
- Updates the toolbar icon badge (green dot) when detection succeeds
- Persists current-tab detection result in `chrome.storage.local`
- **Always re-reads from `chrome.storage.local` on each event.** Service workers go to sleep after 30s of inactivity; never rely on top-level variables for state.

---

## 9. Content script behavior

The content script (`entrypoints/content.ts`):

- Runs on `document_idle` on every page
- Scans for `<input type="file">` elements where `accept` includes any image MIME type
- For each detected input:
    1. Check if current site matches a known-sites selector → use that
    2. Otherwise, parse nearby DOM text for dimensions, format, size constraints
    3. Send detection result to the service worker via type-safe `chrome.runtime.sendMessage`
- Re-scans when the DOM mutates (debounced MutationObserver)
- Exposes a function to inject a generated file via DataTransfer for the "Insert into page" path

---

## 10. Side panel behavior

The side panel (`entrypoints/sidepanel/`):

- Opens when the user clicks the toolbar icon
- On open, reads detection state from `chrome.storage.local` for the active tab
- Shows detected constraints prominently: "Detected: 1584 × 396 px, PNG/JPEG, max 8MB"
- Shows three tabs: Upload · Create · Draw
- Default tab = whatever the user set in settings (default "Upload")
- Each mode is a self-contained module
- Result is rendered into a single shared `<canvas>` element at native target dimensions
- Output buttons act on the canvas's blob output

---

## 11. Mode-by-mode implementation notes

### Mode 1 — Upload + Crop (Cropper.js)

```typescript
import Cropper from "cropperjs";
import imageCompression from "browser-image-compression";

const cropper = new Cropper(imgElement, {
    aspectRatio: targetWidth / targetHeight,
    viewMode: 1,
    autoCropArea: 1,
    responsive: true,
});

const croppedCanvas = cropper.getCroppedCanvas({
    width: targetWidth,
    height: targetHeight,
    imageSmoothingQuality: "high",
});

const blob = await new Promise<Blob>((resolve) =>
    croppedCanvas.toBlob(resolve, outputFormat, 0.95),
);

const compressedFile = await imageCompression(
    new File([blob], "temp", { type: outputFormat }),
    {
        maxSizeMB,
        maxWidthOrHeight: Math.max(targetWidth, targetHeight),
        useWebWorker: true,
        initialQuality: 0.85,
    },
);
```

### Mode 2 — Create (vanilla canvas)

UI controls:

- Background: color picker, gradient toggle (2 colors + angle), or background image upload
- Text input field, multi-line allowed
- Font dropdown: 6-8 system + Google Fonts (bundle locally per MV3 rules)
- Text size: S/M/L/XL or numeric pixel input
- Text color: picker
- Text alignment: left/center/right
- Text position: 9-box grid
- Logo upload (drag-drop)
- Logo position: 9-box grid
- Logo size slider: 5-50% of canvas width

Render flow:

1. Output canvas sized to exact target dimensions
2. Layer 1: paint background
3. Layer 2: render text
4. Layer 3: composite logo

Re-render on every control change (debounced 100ms).

### Mode 3 — Draw (Konva.js)

```typescript
import Konva from "konva";

const stage = new Konva.Stage({
    container: containerEl,
    width: targetWidth,
    height: targetHeight,
});

const drawingLayer = new Konva.Layer();
stage.add(drawingLayer);

// Pen tool
let currentLine: Konva.Line | null = null;
stage.on("mousedown touchstart", () => {
    const pos = stage.getPointerPosition();
    if (!pos) return;
    currentLine = new Konva.Line({
        points: [pos.x, pos.y],
        stroke: currentColor,
        strokeWidth: currentBrushSize,
        lineCap: "round",
        lineJoin: "round",
        tension: 0.5,
    });
    drawingLayer.add(currentLine);
});

stage.on("mousemove touchmove", () => {
    if (!currentLine) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;
    const points = currentLine.points().concat([pos.x, pos.y]);
    currentLine.points(points);
});

stage.on("mouseup touchend", () => {
    currentLine = null;
});

const dataUrl = stage.toDataURL({
    pixelRatio: 1,
    width: targetWidth,
    height: targetHeight,
});
```

Tools panel: pen, eraser, line, rectangle, circle, arrow, text. Undo/redo via stroke history array.

---

## 12. The DataTransfer auto-insert

```typescript
function tryInsertIntoPage(
    fileInput: HTMLInputElement,
    blob: Blob,
    filename: string,
): boolean {
    try {
        const file = new File([blob], filename, { type: blob.type });
        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;

        fileInput.dispatchEvent(new Event("input", { bubbles: true }));
        fileInput.dispatchEvent(new Event("change", { bubbles: true }));

        return true;
    } catch (err) {
        return false;
    }
}
```

For sites where this fails: auto-fallback to clipboard with a clear toast. Maintain a known-good list of sites where insert works reliably.

---

## 13. UI design notes

### Side panel layout

Width: ~400px. Height: full viewport.

```
[ logo ]                          [ ⚙ ]

Detected on this page:
1584 × 396 px • PNG/JPEG • max 8MB
[ Override ]

[ Upload ] [ Create ] [ Draw ]

(mode-specific controls)
(live preview)

[ Download ]   [ Copy ]   [ Try insert ]
```

### Visual style

- Clean, minimal, builder-aesthetic
- White background, dark grey text, single accent (electric blue `#2563EB`)
- Typography: system font stack
- No decorative graphics

### Icon design

- Simple wordmark or geometric symbol
- Two states: default (grey) and active/detected (with green dot overlay)
- Sizes: 16, 48, 128px

---

## 14. Build phases

### Phase 1 — Foundation

- WXT project setup, manifest, service worker scaffold, side panel scaffold
- Detection content script with hardcoded sites
- Toolbar badge state working
- LinkedIn detection working end-to-end

### Phase 2 — Upload + Crop mode

- Cropper.js + browser-image-compression integrated
- Mode 1 full implementation
- Download path working
- Smart filename generation

### Phase 3 — Create mode

- Mode 2 full implementation (vanilla canvas)
- All three output paths (Download, Copy, Try insert)

### Phase 4 — Draw mode + generic detection

- Konva.js integrated
- Mode 3 full implementation
- Generic regex detection for unknown sites
- All 5 hardcoded sites tested

### Phase 5 — Polish + ship

- Settings page
- README, CONTRIBUTING, all docs complete
- Tests passing in CI
- GitHub release with .zip
- Submit to Chrome Web Store

---

## 15. Specific instructions for Claude Code

When generating code:

1. **Manifest V3 only.** No background pages, no remote code, no `eval`, no inline scripts.
2. **Use WXT** for the build framework.
3. **TypeScript everywhere.** Strict mode. No `any` without justification.
4. **Service worker awareness.** Workers go to sleep after 30s. Always read from `chrome.storage.local` on each event.
5. **No external dependencies via CDN.** Everything bundled locally.
6. **Use the recommended libraries:** Cropper.js (Mode 1), browser-image-compression, Konva.js (Mode 3), native canvas (Mode 2).
7. **Do NOT pull in:** React (vanilla TS sufficient for v1), tldraw, fabric.js, pdf-lib, pdfjs-dist (those are v2).
8. **Clean separation.** Each mode self-contained, exposes `render()` and `getOutputBlob()`.
9. **No analytics, no telemetry, no tracking.** Inputr is local-first forever.
10. **Accessibility.** All controls keyboard-accessible, aria labels on icon-only buttons.
11. **Smart filenames.** `[detected-context]-[dimensions].[format]`.
12. **Error handling.** Wrap every Canvas operation, clipboard call, insert attempt with toast feedback. Never silent fail.
13. **License.** MIT. Add LICENSE file. Attribute all libraries.
14. **Tests required.** Every new utility in `src/lib/` requires a co-located `.test.ts`. Every mode requires at least 3 unit tests covering happy path + 2 error cases.

---

## 16. Initial setup commands

```bash
npx wxt@latest init inputr --template vanilla
cd inputr
pnpm add cropperjs browser-image-compression konva
pnpm add -D vitest @vitest/ui playwright @playwright/test
pnpm add -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
pnpm add -D prettier eslint-config-prettier eslint-plugin-prettier
pnpm add -D @commitlint/cli @commitlint/config-conventional husky lint-staged
pnpm add -D @types/chrome

pnpm dev   # Dev with hot reload
pnpm build # Production build
pnpm zip   # Generate Chrome-Web-Store-ready zip
```

---

## 17. Success criteria for v1

The v1 is "shippable" when:

- Extension installs cleanly from a .zip side-load
- On all 5 hardcoded sites, opening the panel shows correct constraints
- Mode 1 works end-to-end on at least 3 of the 5 hardcoded sites
- Mode 2 renders an image with text + background + optional logo
- Mode 3 lets the user sketch and export
- Download works always
- Copy to clipboard works always
- "Try insert" works on at least LinkedIn and GitHub
- README, CONTRIBUTING, and ARCHITECTURE docs complete
- All tests pass in CI
- No console errors on any tested site
- Service worker survives Chrome restart cleanly
- Total bundle size under 800KB
- ESLint and Prettier pass with zero warnings
- TypeScript compiles in strict mode with zero errors

---

## 18. Out-of-scope reminders

Anything in this list is v2+:

- AI image generation
- PDF handling — pdf-lib + pdfjs-dist when this happens
- Document handling (.docx, .xlsx, etc.) — mammoth.js when this happens
- Video / audio file handling
- Cloud features, accounts, login, sync
- Templates / preset library
- Image filters / effects / color grading
- Drawing collaboration / multiplayer
- Browser support beyond Chromium (one config flag in WXT)
- Mobile = never
- Internationalization beyond English

---

## 19. Public repo maintainability requirements

This repo will be public from Day 1. People will read the code, send PRs, and judge the project by its repo hygiene. The following are non-negotiable for any merge to `main`.

### 19.1 Code quality enforcement

**TypeScript strict mode** — `tsconfig.json` must include:

```json
{
    "compilerOptions": {
        "strict": true,
        "noUnusedLocals": true,
        "noUnusedParameters": true,
        "noImplicitReturns": true,
        "noFallthroughCasesInSwitch": true,
        "exactOptionalPropertyTypes": true,
        "noUncheckedIndexedAccess": true
    }
}
```

No `any` types without a comment explaining why. No `// @ts-ignore` without a comment + linked GitHub issue.

**ESLint** with the recommended TypeScript config plus:

- `@typescript-eslint/no-floating-promises` (catch unawaited promises)
- `@typescript-eslint/no-misused-promises`
- `eslint-plugin-import` for import ordering
- Custom rule: no inline `console.log` in production code (use a logger utility)

**Prettier** for formatting. Single config file. Pre-commit hook auto-formats.

**Husky + lint-staged** so every commit auto-formats and lints staged files. No "I'll lint later." It's enforced.

**Conventional Commits** (`feat:`, `fix:`, `docs:`, etc.) enforced via commitlint. This enables automated changelog generation.

### 19.2 Testing

Three tiers of tests, all required to pass before merge:

**Unit tests** with Vitest:

- Every utility in `src/lib/` has a co-located `*.test.ts`
- Each test file covers happy path + 2 error cases minimum
- Detection regex parsers tested against real-world DOM samples (collected in `tests/fixtures/`)
- Filename generator tested with edge cases (special chars, very long names, unicode)
- Compressor tested with sample images of various sizes
- Coverage target: 80%+ for `src/lib/`, 60%+ for modes

**Integration tests** with Vitest:

- Detection logic against fixture HTML samples for each of the 5 hardcoded sites
- Storage round-trip tests
- Message passing tests between content script and service worker

**E2E tests** with Playwright:

- Install extension into a Chromium instance
- Navigate to LinkedIn (using a fixture page that mimics LinkedIn's DOM)
- Verify detection fires
- Verify panel opens with correct constraints
- Run through Mode 1 happy path
- One E2E per mode minimum

E2E tests use a local fixture-page approach, not live LinkedIn (live sites change and break tests). Real-site testing is manual.

### 19.3 CI/CD

**GitHub Actions** workflows:

`.github/workflows/ci.yml` — runs on every PR and push to main:

- Install dependencies (`pnpm install --frozen-lockfile`)
- Lint (`pnpm lint`)
- Typecheck (`pnpm typecheck`)
- Unit + integration tests (`pnpm test`)
- E2E tests (`pnpm test:e2e`)
- Build (`pnpm build`)
- Bundle size check (fail if over 800KB)

`.github/workflows/release.yml` — runs on tag push:

- Build production zip
- Generate changelog from conventional commits
- Create GitHub Release with the zip attached
- Optionally auto-submit to Chrome Web Store via API (post-v1)

`.github/workflows/codeql.yml` — GitHub's free security scanning.

**Dependabot** (`.github/dependabot.yml`) — auto-PRs for dependency updates, weekly. Critical security patches auto-merge if tests pass.

### 19.4 Documentation

These docs are required at v1 ship:

**README.md** — the front page:

- One-paragraph description with screenshot/gif
- Install instructions (Chrome Web Store + side-load)
- Quick demo (60-second gif or video link)
- Supported sites
- How it works (3-sentence summary, link to ARCHITECTURE.md)
- Contributing section pointing to CONTRIBUTING.md
- License
- Built-by line with handles

**CONTRIBUTING.md** — for would-be contributors:

- Dev setup (clone, install, run dev mode)
- How to run tests
- Coding standards (link to ESLint config, point out conventions)
- How to submit a PR (branch naming, conventional commits, tests required)
- How to add a new known-site selector (link to docs/ADDING_A_SITE.md)
- How to add a new mode (link to docs/ADDING_A_MODE.md)
- Code of Conduct reference

**docs/ARCHITECTURE.md** — system design overview:

- High-level diagram of components (service worker, content script, side panel)
- Data flow (how detection result travels from content script → SW → side panel)
- File structure walkthrough
- Key design decisions (why WXT, why Cropper.js, why no AI in v1)

**docs/DETECTION.md** — how detection logic works:

- The two paths: hardcoded selectors vs regex parsing
- How to debug detection on a given page
- Limitations and known issues

**docs/ADDING_A_SITE.md** — step-by-step:

- Where to add the selector
- How to test it
- What needs to be in the PR

**docs/ADDING_A_MODE.md** — for major contributions:

- Mode interface contract (`render()`, `getOutputBlob()`)
- File structure for a new mode
- Tests required

**CHANGELOG.md** — auto-generated from conventional commits via `changesets` or `release-please`.

**SECURITY.md** — where and how to report security issues (private email, response SLA).

### 19.5 Issue and PR templates

`.github/ISSUE_TEMPLATE/bug_report.md`:

- Inputr version
- Browser version
- Site URL where bug occurred
- Steps to reproduce
- Expected vs actual behavior
- Console errors

`.github/ISSUE_TEMPLATE/feature_request.md`:

- Problem statement
- Proposed solution
- Alternatives considered

`.github/ISSUE_TEMPLATE/site_request.md` (this will be the most common):

- Site URL
- Upload type (banner, avatar, etc.)
- Required dimensions
- Required formats
- File size limits

`.github/PULL_REQUEST_TEMPLATE.md`:

- What this PR does
- Linked issue number
- Tests added (checkbox)
- Docs updated (checkbox)
- Manual testing performed (description)

### 19.6 Code commenting standards

- **Every public function** has a JSDoc comment explaining what it does and any non-obvious behavior
- **Every regex** has a comment explaining what it matches with examples
- **Every workaround for browser quirks** has a comment with a link to the bug or spec
- **Every deviation from a library's recommended usage** has a comment explaining why
- **Inline comments only for non-obvious logic.** Don't comment what the code clearly says.

Example of good commenting:

```typescript
/**
 * Attempts to set a file input's value programmatically using DataTransfer.
 *
 * This works on plain HTML and most React sites. Fails on sites using
 * synthetic events (Twitter, parts of Notion). Caller must handle false
 * return value with a fallback (typically copy-to-clipboard).
 *
 * @param fileInput - the target <input type="file"> element
 * @param blob - the file blob to insert
 * @param filename - filename for the inserted file
 * @returns true if insertion appeared to succeed; false if it threw
 */
function tryInsertIntoPage(
  fileInput: HTMLInputElement,
  blob: Blob,
  filename: string
): boolean { ... }
```

### 19.7 Versioning

**Semantic versioning** strictly:

- `0.x.y` until first stable release (v1.0.0 = post-Chrome-Web-Store-approval)
- Major version bumps only for breaking changes (rare for an extension)
- Minor for new features
- Patch for bug fixes

**Manifest version** stays in sync with `package.json` version. WXT can handle this automatically.

### 19.8 Security

- Every PR runs CodeQL security scanning
- No secrets in the repo, ever (CI uses GitHub secrets for Chrome Web Store API tokens)
- `host_permissions` kept to `<all_urls>` only because that's what detection needs; documented in README
- No third-party network calls from the extension (write a test that asserts this)
- Content Security Policy in manifest is strict (no inline scripts, no `unsafe-eval`)

### 19.9 Repository hygiene

- **`.gitignore`** covers `node_modules`, `.output`, `.wxt`, `.env`, `coverage/`, `playwright-report/`
- **No committed builds.** `.zip` files live in GitHub Releases, not in the repo
- **No committed `node_modules`** (obviously)
- **`pnpm-lock.yaml` committed**, no `package-lock.json` or `yarn.lock`
- **Default branch is `main`** with branch protection: require PR + passing CI before merge
- **Repository has topics set** on GitHub: `chrome-extension`, `manifest-v3`, `image-tools`, `developer-tools`, `typescript`, `wxt`

### 19.10 Community signals

These are small but they make a public repo feel "alive":

- **Pin a few good-first-issue tickets** so contributors have a starting point
- **Add a "good first issue" and "help wanted" label** to the issues board
- **Respond to issues within 7 days**, even if just to acknowledge
- **Tag releases** so people can subscribe to release notifications
- **Add a Code of Conduct** (use the standard Contributor Covenant)
- **Star count is irrelevant.** Don't game it. Active issues + clean PRs are the real signal.

---

## 20. Architecture decisions worth re-reading before any v2 work

1. **WXT framework lets you add React later** without rewriting. The decision to start vanilla TS is reversible.
2. **Cross-browser support is one config flag** in WXT. Don't lock to Chrome-specific APIs unless absolutely necessary.
3. **All four chosen libraries (Cropper.js, browser-image-compression, Konva.js, eventually pdf-lib + pdfjs-dist) are MIT-licensed** and bundle fine into MV3.
4. **No backend ever.** Every feature, including v2 AI mode, must work with BYO API keys or be entirely local.
5. **Konva supports filters and image effects natively.** If a future version wants Photoshop-lite features, they're 1 day of work, not 2 weeks.
6. **pdf-lib + pdfjs-dist together solve everything for v2 PDF support.** No paid SDK, no server-side processing, no licensing concerns.
7. **Each mode is a self-contained module.** v2 can add new modes (PDF Split, PDF Merge, AI Generate) without touching existing modes.

---

End of spec. Build accordingly.
