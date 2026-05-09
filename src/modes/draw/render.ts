/**
 * Pure canvas painter for Draw mode. Paints a list of shapes onto a
 * canvas at output resolution and provides hit-testing + bounding-box
 * computation for selection.
 *
 * The pen tool produces dense raw point arrays. We smooth them at paint
 * time by drawing quadratic curves between successive midpoints —
 * cheap, dependency-free, and visually close to perfect-freehand for
 * mouse / trackpad input.
 */

import type {
  AABB,
  ArrowShape,
  EllipseShape,
  PenShape,
  RectShape,
  Shape,
  TextShape,
} from './types';

export const DRAW_FONT =
  '"Poppins", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export interface PaintOptions {
  background: string;
}

/** Paint shapes onto the canvas. Selection visuals are rendered in the
 *  DOM (overlay divs) rather than on the canvas itself, so the canvas
 *  bytes are always export-clean — copy/download never include the
 *  selection bbox. */
export function paintAll(
  canvas: HTMLCanvasElement,
  shapes: Shape[],
  width: number,
  height: number,
  opts: PaintOptions,
): void {
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = opts.background;
  ctx.fillRect(0, 0, width, height);

  for (const s of shapes) paintShape(ctx, s);
}

function paintShape(ctx: CanvasRenderingContext2D, s: Shape): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (s.type) {
    case 'pen':
      paintPen(ctx, s);
      return;
    case 'rect':
      paintRect(ctx, s);
      return;
    case 'ellipse':
      paintEllipse(ctx, s);
      return;
    case 'arrow':
      paintArrow(ctx, s);
      return;
    case 'text':
      paintText(ctx, s);
      return;
  }
}

