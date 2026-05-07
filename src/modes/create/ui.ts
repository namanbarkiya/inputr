/**
 * Create-mode UI scaffolding for the narrow side panel.
 *
 * Vertical stack: preview at top (with drag overlay), then Background /
 * Logo / Text sections each with their own controls. The mode
 * controller owns the RenderConfig; this file just builds the DOM,
 * wires events, and emits change callbacks so the controller can
 * debounce + re-render.
 *
 * Positioning is direct manipulation: click and drag the logo or text
 * on the preview itself. The overlay div sits on top of the canvas,
 * captures pointer events, hit-tests against renderer-derived bounds,
 * and shows a selection rectangle on the active item.
 */

import {
  hitTest,
  logoBounds,
  textBounds,
  type FracRect,
  type RenderConfig,
} from './renderer';

export interface CreateUI {
  /** The preview canvas. The controller paints into this. */
  canvas: HTMLCanvasElement;
  /** The frame element wrapping the canvas + overlay. Controller
   *  sizes it. */
  frame: HTMLElement;
  /** Status line dimensions text. */
  dimsEl: HTMLElement;
  /** Status line size text. */
  sizeEl: HTMLElement;
  onChange: (handler: (cfg: RenderConfig) => void) => void;
  /** Refresh inputs after the controller mutates cfg from outside
   *  (e.g. when constraints change and the text size scales with new
   *  dims). Also re-syncs the selection rectangle. */
  syncFromConfig: () => void;
  destroy: () => void;
}

const BG_SWATCHES = [
  '#0f0c08',
  '#1a1612',
  '#1f2937',
  '#0a3d62',
  '#3d348b',
  '#fd6d2c',
  '#f6f4f0',
  '#ffffff',
];

type SelectableItem = 'logo' | 'text';

