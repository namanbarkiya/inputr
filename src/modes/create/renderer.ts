/**
 * Pure canvas renderer for Create mode. No DOM listeners. Takes a config
 * object, paints the canvas. Lets the UI side stay declarative and makes
 * the layering logic unit-testable.
 *
 * Positions are stored as fractional coordinates (0..1 of canvas width
 * and height) so the user's framing stays proportional when canvas dims
 * change. Both the logo and the text are anchored at the centre of the
 * fractional coordinate they own.
 */

export interface BackgroundConfig {
  kind: 'solid' | 'image';
  color: string;
  image: HTMLImageElement | null;
}

export interface TextConfig {
  text: string;
  color: string;
  /** Font size in pixels at output resolution. */
  sizePx: number;
  /** Horizontal centre, 0..1 of canvas width. */
  x: number;
  /** Vertical centre, 0..1 of canvas height. */
  y: number;
}

export interface LogoConfig {
  image: HTMLImageElement | null;
  /** Horizontal centre, 0..1 of canvas width. */
  x: number;
  /** Vertical centre, 0..1 of canvas height. */
  y: number;
  /** Logo width as a fraction of canvas width: 0.05 .. 0.5 */
  widthFraction: number;
}

export interface RenderConfig {
  width: number;
  height: number;
  background: BackgroundConfig;
  text: TextConfig;
  logo: LogoConfig;
}

export const FONT_FAMILY =
  '"Poppins", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** Returns the bounding box of an item in fractional coords (0..1). */
export interface FracRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function renderCreate(
  canvas: HTMLCanvasElement,
  cfg: RenderConfig,
): void {
  if (canvas.width !== cfg.width) canvas.width = cfg.width;
  if (canvas.height !== cfg.height) canvas.height = cfg.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  paintBackground(ctx, cfg);
  if (cfg.text.text.trim() !== '') paintText(ctx, cfg);
  if (cfg.logo.image) paintLogo(ctx, cfg);
}

function paintBackground(
  ctx: CanvasRenderingContext2D,
  cfg: RenderConfig,
): void {
  const { width, height, background } = cfg;
  if (background.kind === 'image' && background.image) {
    drawImageCovering(ctx, background.image, 0, 0, width, height);
    return;
  }
  ctx.fillStyle = background.color;
  ctx.fillRect(0, 0, width, height);
}

function paintText(ctx: CanvasRenderingContext2D, cfg: RenderConfig): void {
  const { text, width, height } = cfg;
  ctx.fillStyle = text.color;
  ctx.font = `600 ${text.sizePx}px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text.text, text.x * width, text.y * height);
}

function paintLogo(ctx: CanvasRenderingContext2D, cfg: RenderConfig): void {
  const { logo, width, height } = cfg;
  if (!logo.image) return;
  const targetW = clamp(logo.widthFraction, 0.05, 0.5) * width;
  const aspect =
    logo.image.naturalHeight / Math.max(1, logo.image.naturalWidth);
  const targetH = targetW * aspect;
  const cx = logo.x * width;
  const cy = logo.y * height;
  ctx.drawImage(logo.image, cx - targetW / 2, cy - targetH / 2, targetW, targetH);
}

/** Bounding box of the logo in fractional coords. Null if no image. */
export function logoBounds(cfg: RenderConfig): FracRect | null {
  const { logo, width, height } = cfg;
  if (!logo.image) return null;
  const w = clamp(logo.widthFraction, 0.05, 0.5);
  const aspect =
    logo.image.naturalHeight / Math.max(1, logo.image.naturalWidth);
  // pixel height = (w * width) * aspect; convert back to fraction-of-height
  const h = (w * width * aspect) / height;
  return {
    x: logo.x - w / 2,
    y: logo.y - h / 2,
    w,
    h,
  };
}

/** Bounding box of the text in fractional coords. Null if empty.
 *
 * Uses an offscreen 2d context to measure the rendered text width with
 * the current font and size. Required because we need the box for the
 * selection rectangle in the editor overlay, not just for painting. */
export function textBounds(cfg: RenderConfig): FracRect | null {
  if (cfg.text.text.trim() === '') return null;
  const measureCtx = getMeasureContext();
  measureCtx.font = `600 ${cfg.text.sizePx}px ${FONT_FAMILY}`;
  const m = measureCtx.measureText(cfg.text.text);
  const wPx = m.width;
  // Height: actual ascent + descent gives true cap-to-baseline; pad
  // by 20% so the selection rect doesn't clip glyph tails.
  const ascent = m.actualBoundingBoxAscent || cfg.text.sizePx * 0.7;
  const descent = m.actualBoundingBoxDescent || cfg.text.sizePx * 0.3;
  const hPx = (ascent + descent) * 1.1;
  const w = wPx / cfg.width;
  const h = hPx / cfg.height;
  return {
    x: cfg.text.x - w / 2,
    y: cfg.text.y - h / 2,
    w,
    h,
  };
}

/** Hit-test fractional coords against logo and text. Logo wins on
 *  overlap because it's drawn on top. */
export function hitTest(
  cfg: RenderConfig,
  fx: number,
  fy: number,
): 'logo' | 'text' | null {
  const lb = logoBounds(cfg);
  if (lb && pointInRect(fx, fy, lb)) return 'logo';
  const tb = textBounds(cfg);
  if (tb && pointInRect(fx, fy, tb)) return 'text';
  return null;
}

function pointInRect(fx: number, fy: number, r: FracRect): boolean {
  return fx >= r.x && fx <= r.x + r.w && fy >= r.y && fy <= r.y + r.h;
}

function drawImageCovering(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
): void {
  const srcAspect = img.naturalWidth / Math.max(1, img.naturalHeight);
  const dstAspect = dw / Math.max(1, dh);
  let sx = 0;
  let sy = 0;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;
  if (srcAspect > dstAspect) {
    sw = img.naturalHeight * dstAspect;
    sx = (img.naturalWidth - sw) / 2;
  } else {
    sh = img.naturalWidth / dstAspect;
    sy = (img.naturalHeight - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

let cachedMeasureContext: CanvasRenderingContext2D | null = null;

function getMeasureContext(): CanvasRenderingContext2D {
  if (cachedMeasureContext) return cachedMeasureContext;
  const c = document.createElement('canvas');
  c.width = 1;
  c.height = 1;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('measure context unavailable');
  cachedMeasureContext = ctx;
  return ctx;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function defaultConfig(width: number, height: number): RenderConfig {
  const textSize = Math.max(28, Math.round(Math.min(width, height) * 0.09));
  return {
    width,
    height,
    background: {
      kind: 'solid',
      color: '#0f0c08',
      image: null,
    },
    text: {
      text: '',
      color: '#f6f4f0',
      sizePx: textSize,
      x: 0.5,
      y: 0.5,
    },
    logo: { image: null, x: 0.85, y: 0.85, widthFraction: 0.14 },
  };
}