function paintPen(ctx: CanvasRenderingContext2D, s: PenShape): void {
  if (s.points.length < 1) return;
  ctx.strokeStyle = s.stroke;
  ctx.lineWidth = s.strokeWidth;
  ctx.beginPath();
  if (s.points.length === 1) {
    // Single point — draw a dot. Avoids invisible-zero-length stroke.
    const p = s.points[0]!;
    ctx.fillStyle = s.stroke;
    ctx.arc(p.x, p.y, s.strokeWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.moveTo(s.points[0]!.x, s.points[0]!.y);
  // Quadratic-midpoint smoothing: draw a curve from each point to the
  // midpoint of (point, next), with the point itself as the control.
  for (let i = 1; i < s.points.length - 1; i += 1) {
    const p = s.points[i]!;
    const next = s.points[i + 1]!;
    const mx = (p.x + next.x) / 2;
    const my = (p.y + next.y) / 2;
    ctx.quadraticCurveTo(p.x, p.y, mx, my);
  }
  // Final segment to the last raw point.
  const last = s.points[s.points.length - 1]!;
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
}

function paintRect(ctx: CanvasRenderingContext2D, s: RectShape): void {
  if (s.fill) {
    ctx.fillStyle = s.fill;
    ctx.fillRect(s.x, s.y, s.w, s.h);
  }
  if (s.strokeWidth > 0) {
    ctx.strokeStyle = s.stroke;
    ctx.lineWidth = s.strokeWidth;
    ctx.strokeRect(s.x, s.y, s.w, s.h);
  }
}

function paintEllipse(ctx: CanvasRenderingContext2D, s: EllipseShape): void {
  ctx.beginPath();
  ctx.ellipse(s.cx, s.cy, Math.abs(s.rx), Math.abs(s.ry), 0, 0, Math.PI * 2);
  if (s.fill) {
    ctx.fillStyle = s.fill;
    ctx.fill();
  }
  if (s.strokeWidth > 0) {
    ctx.strokeStyle = s.stroke;
    ctx.lineWidth = s.strokeWidth;
    ctx.stroke();
  }
}

function paintArrow(ctx: CanvasRenderingContext2D, s: ArrowShape): void {
  ctx.strokeStyle = s.stroke;
  ctx.fillStyle = s.stroke;
  ctx.lineWidth = s.strokeWidth;

  // Shaft
  ctx.beginPath();
  ctx.moveTo(s.x1, s.y1);
  ctx.lineTo(s.x2, s.y2);
  ctx.stroke();

  // Arrowhead
  const dx = s.x2 - s.x1;
  const dy = s.y2 - s.y1;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;
  const head = Math.max(8, s.strokeWidth * 3.5);
  const angle = Math.atan2(dy, dx);
  const wing = Math.PI / 7;
  const hx1 = s.x2 - head * Math.cos(angle - wing);
  const hy1 = s.y2 - head * Math.sin(angle - wing);
  const hx2 = s.x2 - head * Math.cos(angle + wing);
  const hy2 = s.y2 - head * Math.sin(angle + wing);
  ctx.beginPath();
  ctx.moveTo(s.x2, s.y2);
  ctx.lineTo(hx1, hy1);
  ctx.lineTo(hx2, hy2);
  ctx.closePath();
  ctx.fill();
}

function paintText(ctx: CanvasRenderingContext2D, s: TextShape): void {
  ctx.fillStyle = s.stroke;
  ctx.font = `500 ${s.size}px ${DRAW_FONT}`;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  for (const [i, line] of s.text.split('\n').entries()) {
    ctx.fillText(line, s.x, s.y + i * s.size * 1.2);
  }
}

/** Bounding box of a shape in canvas-pixel coordinates. Returns null
 *  for shapes that have no spatial extent (e.g. an empty text string). */
export function boundingBox(s: Shape): AABB | null {
  switch (s.type) {
    case 'pen':
      return penBounds(s);
    case 'rect': {
      // Normalise so negative w/h still produce a valid rect.
      const x = Math.min(s.x, s.x + s.w);
      const y = Math.min(s.y, s.y + s.h);
      return { x, y, w: Math.abs(s.w), h: Math.abs(s.h) };
    }
    case 'ellipse':
      return {
        x: s.cx - Math.abs(s.rx),
        y: s.cy - Math.abs(s.ry),
        w: Math.abs(s.rx) * 2,
        h: Math.abs(s.ry) * 2,
      };
    case 'arrow':
      return {
        x: Math.min(s.x1, s.x2),
        y: Math.min(s.y1, s.y2),
        w: Math.abs(s.x2 - s.x1),
        h: Math.abs(s.y2 - s.y1),
      };
    case 'text':
      return textBounds(s);
  }
}

function penBounds(s: PenShape): AABB | null {
  if (s.points.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of s.points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

let measureCanvas: HTMLCanvasElement | null = null;

function textBounds(s: TextShape): AABB | null {
  if (s.text.length === 0) return null;
  if (!measureCanvas) measureCanvas = document.createElement('canvas');
  const ctx = measureCanvas.getContext('2d');
  if (!ctx) return null;
  ctx.font = `500 ${s.size}px ${DRAW_FONT}`;
  let maxWidth = 0;
  const lines = s.text.split('\n');
  for (const line of lines) {
    const w = ctx.measureText(line).width;
    if (w > maxWidth) maxWidth = w;
  }
  const lineHeight = s.size * 1.2;
  return {
    x: s.x,
    y: s.y,
    w: maxWidth,
    h: lineHeight * lines.length,
  };
}

/** Returns the topmost (last-drawn) shape under the point, or null. */
export function hitTest(
  shapes: Shape[],
  x: number,
  y: number,
): Shape | null {
  for (let i = shapes.length - 1; i >= 0; i -= 1) {
    const s = shapes[i]!;
    if (hitShape(s, x, y)) return s;
  }
  return null;
}

function hitShape(s: Shape, x: number, y: number): boolean {
  if (s.type === 'pen') return hitPen(s, x, y);
  if (s.type === 'arrow') return hitArrow(s, x, y);
  if (s.type === 'rect') return hitRect(s, x, y);
  if (s.type === 'ellipse') return hitEllipse(s, x, y);
  // Text uses bbox — text glyphs effectively fill their box, no
  // empty-interior surprise.
  const b = boundingBox(s);
  if (!b) return false;
  return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
}

/** Stroke-only rects only hit on the perimeter so dragging from
 *  inside a hollow box can start a marquee. Filled rects hit
 *  everywhere (the fill is solid). */
function hitRect(s: RectShape, x: number, y: number): boolean {
  const b = boundingBox(s);
  if (!b) return false;
  const inside =
    x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  if (!inside) return false;
  if (s.fill !== null) return true;
  // Stroke-only: hit zone is a band of `tolerance` either side of the
  // edge. Inside the band → hit. Inside the inner empty area → miss.
  const tol = Math.max(6, s.strokeWidth * 1.5);
  const innerX = b.x + tol;
  const innerY = b.y + tol;
  const innerR = b.x + b.w - tol;
  const innerB = b.y + b.h - tol;
  const inEmptyInterior =
    x > innerX && x < innerR && y > innerY && y < innerB;
  return !inEmptyInterior;
}

/** Same idea as hitRect but for ellipses: stroke-only ellipses only
 *  hit on the ring. */
function hitEllipse(s: EllipseShape, x: number, y: number): boolean {
  const dx = (x - s.cx) / Math.max(1, Math.abs(s.rx));
  const dy = (y - s.cy) / Math.max(1, Math.abs(s.ry));
  const norm = dx * dx + dy * dy;
  if (norm > 1) return false;
  if (s.fill !== null) return true;
  const tol = Math.max(6, s.strokeWidth * 1.5);
  // Inner radius for the empty-interior test, in "normalised" units.
  const innerRx = Math.max(0, Math.abs(s.rx) - tol);
  const innerRy = Math.max(0, Math.abs(s.ry) - tol);
  if (innerRx <= 0 || innerRy <= 0) return true;
  const idx = (x - s.cx) / innerRx;
  const idy = (y - s.cy) / innerRy;
  const inEmptyInterior = idx * idx + idy * idy < 1;
  return !inEmptyInterior;
}

function hitPen(s: PenShape, x: number, y: number): boolean {
  const tolerance = Math.max(8, s.strokeWidth * 1.5);
  const t2 = tolerance * tolerance;
  for (let i = 0; i < s.points.length - 1; i += 1) {
    const a = s.points[i]!;
    const b = s.points[i + 1]!;
    if (distSqPointToSegment(x, y, a.x, a.y, b.x, b.y) <= t2) return true;
  }
  // Single-point pen strokes (a "dot") still need to be selectable.
  if (s.points.length === 1) {
    const p = s.points[0]!;
    return Math.hypot(x - p.x, y - p.y) <= tolerance;
  }
  return false;
}

function hitArrow(s: ArrowShape, x: number, y: number): boolean {
  const tolerance = Math.max(8, s.strokeWidth * 2);
  return (
    distSqPointToSegment(x, y, s.x1, s.y1, s.x2, s.y2) <=
    tolerance * tolerance
  );
}

function distSqPointToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    return (px - ax) ** 2 + (py - ay) ** 2;
  }
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return (px - cx) ** 2 + (py - cy) ** 2;
}

/** Returns true when the shape's bbox overlaps the given AABB. Used
 *  for marquee-rectangle (rubber-band) multi-selection — any shape
 *  the marquee touches gets included. */
export function shapeIntersectsRect(s: Shape, r: AABB): boolean {
  const b = boundingBox(s);
  if (!b) return false;
  return !(
    b.x + b.w < r.x ||
    b.x > r.x + r.w ||
    b.y + b.h < r.y ||
    b.y > r.y + r.h
  );
}

/** Shift a shape's spatial coords by (dx, dy). Returns a new shape; the
 *  input is not mutated. */
export function translateShape(s: Shape, dx: number, dy: number): Shape {
  switch (s.type) {
    case 'pen':
      return {
        ...s,
        points: s.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
      };
    case 'rect':
      return { ...s, x: s.x + dx, y: s.y + dy };
    case 'ellipse':
      return { ...s, cx: s.cx + dx, cy: s.cy + dy };
    case 'arrow':
      return {
        ...s,
        x1: s.x1 + dx,
        y1: s.y1 + dy,
        x2: s.x2 + dx,
        y2: s.y2 + dy,
      };
    case 'text':
      return { ...s, x: s.x + dx, y: s.y + dy };
  }
}
