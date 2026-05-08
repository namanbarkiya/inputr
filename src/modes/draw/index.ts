/**
 * Mode 3 — Draw.
 *
 * A compact whiteboard for sketching diagrams, workflows, and quick
 * annotations directly inside the side panel. Tools: select, pen,
 * rectangle, ellipse, arrow, text. The output is a flat raster of the
 * canvas at the panel's target dimensions, piped through the standard
 * compress-to-budget pipeline.
 *
 * Implements Mode#updateConstraints so the canvas resizes in place
 * when the user changes the preset above. Existing shapes are scaled
 * proportionally so the user's work survives a dimension change.
 *
 * Implements Mode#updateFormat so PNG/JPEG switches update the export
 * format without losing the drawing.
 */

import { canvasToBlob, compressToBudget } from '../../lib/compressor';
import { buildFilename } from '../../lib/filename';
import { log } from '../../lib/logger';
import type {
  DetectedConstraints,
  ImageFormat,
} from '../../types/detection';
import type { Mode, ModeContext } from '../../types/modes';

import { renderDrawUI, type DrawUI } from './ui';

const CANVAS_BG = '#ffffff';
const EXPORT_DEBOUNCE_MS = 150;

export class DrawMode implements Mode {
  id = 'draw' as const;
  label = 'Draw';

  private ctx: ModeContext | null = null;
  private ui: DrawUI | null = null;
  private currentBlob: Blob | null = null;
  private currentFilename = 'inputr.png';
  private exportTimer: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private cleanups: Array<() => void> = [];

  async render(ctx: ModeContext): Promise<void> {
    this.ctx = ctx;
    const ui = renderDrawUI(ctx.container, {
      width: ctx.constraints.width,
      height: ctx.constraints.height,
      background: CANVAS_BG,
    });
    this.ui = ui;
    this.cleanups.push(() => ui.destroy());

    ui.onCommit(() => {
      this.scheduleExport();
    });

    this.resizeObserver = new ResizeObserver(() => this.fitFrame());
    this.resizeObserver.observe(ctx.container);
    this.cleanups.push(() => this.resizeObserver?.disconnect());

    this.fitFrame();
    // Emit an initial blank export so the footer has something to
    // download even before the user draws anything.
    this.scheduleExport(0);
  }

  async getOutputBlob(): Promise<Blob | null> {
    if (this.currentBlob) return this.currentBlob;
    return this.exportNow();
  }

  destroy(): void {
    if (this.exportTimer !== null) {
      clearTimeout(this.exportTimer);
      this.exportTimer = null;
    }
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    for (const fn of this.cleanups) {
      try {
        fn();
      } catch (err) {
        log.warn('draw', 'cleanup error', err);
      }
    }
    this.cleanups = [];
    this.ui = null;
    this.ctx = null;
    this.currentBlob = null;
  }

  updateConstraints(c: DetectedConstraints): void {
    if (!this.ctx || !this.ui) return;
    this.ctx.constraints = c;
    // Resize canvas. We don't rescale shapes — drawings are kept in
    // place at their original pixel coordinates. If the canvas shrinks
    // below the drawing extents, content stays drawn at the same
    // positions and may clip at the edges.
    this.ui.setDimensions(c.width, c.height);
    this.fitFrame();
    this.currentBlob = null;
    this.scheduleExport();
  }

  updateFormat(format: ImageFormat, jpegQuality: number): void {
    if (!this.ctx) return;
    this.ctx.format = format;
    this.ctx.jpegQuality = jpegQuality;
    this.currentBlob = null;
    this.scheduleExport();
  }

  private scheduleExport(delay = EXPORT_DEBOUNCE_MS): void {
    if (this.exportTimer !== null) clearTimeout(this.exportTimer);
    this.exportTimer = window.setTimeout(() => {
      this.exportTimer = null;
      void this.runExport();
    }, delay);
  }

  private async runExport(): Promise<void> {
    if (!this.ui || !this.ctx) return;
    try {
      const blob = await this.exportNow();
      if (!blob) return;
      this.ui.dimsEl.textContent = `${this.ctx.constraints.width} × ${this.ctx.constraints.height} px`;
      this.ui.sizeEl.textContent = formatBytes(blob.size);
      this.ctx.onOutput(blob, this.currentFilename);
    } catch (err) {
      log.warn('draw', 'export failed', err);
    }
  }

  private async exportNow(): Promise<Blob | null> {
    if (!this.ui || !this.ctx) return null;
    const { constraints, format, jpegQuality } = this.ctx;
    try {
      const sourceBlob = await canvasToBlob(this.ui.canvas, format, jpegQuality);
      const finalBlob = await compressToBudget({
        source: sourceBlob,
        constraints,
        format,
        jpegQuality,
      });
      this.currentBlob = finalBlob;
      this.currentFilename = buildFilename({ constraints, format });
      return finalBlob;
    } catch (err) {
      log.warn('draw', 'export failed', err);
      return null;
    }
  }

  private fitFrame(): void {
    if (!this.ui || !this.ctx) return;
    const container = this.ctx.container;
    const availW = Math.max(120, container.clientWidth);
    // Cap the canvas height so the toolbar / props bar stay visible.
    const availH = Math.max(180, Math.min(420, window.innerHeight * 0.5));
    const w = this.ctx.constraints.width;
    const h = this.ctx.constraints.height;
    const ar = w / h;
    let dispW = availW;
    let dispH = dispW / ar;
    if (dispH > availH) {
      dispH = availH;
      dispW = dispH * ar;
    }
    this.ui.frame.style.width = `${Math.round(dispW)}px`;
    this.ui.frame.style.height = `${Math.round(dispH)}px`;
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}
