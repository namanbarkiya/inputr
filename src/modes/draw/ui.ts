/**
 * Draw mode UI.
 *
 * Owns the toolbar, canvas, color / stroke controls, and tool event
 * handlers. Keeps the shape list and selection in a single mutable
 * state and re-paints the canvas on every change. Commit events fire
 * after a shape is added, moved, deleted, or finished editing — those
 * are the moments the controller re-exports the blob.
 *
 * Selection is rendered as DOM overlays rather than painted onto the
 * canvas, so canvas exports (copy / download) never include the
 * selection bbox. A separate "selection layer" div sits on top of the
 * canvas and holds one rect-div per selected shape, plus a marquee
 * rect-div that's only visible during rubber-band selection.
 *
 * Pointer flow per tool:
 *   - select: down on a shape selects it (shift toggles in/out of the
 *               current set), drag translates every selected shape;
 *               down on empty area starts a marquee that selects all
 *               shapes whose bbox the marquee touches.
 *   - pen:    down starts a new path, move appends points, up commits
 *   - rect / ellipse / arrow: down anchors corner/centre, move
 *               resizes the in-progress shape, up commits
 *   - text:   down opens an inline input overlay; commit on Enter or
 *               blur (Esc cancels)
 */

import {
  boundingBox,
  hitTest,
  paintAll,
  shapeIntersectsRect,
  translateShape,
} from './render';
import type {
  AABB,
  ArrowShape,
  EllipseShape,
  PenShape,
  RectShape,
  Shape,
  TextShape,
  Tool,
} from './types';

export interface DrawUI {
  canvas: HTMLCanvasElement;
  frame: HTMLElement;
  /** Bound by the controller; re-renders + re-exports on commit. */
  onCommit: (handler: () => void) => void;
  /** Re-fit the canvas frame after a container resize. */
  fitFrame: () => void;
  /** Update output dims (when constraints change). */
  setDimensions: (width: number, height: number) => void;
  /** The status line nodes the controller paints into. */
  dimsEl: HTMLElement;
  sizeEl: HTMLElement;
  destroy: () => void;
}

const SWATCHES = [
  '#1a1612',
  '#fd6d2c',
  '#dc2626',
  '#16a34a',
  '#2563eb',
  '#a855f7',
  '#f59e0b',
  '#ffffff',
];

const STROKE_MIN = 1;
const STROKE_MAX = 24;
const STROKE_DEFAULT = 4;

const DEFAULT_TEXT_SIZE = 32;

const SVG = {
  select:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 3l7 17 2.5-7 7-2.5L4 3z"/></svg>',
  pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21l4-1 12-12-3-3L4 17l-1 4z"/></svg>',
  rect: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="6" width="16" height="12" rx="1.5"/></svg>',
  ellipse:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="12" rx="9" ry="6"/></svg>',
  arrow:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h15m-5-5l5 5-5 5"/></svg>',
  text: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 6h14M12 6v14"/></svg>',
  undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14l-5-5 5-5M4 9h11a5 5 0 015 5v0a5 5 0 01-5 5H8"/></svg>',
  clear:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>',
};

interface State {
  tool: Tool;
  shapes: Shape[];
  history: Shape[][];
  selectedIds: Set<string>;
  stroke: string;
  fill: string | null;
  strokeWidth: number;
  textSize: number;
  /** In-progress shape during drag. Painted but not yet committed. */
  draft: Shape | null;
}

interface SetupOpts {
  width: number;
  height: number;
  background: string;
}

