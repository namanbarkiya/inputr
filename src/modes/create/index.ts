/**
 * Mode 2 — Create.
 *
 * Compose a background, a logo, and one line of text onto a canvas at
 * the exact target dimensions. The mode keeps a RenderConfig and reacts
 * to (a) UI changes from the side panel and (b) constraints/format
 * updates pushed by the panel shell. Every change re-renders the
 * canvas and emits a fresh output blob into ctx.onOutput so the panel's
 * footer Download/Copy/Insert buttons always reflect the latest state.
 *
 * Implements Mode#updateConstraints and Mode#updateFormat so the panel
 * can rescale the canvas in place when the user changes the preset or
 * format, without losing any artwork they composed.
 */

import { canvasToBlob, compressToBudget } from '../../lib/compressor';
import { buildFilename } from '../../lib/filename';
import { log } from '../../lib/logger';
import type {
  DetectedConstraints,
  ImageFormat,
} from '../../types/detection';
import type { Mode, ModeContext } from '../../types/modes';

import { defaultConfig, renderCreate, type RenderConfig } from './renderer';
import { renderCreateUI, type CreateUI } from './ui';

const RENDER_DEBOUNCE_MS = 60;

export class CreateMode implements Mode {
  id = 'create' as const;
  label = 'Create';

  private cfg: RenderConfig | null = null;
  private ctx: ModeContext | null = null;
  private ui: CreateUI | null = null;
  private currentBlob: Blob | null = null;
  private currentFilename = 'inputr.png';
  private renderTimer: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private cleanups: Array<() => void> = [];

  async render(ctx: ModeContext): Promise<void> {
    this.ctx = ctx;
    this.cfg = defaultConfig(ctx.constraints.width, ctx.constraints.height);

    const ui = renderCreateUI(ctx.container, this.cfg);
    this.ui = ui;
    this.cleanups.push(() => ui.destroy());

    ui.onChange(() => {
      this.scheduleRender();
    });

    // Re-fit the preview frame whenever the mode container resizes.
    // Side panel can be resized by the user, so the available width
    // changes at runtime.
    this.resizeObserver = new ResizeObserver(() => this.fitFrame());
    this.resizeObserver.observe(ctx.container);
    this.cleanups.push(() => this.resizeObserver?.disconnect());

    // Initial paint — small delay so the container has its final
    // width before fitFrame measures it.
    this.scheduleRender(0);
  }

  async getOutputBlob(): Promise<Blob | null> {
    if (this.currentBlob) return this.currentBlob;
    return this.exportNow();
  }

  destroy(): void {
    if (this.renderTimer !== null) {
      clearTimeout(this.renderTimer);
      this.renderTimer = null;
    }
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    for (const fn of this.cleanups) {
      try {
        fn();
      } catch (err) {
        log.warn('create', 'cleanup error', err);
      }
    }
    this.cleanups = [];
    this.cfg = null;
    this.ui = null;
    this.ctx = null;
    this.currentBlob = null;
  }

  updateConstraints(c: DetectedConstraints): void {
    if (!this.ctx || !this.cfg) return;
    this.ctx.constraints = c;
    this.cfg.width = c.width;
    this.cfg.height = c.height;
    // Text size is stored in pixels but the user thinks of it as a
    // percentage of the short edge (the slider commits as percent).
    // When dims change we keep the visual proportion by recomputing
    // pixels from the latest percentage. Read the percentage from the
    // current pixel value and the OLD dims so we re-derive against
    // the new dims.
    // For simplicity, we just clamp the size so it stays sensible
    // after a dim change rather than perfectly preserving %.
    this.cfg.text.sizePx = Math.max(
      8,
      Math.min(this.cfg.text.sizePx, Math.round(Math.min(c.width, c.height) * 0.4)),
    );
    if (this.ui) {
      this.ui.canvas.width = c.width;
      this.ui.canvas.height = c.height;
      this.ui.syncFromConfig();
    }
    this.fitFrame();
    this.currentBlob = null;
    this.scheduleRender();
  }

  updateFormat(format: ImageFormat, jpegQuality: number): void {
    if (!this.ctx) return;
    this.ctx.format = format;
    this.ctx.jpegQuality = jpegQuality;
    this.currentBlob = null;
    this.scheduleRender();
  }

  private scheduleRender(delay = RENDER_DEBOUNCE_MS): void {
    if (this.renderTimer !== null) clearTimeout(this.renderTimer);
    this.renderTimer = window.setTimeout(() => {
      this.renderTimer = null;
      void this.runRender();
    }, delay);
  }

  private async runRender(): Promise<void> {
    if (!this.ui || !this.cfg || !this.ctx) return;
    try {
      this.fitFrame();
      renderCreate(this.ui.canvas, this.cfg);
      this.ui.dimsEl.textContent = `${this.cfg.width} × ${this.cfg.height} px`;

      const blob = await this.exportNow();
      if (blob) {
        this.ui.sizeEl.textContent = formatBytes(blob.size);
        this.ctx.onOutput(blob, this.currentFilename);
      }
    } catch (err) {
      log.warn('create', 'render failed', err);
    }
  }

  private async exportNow(): Promise<Blob | null> {
    if (!this.ui || !this.ctx) return null;
    const { constraints, format, jpegQuality } = this.ctx;
    try {
      const sourceBlob = await canvasToBlob(
        this.ui.canvas,
        format,
        jpegQuality,
      );
      const finalBlob = await compressToBudget({
        source: sourceBlob,
        constraints,
        format,
        jpegQuality,
      });
      this.currentBlob = finalBlob;
      this.currentFilename = buildFilename({
        constraints,
        format,
      });
      return finalBlob;
    } catch (err) {
      log.warn('create', 'export failed', err);
      return null;
    }
  }

  private fitFrame(): void {
    if (!this.ui || !this.ctx || !this.cfg) return;
    const container = this.ctx.container;
    // Use clientWidth (excludes padding) so we measure the actual
    // available content box.
    const availW = Math.max(120, container.clientWidth);
    // Cap preview height at 40% of viewport so the controls stay
    // visible without scroll on common panel sizes (~600-800px tall).
    const availH = Math.max(160, Math.min(360, window.innerHeight * 0.4));
    const ar = this.cfg.width / this.cfg.height;
    let w = availW;
    let h = w / ar;
    if (h > availH) {
      h = availH;
      w = h * ar;
    }
    this.ui.frame.style.width = `${Math.round(w)}px`;
    this.ui.frame.style.height = `${Math.round(h)}px`;
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}