export function renderCreateUI(
  container: HTMLElement,
  cfg: RenderConfig,
): CreateUI {
  container.replaceChildren();

  let onChange: ((cfg: RenderConfig) => void) | null = null;
  const fire = (): void => onChange?.(cfg);

  // ── Preview ──────────────────────────────────────────────────────
  const previewWrap = document.createElement('div');
  previewWrap.className = 'ip-cr-preview';

  const frame = document.createElement('div');
  frame.className = 'ip-cr-frame';
  const canvas = document.createElement('canvas');
  canvas.className = 'ip-cr-canvas';
  canvas.width = cfg.width;
  canvas.height = cfg.height;
  frame.appendChild(canvas);

  // Overlay layer for selection + drag. Sits on top of the canvas
  // inside the frame so the math is always relative to the canvas's
  // displayed dimensions.
  const overlay = document.createElement('div');
  overlay.className = 'ip-cr-overlay';
  overlay.tabIndex = 0;
  const selectionRect = document.createElement('div');
  selectionRect.className = 'ip-cr-selection';
  selectionRect.hidden = true;
  overlay.appendChild(selectionRect);
  frame.appendChild(overlay);

  const meta = document.createElement('div');
  meta.className = 'ip-cr-meta';
  const dimsEl = document.createElement('span');
  dimsEl.className = 'ip-cr-dims';
  const dot = document.createElement('span');
  dot.className = 'ip-cr-dot';
  dot.textContent = '·';
  const sizeEl = document.createElement('span');
  sizeEl.className = 'ip-cr-size';
  sizeEl.textContent = 'ready';
  meta.append(dimsEl, dot, sizeEl);

  const hint = document.createElement('div');
  hint.className = 'ip-cr-hint';
  hint.textContent = 'Drag the logo or text to position it';

  previewWrap.append(frame, meta, hint);
  container.appendChild(previewWrap);

  // ── Background section ───────────────────────────────────────────
  const bgSection = section('Background');
  container.appendChild(bgSection.root);

  const bgPills = document.createElement('div');
  bgPills.className = 'ip-cr-pills';
  bgPills.role = 'tablist';
  const pillSolid = pill('Color', cfg.background.kind === 'solid');
  const pillImage = pill('Image', cfg.background.kind === 'image');
  bgPills.append(pillSolid, pillImage);
  bgSection.body.appendChild(bgPills);

  const bgColorBlock = document.createElement('div');
  bgColorBlock.className = 'ip-cr-stack';

  const swatches = document.createElement('div');
  swatches.className = 'ip-cr-swatches';
  const swatchEls: HTMLButtonElement[] = [];
  for (const hex of BG_SWATCHES) {
    const sw = document.createElement('button');
    sw.type = 'button';
    sw.className = 'ip-cr-swatch';
    sw.style.background = hex;
    sw.dataset['hex'] = hex;
    sw.setAttribute('aria-label', `Background ${hex}`);
    sw.addEventListener('click', () => {
      cfg.background.kind = 'solid';
      cfg.background.color = hex;
      colorInput.value = hex;
      colorHex.textContent = hex;
      setBgPill('solid');
      markSwatch();
      fire();
    });
    swatches.appendChild(sw);
    swatchEls.push(sw);
  }
  bgColorBlock.appendChild(swatches);

  const colorRow = document.createElement('label');
  colorRow.className = 'ip-cr-color-row';
  const colorRowLabel = document.createElement('span');
  colorRowLabel.className = 'ip-cr-color-label';
  colorRowLabel.textContent = 'Custom';
  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  colorInput.className = 'ip-cr-color';
  colorInput.value = cfg.background.color;
  const colorHex = document.createElement('span');
  colorHex.className = 'ip-cr-hex';
  colorHex.textContent = cfg.background.color;
  colorInput.addEventListener('input', () => {
    cfg.background.kind = 'solid';
    cfg.background.color = colorInput.value;
    colorHex.textContent = colorInput.value;
    setBgPill('solid');
    markSwatch();
    fire();
  });
  colorRow.append(colorRowLabel, colorInput, colorHex);
  bgColorBlock.appendChild(colorRow);

  bgSection.body.appendChild(bgColorBlock);

  const bgDrop = drop('Drop background image', 'PNG, JPEG, WebP', 'image/*');
  bgDrop.input.addEventListener('change', () => {
    const f = bgDrop.input.files?.[0];
    if (f) void onBgFile(f);
  });
  wireDropZone(bgDrop.zone, (file) => {
    void onBgFile(file);
  });
  bgDrop.clear.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    cfg.background.image = null;
    bgDrop.input.value = '';
    bgDrop.markEmpty();
    cfg.background.kind = 'solid';
    setBgPill('solid');
    fire();
  });
  bgSection.body.appendChild(bgDrop.zone);

  pillSolid.addEventListener('click', () => {
    cfg.background.kind = 'solid';
    setBgPill('solid');
    fire();
  });
  pillImage.addEventListener('click', () => {
    if (!cfg.background.image) {
      bgDrop.input.click();
      return;
    }
    cfg.background.kind = 'image';
    setBgPill('image');
    fire();
  });

  // ── Logo section ─────────────────────────────────────────────────
  const logoSection = section('Logo', 'optional');
  container.appendChild(logoSection.root);

  const logoDrop = drop(
    'Drop your logo',
    'PNG, SVG, JPEG',
    'image/png,image/svg+xml,image/jpeg,image/webp',
  );
  logoDrop.input.addEventListener('change', () => {
    const f = logoDrop.input.files?.[0];
    if (f) void onLogoFile(f);
  });
  wireDropZone(logoDrop.zone, (file) => {
    void onLogoFile(file);
  });
  logoDrop.clear.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    cfg.logo.image = null;
    logoDrop.input.value = '';
    logoDrop.markEmpty();
    if (selected === 'logo') deselect();
    fire();
  });
  logoSection.body.appendChild(logoDrop.zone);

  const logoSizeWrap = document.createElement('div');
  logoSizeWrap.className = 'ip-control';
  const logoSizeHead = document.createElement('div');
  logoSizeHead.className = 'ip-control-head';
  const logoSizeLabel = document.createElement('span');
  logoSizeLabel.className = 'ip-label';
  logoSizeLabel.textContent = 'Size';
  const logoSizeValue = document.createElement('span');
  logoSizeValue.className = 'ip-control-value';
  logoSizeValue.textContent = `${Math.round(cfg.logo.widthFraction * 100)}%`;
  logoSizeHead.append(logoSizeLabel, logoSizeValue);
  const logoSizeRange = document.createElement('input');
  logoSizeRange.type = 'range';
  logoSizeRange.className = 'ip-range';
  logoSizeRange.min = '5';
  logoSizeRange.max = '50';
  logoSizeRange.step = '1';
  logoSizeRange.value = String(Math.round(cfg.logo.widthFraction * 100));
  logoSizeRange.addEventListener('input', () => {
    const v = Number(logoSizeRange.value);
    cfg.logo.widthFraction = v / 100;
    logoSizeValue.textContent = `${v}%`;
    fire();
    if (selected === 'logo') updateSelectionRect();
  });
  logoSizeWrap.append(logoSizeHead, logoSizeRange);
  logoSection.body.appendChild(logoSizeWrap);

  // ── Text section ─────────────────────────────────────────────────
  const textSection = section('Text', 'one line');
  container.appendChild(textSection.root);

  const textInput = document.createElement('input');
  textInput.type = 'text';
  textInput.className = 'ip-cr-text-input';
  textInput.placeholder = 'Type one line';
  textInput.maxLength = 120;
  textInput.value = cfg.text.text;
  textInput.addEventListener('input', () => {
    cfg.text.text = textInput.value.replace(/\s*\n\s*/g, ' ');
    fire();
    if (selected === 'text') updateSelectionRect();
  });
  textSection.body.appendChild(textInput);

  const textColorRow = document.createElement('div');
  textColorRow.className = 'ip-cr-color-row';
  const textColorLabel = document.createElement('span');
  textColorLabel.className = 'ip-cr-color-label';
  textColorLabel.textContent = 'Color';
  const textColor = document.createElement('input');
  textColor.type = 'color';
  textColor.className = 'ip-cr-color';
  textColor.value = cfg.text.color;
  textColor.addEventListener('input', () => {
    cfg.text.color = textColor.value;
    fire();
  });
  textColorRow.append(textColorLabel, textColor);
  textSection.body.appendChild(textColorRow);

  const textSizeWrap = document.createElement('div');
  textSizeWrap.className = 'ip-control';
  const textSizeHead = document.createElement('div');
  textSizeHead.className = 'ip-control-head';
  const textSizeLabel = document.createElement('span');
  textSizeLabel.className = 'ip-label';
  textSizeLabel.textContent = 'Size';
  const textSizeValue = document.createElement('span');
  textSizeValue.className = 'ip-control-value';
  textSizeHead.append(textSizeLabel, textSizeValue);
  const textSizeRange = document.createElement('input');
  textSizeRange.type = 'range';
  textSizeRange.className = 'ip-range';
  textSizeRange.min = '2';
  textSizeRange.max = '30';
  textSizeRange.step = '1';
  textSizeRange.value = String(pctFromSizePx(cfg, cfg.text.sizePx));
  textSizeValue.textContent = `${textSizeRange.value}%`;
  textSizeRange.addEventListener('input', () => {
    const pct = Number(textSizeRange.value);
    cfg.text.sizePx = sizePxFromPct(cfg, pct);
    textSizeValue.textContent = `${pct}%`;
    fire();
    if (selected === 'text') updateSelectionRect();
  });
  textSizeWrap.append(textSizeHead, textSizeRange);
  textSection.body.appendChild(textSizeWrap);

  // ── Drag + selection on overlay ──────────────────────────────────
  let selected: SelectableItem | null = null;
  let dragging = false;
  let activePointerId: number | null = null;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  overlay.addEventListener('pointermove', (ev) => {
    if (dragging && activePointerId === ev.pointerId) {
      ev.preventDefault();
      const f = overlayPos(ev);
      moveSelectedTo(f.fx - dragOffsetX, f.fy - dragOffsetY);
      return;
    }
    // Hover cursor: 'grab' over an item, default elsewhere.
    const f = overlayPos(ev);
    const hover = hitTest(cfg, f.fx, f.fy);
    overlay.style.cursor = hover ? 'grab' : 'default';
  });

  overlay.addEventListener('pointerdown', (ev) => {
    const f = overlayPos(ev);
    const hit = hitTest(cfg, f.fx, f.fy);
    if (!hit) {
      deselect();
      return;
    }
    selected = hit;
    activePointerId = ev.pointerId;
    overlay.setPointerCapture(ev.pointerId);
    dragging = true;
    overlay.style.cursor = 'grabbing';
    overlay.classList.add('is-dragging');
    const itemX = hit === 'logo' ? cfg.logo.x : cfg.text.x;
    const itemY = hit === 'logo' ? cfg.logo.y : cfg.text.y;
    dragOffsetX = f.fx - itemX;
    dragOffsetY = f.fy - itemY;
    updateSelectionRect();
  });

  overlay.addEventListener('pointerup', endDrag);
  overlay.addEventListener('pointercancel', endDrag);

  // Esc deselects, mirrors typical canvas-editor convention.
  overlay.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') deselect();
  });

  function endDrag(ev: PointerEvent): void {
    if (activePointerId !== ev.pointerId) return;
    if (overlay.hasPointerCapture(ev.pointerId)) {
      overlay.releasePointerCapture(ev.pointerId);
    }
    dragging = false;
    activePointerId = null;
    overlay.classList.remove('is-dragging');
    overlay.style.cursor = 'default';
  }

  function overlayPos(ev: PointerEvent): { fx: number; fy: number } {
    const r = overlay.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return { fx: 0.5, fy: 0.5 };
    return {
      fx: clamp01((ev.clientX - r.left) / r.width),
      fy: clamp01((ev.clientY - r.top) / r.height),
    };
  }

  function moveSelectedTo(x: number, y: number): void {
    if (!selected) return;
    const fx = clamp01(x);
    const fy = clamp01(y);
    if (selected === 'logo') {
      cfg.logo.x = fx;
      cfg.logo.y = fy;
    } else {
      cfg.text.x = fx;
      cfg.text.y = fy;
    }
    fire();
    updateSelectionRect();
  }

  function deselect(): void {
    selected = null;
    selectionRect.hidden = true;
  }

  function updateSelectionRect(): void {
    if (!selected) {
      selectionRect.hidden = true;
      return;
    }
    const r = boundsOf(selected);
    if (!r) {
      selectionRect.hidden = true;
      return;
    }
    selectionRect.hidden = false;
    selectionRect.style.left = `${r.x * 100}%`;
    selectionRect.style.top = `${r.y * 100}%`;
    selectionRect.style.width = `${r.w * 100}%`;
    selectionRect.style.height = `${r.h * 100}%`;
  }

  function boundsOf(item: SelectableItem): FracRect | null {
    return item === 'logo' ? logoBounds(cfg) : textBounds(cfg);
  }

  // ── Helpers (file scope of closure) ──────────────────────────────
  function setBgPill(kind: 'solid' | 'image'): void {
    pillSolid.setAttribute('aria-selected', String(kind === 'solid'));
    pillImage.setAttribute('aria-selected', String(kind === 'image'));
    bgColorBlock.style.display = kind === 'solid' ? '' : 'none';
  }

  function markSwatch(): void {
    const hex = cfg.background.color.toLowerCase();
    for (const sw of swatchEls) {
      const matches = (sw.dataset['hex'] ?? '').toLowerCase() === hex;
      sw.setAttribute('aria-selected', String(matches));
    }
  }

  async function onBgFile(file: File): Promise<void> {
    try {
      const img = await loadImage(file);
      cfg.background.image = img;
      cfg.background.kind = 'image';
      setBgPill('image');
      bgDrop.markLoaded(file.name);
      fire();
    } catch {
      // ignored
    }
  }

  async function onLogoFile(file: File): Promise<void> {
    try {
      const img = await loadImage(file);
      cfg.logo.image = img;
      logoDrop.markLoaded(file.name);
      fire();
      // Auto-select the logo so the user can drag immediately.
      selected = 'logo';
      updateSelectionRect();
    } catch {
      // ignored
    }
  }

  // Initial state.
  setBgPill(cfg.background.kind);
  markSwatch();

  return {
    canvas,
    frame,
    dimsEl,
    sizeEl,
    onChange(handler) {
      onChange = handler;
    },
    syncFromConfig() {
      const pct = pctFromSizePx(cfg, cfg.text.sizePx);
      textSizeRange.value = String(pct);
      textSizeValue.textContent = `${pct}%`;
      updateSelectionRect();
    },
    destroy() {
      container.replaceChildren();
    },
  };
}