export function renderDrawUI(
  container: HTMLElement,
  opts: SetupOpts,
): DrawUI {
  container.replaceChildren();

  let commitHandler: (() => void) | null = null;

  const state: State = {
    tool: 'pen',
    shapes: [],
    history: [],
    selectedIds: new Set(),
    stroke: '#1a1612',
    fill: null,
    strokeWidth: STROKE_DEFAULT,
    textSize: DEFAULT_TEXT_SIZE,
    draft: null,
  };

  let outputW = opts.width;
  let outputH = opts.height;

  // ── Toolbar (tools) ─────────────────────────────────────────────
  const toolbar = document.createElement('div');
  toolbar.className = 'ip-dr-toolbar';

  const toolButtons = new Map<Tool, HTMLButtonElement>();
  const tools: Array<{ id: Tool; label: string; key: string; svg: string }> = [
    { id: 'select', label: 'Select', key: 'V', svg: SVG.select },
    { id: 'pen', label: 'Pen', key: 'P', svg: SVG.pen },
    { id: 'rect', label: 'Rectangle', key: 'R', svg: SVG.rect },
    { id: 'ellipse', label: 'Ellipse', key: 'E', svg: SVG.ellipse },
    { id: 'arrow', label: 'Arrow', key: 'A', svg: SVG.arrow },
    { id: 'text', label: 'Text', key: 'T', svg: SVG.text },
  ];
  for (const t of tools) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ip-dr-tool';
    b.dataset['tool'] = t.id;
    b.title = `${t.label} (${t.key})`;
    b.setAttribute('aria-label', t.label);
    b.innerHTML = t.svg;
    b.addEventListener('click', () => setTool(t.id));
    toolbar.appendChild(b);
    toolButtons.set(t.id, b);
  }
  container.appendChild(toolbar);

  // ── Property bar ────────────────────────────────────────────────
  const props = document.createElement('div');
  props.className = 'ip-dr-props';

  const swatchRow = document.createElement('div');
  swatchRow.className = 'ip-dr-swatches';
  const swatchEls: HTMLButtonElement[] = [];
  for (const hex of SWATCHES) {
    const sw = document.createElement('button');
    sw.type = 'button';
    sw.className = 'ip-dr-swatch';
    sw.style.background = hex;
    sw.dataset['hex'] = hex;
    sw.setAttribute('aria-label', `Color ${hex}`);
    sw.addEventListener('click', () => setColor(hex));
    swatchRow.appendChild(sw);
    swatchEls.push(sw);
  }
  const customColor = document.createElement('input');
  customColor.type = 'color';
  customColor.className = 'ip-dr-color-input';
  customColor.value = state.stroke;
  customColor.addEventListener('input', () => setColor(customColor.value));
  swatchRow.appendChild(customColor);
  props.appendChild(swatchRow);

  const propsRow = document.createElement('div');
  propsRow.className = 'ip-dr-props-row';

  const widthWrap = document.createElement('label');
  widthWrap.className = 'ip-dr-width';
  const widthLabel = document.createElement('span');
  widthLabel.className = 'ip-dr-width-label';
  widthLabel.textContent = 'Stroke';
  const widthSlider = document.createElement('input');
  widthSlider.type = 'range';
  widthSlider.min = String(STROKE_MIN);
  widthSlider.max = String(STROKE_MAX);
  widthSlider.step = '1';
  widthSlider.value = String(state.strokeWidth);
  widthSlider.className = 'ip-range ip-dr-width-range';
  widthSlider.addEventListener('input', () => {
    state.strokeWidth = Number(widthSlider.value);
    repaint();
  });
  widthWrap.append(widthLabel, widthSlider);
  propsRow.appendChild(widthWrap);

  const fillBtn = document.createElement('button');
  fillBtn.type = 'button';
  fillBtn.className = 'ip-dr-fill-btn';
  fillBtn.setAttribute('aria-pressed', 'false');
  fillBtn.title = 'Toggle fill (uses current color)';
  fillBtn.innerHTML = '<span class="ip-dr-fill-dot"></span>Fill';
  fillBtn.addEventListener('click', () => {
    state.fill = state.fill ? null : state.stroke;
    fillBtn.setAttribute('aria-pressed', String(state.fill !== null));
    fillBtn.classList.toggle('is-on', state.fill !== null);
  });
  propsRow.appendChild(fillBtn);

  const undoBtn = document.createElement('button');
  undoBtn.type = 'button';
  undoBtn.className = 'ip-dr-icon-btn';
  undoBtn.title = 'Undo (⌘Z)';
  undoBtn.setAttribute('aria-label', 'Undo');
  undoBtn.innerHTML = SVG.undo;
  undoBtn.addEventListener('click', undo);
  propsRow.appendChild(undoBtn);

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'ip-dr-icon-btn';
  clearBtn.title = 'Clear all';
  clearBtn.setAttribute('aria-label', 'Clear all');
  clearBtn.innerHTML = SVG.clear;
  clearBtn.addEventListener('click', clearAll);
  propsRow.appendChild(clearBtn);

  props.appendChild(propsRow);
  container.appendChild(props);

  // ── Canvas frame ────────────────────────────────────────────────
  const frame = document.createElement('div');
  frame.className = 'ip-dr-frame';
  const canvas = document.createElement('canvas');
  canvas.className = 'ip-dr-canvas';
  canvas.width = outputW;
  canvas.height = outputH;
  frame.appendChild(canvas);

  // Selection overlay layer. pointer-events:none so the clicks pass
  // through to the canvas underneath.
  const selectionLayer = document.createElement('div');
  selectionLayer.className = 'ip-dr-selection-layer';
  frame.appendChild(selectionLayer);

  // Marquee rectangle, only visible during rubber-band drag.
  const marqueeEl = document.createElement('div');
  marqueeEl.className = 'ip-dr-marquee';
  marqueeEl.hidden = true;
  frame.appendChild(marqueeEl);

  // Inline text editor overlay.
  const textEditor = document.createElement('input');
  textEditor.type = 'text';
  textEditor.className = 'ip-dr-text-editor';
  textEditor.hidden = true;
  textEditor.placeholder = 'Type, Enter to add';
  frame.appendChild(textEditor);

  container.appendChild(frame);

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
  container.appendChild(meta);

  setTool(state.tool);
  markSwatch();

  // ── Pointer state ───────────────────────────────────────────────
  let activePointerId: number | null = null;
  /** Last pointer position during a drag, in canvas coords. Used to
   *  compute incremental delta for shape translation. */
  let dragLast: { x: number; y: number } | null = null;
  /** True while the user is rubber-banding. */
  let marqueeStart: { x: number; y: number } | null = null;
  /** Selection captured at marquee start (so shift+drag is additive). */
  let marqueeBaseline: Set<string> = new Set();
  /** True when we pushed history at drag start so we don't push again
   *  for every pointermove. */
  let dragHistoryPushed = false;

  canvas.addEventListener('pointerdown', (ev) => {
    if (textEditor.hidden === false) commitText();
    const p = canvasPos(ev);

    // Text mode is click-to-place; no drag, no pointer capture. We
    // also preventDefault so the canvas's default focus action
    // doesn't pull keyboard focus away from the editor.
    if (state.tool === 'text') {
      ev.preventDefault();
      openTextEditor(p.x, p.y);
      return;
    }

    activePointerId = ev.pointerId;
    canvas.setPointerCapture(ev.pointerId);

    if (state.tool === 'select') {
      const hit = hitTest(state.shapes, p.x, p.y);
      const additive = ev.shiftKey;

      if (hit) {
        if (additive) {
          // Toggle hit shape in / out of the current selection.
          if (state.selectedIds.has(hit.id)) {
            state.selectedIds.delete(hit.id);
          } else {
            state.selectedIds.add(hit.id);
          }
        } else if (!state.selectedIds.has(hit.id)) {
          // Click on an unselected shape → replace selection.
          state.selectedIds = new Set([hit.id]);
        }
        // Clicking a selected shape with no shift just keeps the
        // selection and starts dragging the group.
        dragLast = { x: p.x, y: p.y };
        dragHistoryPushed = false;
      } else {
        // Empty area: start a marquee. Shift preserves the existing
        // selection so the marquee adds to it.
        if (!additive) state.selectedIds = new Set();
        marqueeStart = { x: p.x, y: p.y };
        marqueeBaseline = new Set(state.selectedIds);
        showMarquee(p.x, p.y, 0, 0);
      }
      syncSelectionDOM();
      return;
    }

    state.selectedIds = new Set();
    syncSelectionDOM();
    state.draft = startShape(state.tool, p.x, p.y);
    dragLast = { x: p.x, y: p.y };
    repaint();
  });

  canvas.addEventListener('pointermove', (ev) => {
    if (activePointerId !== ev.pointerId) {
      // Hover cursor for select tool.
      if (state.tool === 'select') {
        const p = canvasPos(ev);
        const hover = hitTest(state.shapes, p.x, p.y);
        canvas.style.cursor = hover ? 'move' : 'default';
      }
      return;
    }
    const p = canvasPos(ev);

    // Marquee rubber-band.
    if (state.tool === 'select' && marqueeStart) {
      const r = normaliseRect(marqueeStart.x, marqueeStart.y, p.x, p.y);
      showMarquee(r.x, r.y, r.w, r.h);
      const inside = new Set<string>(marqueeBaseline);
      for (const s of state.shapes) {
        if (shapeIntersectsRect(s, r)) inside.add(s.id);
      }
      state.selectedIds = inside;
      syncSelectionDOM();
      return;
    }

    // Group drag of selected shapes.
    if (
      state.tool === 'select' &&
      state.selectedIds.size > 0 &&
      dragLast
    ) {
      const dx = p.x - dragLast.x;
      const dy = p.y - dragLast.y;
      if (dx === 0 && dy === 0) return;
      if (!dragHistoryPushed) {
        pushHistory();
        dragHistoryPushed = true;
      }
      state.shapes = state.shapes.map((s) =>
        state.selectedIds.has(s.id) ? translateShape(s, dx, dy) : s,
      );
      dragLast = p;
      repaint();
      syncSelectionDOM();
      return;
    }

    // Pen tool: append points along the move path.
    if (state.draft?.type === 'pen' && (ev.buttons & 1) !== 0) {
      const last = state.draft.points[state.draft.points.length - 1];
      if (!last || Math.hypot(p.x - last.x, p.y - last.y) >= 1.5) {
        state.draft.points.push(p);
        repaint();
      }
      return;
    }

    // Other shape drafts: update endpoint.
    if (state.draft && dragLast) {
      state.draft = updateShape(
        state.draft,
        dragLast.x,
        dragLast.y,
        p.x,
        p.y,
      );
      repaint();
    }
  });

  canvas.addEventListener('pointerup', (ev) => endPointer(ev));
  canvas.addEventListener('pointercancel', (ev) => endPointer(ev));

  function endPointer(ev: PointerEvent): void {
    if (activePointerId !== ev.pointerId) return;
    if (canvas.hasPointerCapture(ev.pointerId)) {
      canvas.releasePointerCapture(ev.pointerId);
    }
    activePointerId = null;

    // Marquee finalises whatever it had selected on the last move.
    if (marqueeStart) {
      hideMarquee();
      marqueeStart = null;
      marqueeBaseline = new Set();
      syncSelectionDOM();
      return;
    }

    if (state.draft) {
      // Reject zero-extent drafts (a quick click without drag).
      const b = boundingBox(state.draft);
      if (b && (b.w >= 2 || b.h >= 2 || state.draft.type === 'pen')) {
        pushHistory();
        state.shapes.push(state.draft);
      }
      state.draft = null;
      dragLast = null;
      repaint();
      commitHandler?.();
      return;
    }

    if (state.tool === 'select') {
      if (dragHistoryPushed) {
        commitHandler?.();
        dragHistoryPushed = false;
      }
      dragLast = null;
    }
  }

  // ── Keyboard shortcuts ──────────────────────────────────────────
  function onKey(ev: KeyboardEvent): void {
    if (!textEditor.hidden) return;
    const t = ev.target as HTMLElement | null;
    if (
      t &&
      (t.tagName === 'INPUT' ||
        t.tagName === 'TEXTAREA' ||
        t.tagName === 'SELECT')
    ) {
      if (!isUndoCombo(ev)) return;
    }

    if (isUndoCombo(ev)) {
      ev.preventDefault();
      undo();
      return;
    }

    if (ev.key === 'Backspace' || ev.key === 'Delete') {
      if (state.selectedIds.size > 0) {
        ev.preventDefault();
        deleteSelected();
      }
      return;
    }

    if (ev.key === 'Escape') {
      state.selectedIds = new Set();
      syncSelectionDOM();
      return;
    }

    // Cmd/Ctrl+A → select all.
    if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 'a') {
      ev.preventDefault();
      setTool('select');
      state.selectedIds = new Set(state.shapes.map((s) => s.id));
      syncSelectionDOM();
      return;
    }

    const map: Record<string, Tool> = {
      v: 'select',
      p: 'pen',
      r: 'rect',
      e: 'ellipse',
      a: 'arrow',
      t: 'text',
    };
    const tool = map[ev.key.toLowerCase()];
    if (tool) {
      ev.preventDefault();
      setTool(tool);
    }
  }
  document.addEventListener('keydown', onKey);

  // ── Selection / marquee DOM ─────────────────────────────────────
  /** Convert a canvas-space AABB into display-space pixel coords
   *  relative to the frame. Used to position selection rects and the
   *  marquee. */
  function canvasRectToFrame(b: AABB): {
    left: number;
    top: number;
    w: number;
    h: number;
  } | null {
    const r = canvas.getBoundingClientRect();
    const fr = frame.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return null;
    const sx = r.width / canvas.width;
    const sy = r.height / canvas.height;
    return {
      left: b.x * sx + (r.left - fr.left),
      top: b.y * sy + (r.top - fr.top),
      w: b.w * sx,
      h: b.h * sy,
    };
  }

  function syncSelectionDOM(): void {
    selectionLayer.replaceChildren();
    if (state.selectedIds.size === 0) return;
    for (const s of state.shapes) {
      if (!state.selectedIds.has(s.id)) continue;
      const b = boundingBox(s);
      if (!b) continue;
      const pad = Math.max(4, s.strokeWidth);
      const padded: AABB = {
        x: b.x - pad,
        y: b.y - pad,
        w: b.w + pad * 2,
        h: b.h + pad * 2,
      };
      const disp = canvasRectToFrame(padded);
      if (!disp) continue;
      const div = document.createElement('div');
      div.className = 'ip-dr-sel-rect';
      div.style.left = `${disp.left}px`;
      div.style.top = `${disp.top}px`;
      div.style.width = `${disp.w}px`;
      div.style.height = `${disp.h}px`;
      selectionLayer.appendChild(div);
    }
  }

  function showMarquee(x: number, y: number, w: number, h: number): void {
    const disp = canvasRectToFrame({ x, y, w, h });
    if (!disp) return;
    marqueeEl.hidden = false;
    marqueeEl.style.left = `${disp.left}px`;
    marqueeEl.style.top = `${disp.top}px`;
    marqueeEl.style.width = `${disp.w}px`;
    marqueeEl.style.height = `${disp.h}px`;
  }

  function hideMarquee(): void {
    marqueeEl.hidden = true;
  }

  // ── Helpers ─────────────────────────────────────────────────────
  function canvasPos(ev: PointerEvent): { x: number; y: number } {
    const r = canvas.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return { x: 0, y: 0 };
    return {
      x: (ev.clientX - r.left) * (canvas.width / r.width),
      y: (ev.clientY - r.top) * (canvas.height / r.height),
    };
  }

  function setTool(tool: Tool): void {
    state.tool = tool;
    for (const [id, btn] of toolButtons) {
      btn.setAttribute('aria-pressed', String(id === tool));
    }
    canvas.style.cursor = cursorForTool(tool);
    if (tool !== 'select') {
      state.selectedIds = new Set();
      syncSelectionDOM();
    }
    repaint();
  }

  function setColor(hex: string): void {
    state.stroke = hex;
    if (state.fill !== null) state.fill = hex;
    customColor.value = hex;
    markSwatch();
    if (state.selectedIds.size > 0) {
      pushHistory();
      state.shapes = state.shapes.map((s) =>
        state.selectedIds.has(s.id)
          ? { ...s, stroke: hex, fill: s.fill !== null ? hex : s.fill }
          : s,
      );
      repaint();
      syncSelectionDOM();
      commitHandler?.();
    }
  }

  function markSwatch(): void {
    const cur = state.stroke.toLowerCase();
    for (const sw of swatchEls) {
      const matches = (sw.dataset['hex'] ?? '').toLowerCase() === cur;
      sw.setAttribute('aria-selected', String(matches));
    }
  }

  function startShape(tool: Tool, x: number, y: number): Shape | null {
    const id = newId();
    const base = {
      id,
      stroke: state.stroke,
      fill: state.fill,
      strokeWidth: state.strokeWidth,
    };
    switch (tool) {
      case 'pen': {
        const p: PenShape = { ...base, type: 'pen', points: [{ x, y }] };
        return p;
      }
      case 'rect': {
        const r: RectShape = { ...base, type: 'rect', x, y, w: 0, h: 0 };
        return r;
      }
      case 'ellipse': {
        const e: EllipseShape = {
          ...base,
          type: 'ellipse',
          cx: x,
          cy: y,
          rx: 0,
          ry: 0,
        };
        return e;
      }
      case 'arrow': {
        const a: ArrowShape = {
          ...base,
          type: 'arrow',
          x1: x,
          y1: y,
          x2: x,
          y2: y,
        };
        return a;
      }
      default:
        return null;
    }
  }

  function updateShape(
    s: Shape,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
  ): Shape {
    if (s.type === 'pen') return s;
    if (s.type === 'rect') {
      const x = Math.min(startX, endX);
      const y = Math.min(startY, endY);
      return { ...s, x, y, w: Math.abs(endX - startX), h: Math.abs(endY - startY) };
    }
    if (s.type === 'ellipse') {
      const cx = (startX + endX) / 2;
      const cy = (startY + endY) / 2;
      return {
        ...s,
        cx,
        cy,
        rx: Math.abs(endX - startX) / 2,
        ry: Math.abs(endY - startY) / 2,
      };
    }
    if (s.type === 'arrow') {
      return { ...s, x2: endX, y2: endY };
    }
    return s;
  }

  function pushHistory(): void {
    state.history.push(state.shapes.map((s) => cloneShape(s)));
    if (state.history.length > 50) state.history.shift();
  }

  function undo(): void {
    const prev = state.history.pop();
    if (!prev) return;
    state.shapes = prev;
    state.selectedIds = new Set();
    repaint();
    syncSelectionDOM();
    commitHandler?.();
  }

  function clearAll(): void {
    if (state.shapes.length === 0) return;
    pushHistory();
    state.shapes = [];
    state.selectedIds = new Set();
    repaint();
    syncSelectionDOM();
    commitHandler?.();
  }

  function deleteSelected(): void {
    if (state.selectedIds.size === 0) return;
    pushHistory();
    state.shapes = state.shapes.filter((s) => !state.selectedIds.has(s.id));
    state.selectedIds = new Set();
    repaint();
    syncSelectionDOM();
    commitHandler?.();
  }

  function repaint(): void {
    const list = state.draft ? [...state.shapes, state.draft] : state.shapes;
    paintAll(canvas, list, outputW, outputH, {
      background: opts.background,
    });
    // Selection rects sit in DOM and need to follow shape mutations.
    syncSelectionDOM();
  }

  // ── Inline text editor ──────────────────────────────────────────
  let textTarget: { x: number; y: number } | null = null;
  let suppressNextBlurCommit = false;

  function openTextEditor(x: number, y: number): void {
    textTarget = { x, y };
    const r = canvas.getBoundingClientRect();
    const fr = frame.getBoundingClientRect();
    const px = ((x / outputW) * r.width) + (r.left - fr.left);
    const py = ((y / outputH) * r.height) + (r.top - fr.top);
    textEditor.hidden = false;
    textEditor.value = '';
    const dispSize = state.textSize * (r.height / outputH);
    textEditor.style.left = `${Math.max(2, px)}px`;
    textEditor.style.top = `${Math.max(2, py)}px`;
    textEditor.style.fontSize = `${Math.max(11, dispSize)}px`;
    textEditor.style.color = state.stroke;
    suppressNextBlurCommit = true;
    setTimeout(() => {
      textEditor.focus();
      textEditor.select();
      suppressNextBlurCommit = false;
    }, 0);
  }

  function commitText(): void {
    if (!textTarget) {
      textEditor.hidden = true;
      return;
    }
    const v = textEditor.value;
    textEditor.hidden = true;
    if (v.trim().length > 0) {
      const t: TextShape = {
        id: newId(),
        type: 'text',
        x: textTarget.x,
        y: textTarget.y,
        text: v,
        size: state.textSize,
        stroke: state.stroke,
        fill: null,
        strokeWidth: 0,
      };
      pushHistory();
      state.shapes.push(t);
      repaint();
      commitHandler?.();
    }
    textTarget = null;
  }

  textEditor.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      commitText();
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      textEditor.hidden = true;
      textTarget = null;
    }
  });
  textEditor.addEventListener('blur', () => {
    if (suppressNextBlurCommit) return;
    if (!textEditor.hidden) commitText();
  });

  // First paint.
  repaint();

  return {
    canvas,
    frame,
    onCommit(handler) {
      commitHandler = handler;
    },
    fitFrame: () => {
      // Selection divs depend on the canvas display size; resync after
      // the controller resizes the frame.
      syncSelectionDOM();
    },
    setDimensions(width, height) {
      outputW = width;
      outputH = height;
      canvas.width = width;
      canvas.height = height;
      repaint();
    },
    dimsEl,
    sizeEl,
    destroy() {
      document.removeEventListener('keydown', onKey);
      container.replaceChildren();
    },
  };
}

function cursorForTool(tool: Tool): string {
  switch (tool) {
    case 'select':
      return 'default';
    case 'pen':
      return 'crosshair';
    case 'text':
      return 'text';
    default:
      return 'crosshair';
  }
}

function cloneShape(s: Shape): Shape {
  if (s.type === 'pen') return { ...s, points: s.points.map((p) => ({ ...p })) };
  return { ...s };
}

function isUndoCombo(ev: KeyboardEvent): boolean {
  return (
    (ev.metaKey || ev.ctrlKey) &&
    !ev.shiftKey &&
    !ev.altKey &&
    ev.key.toLowerCase() === 'z'
  );
}

function newId(): string {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function normaliseRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): AABB {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    w: Math.abs(x2 - x1),
    h: Math.abs(y2 - y1),
  };
}