// ── Local helpers ──────────────────────────────────────────────────

interface Section {
  root: HTMLElement;
  body: HTMLElement;
}

function section(title: string, tag?: string): Section {
  const root = document.createElement('section');
  root.className = 'ip-cr-section';
  const head = document.createElement('header');
  head.className = 'ip-cr-section-head';
  const heading = document.createElement('h3');
  heading.className = 'ip-cr-section-title';
  heading.textContent = title;
  head.appendChild(heading);
  if (tag) {
    const t = document.createElement('span');
    t.className = 'ip-cr-section-tag';
    t.textContent = tag;
    head.appendChild(t);
  }
  const body = document.createElement('div');
  body.className = 'ip-cr-section-body';
  root.append(head, body);
  return { root, body };
}

function pill(label: string, selected: boolean): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'ip-cr-pill';
  b.textContent = label;
  b.setAttribute('role', 'tab');
  b.setAttribute('aria-selected', String(selected));
  return b;
}

interface DropZone {
  zone: HTMLLabelElement;
  input: HTMLInputElement;
  clear: HTMLButtonElement;
  markLoaded: (filename: string) => void;
  markEmpty: () => void;
}

function drop(line: string, sub: string, accept: string): DropZone {
  const zone = document.createElement('label');
  zone.className = 'ip-cr-drop';
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  zone.appendChild(input);

  const lineEl = document.createElement('div');
  lineEl.className = 'ip-cr-drop-line';
  lineEl.textContent = line;
  const subEl = document.createElement('div');
  subEl.className = 'ip-cr-drop-sub';
  subEl.textContent = sub;

  const loaded = document.createElement('div');
  loaded.className = 'ip-cr-drop-loaded';
  loaded.hidden = true;
  const loadedName = document.createElement('span');
  loaded.appendChild(loadedName);
  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'ip-cr-drop-clear';
  clear.textContent = 'remove';
  loaded.appendChild(clear);

  zone.append(lineEl, subEl, loaded);

  return {
    zone,
    input,
    clear,
    markLoaded(filename: string): void {
      loaded.hidden = false;
      loadedName.textContent = trimName(filename);
      zone.classList.add('is-loaded');
    },
    markEmpty(): void {
      loaded.hidden = true;
      loadedName.textContent = '';
      zone.classList.remove('is-loaded');
    },
  };
}

function wireDropZone(
  zone: HTMLLabelElement,
  handle: (file: File) => void,
): void {
  zone.addEventListener('dragover', (ev) => {
    ev.preventDefault();
    zone.classList.add('is-drag');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('is-drag'));
  zone.addEventListener('drop', (ev) => {
    ev.preventDefault();
    zone.classList.remove('is-drag');
    const f = ev.dataTransfer?.files?.[0];
    if (f) handle(f);
  });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image load failed'));
    };
    img.src = url;
  });
}

function trimName(name: string): string {
  if (name.length <= 24) return name;
  return name.slice(0, 14) + '…' + name.slice(-8);
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function sizePxFromPct(cfg: RenderConfig, pct: number): number {
  return Math.max(8, Math.round((Math.min(cfg.width, cfg.height) * pct) / 100));
}

function pctFromSizePx(cfg: RenderConfig, sizePx: number): number {
  const ref = Math.min(cfg.width, cfg.height);
  return Math.round((sizePx / ref) * 100);
}
