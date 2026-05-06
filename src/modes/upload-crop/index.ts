/**
 * Mode 1 — Upload + Crop.
 *
 * Cropper.js v2 handles the interactive crop. After the user confirms, we
 * read out the crop canvas at the exact target dimensions, encode to the
 * chosen format via canvas.toBlob, and run the result through
 * browser-image-compression if it exceeds the size budget.
 */

import Cropper from 'cropperjs';

import { canvasToBlob, compressToBudget } from '../../lib/compressor';
import { buildFilename } from '../../lib/filename';
import { log } from '../../lib/logger';
import type {
  DetectedConstraints,
  ImageFormat,
} from '../../types/detection';
import type { Mode, ModeContext } from '../../types/modes';

import { renderUploadCropUI, type UploadCropUI } from './ui';

export class UploadCropMode implements Mode {
  id = 'upload-crop' as const;
  label = 'Upload + Crop';

  private cropper: Cropper | null = null;
  private currentBlob: Blob | null = null;
  private ctx: ModeContext | null = null;
  private ui: UploadCropUI | null = null;
  private cleanups: Array<() => void> = [];
  private exportTimer: number | null = null;
  private sourceFilename: string | null = null;

  /** Debounce the (potentially expensive) crop+compress cycle so we
   *  don't run it on every mousemove during a drag. */
  private readonly EXPORT_DEBOUNCE_MS = 200;

  async render(ctx: ModeContext): Promise<void> {
    this.ctx = ctx;

    const ui = renderUploadCropUI(ctx.container);
    this.ui = ui;
    this.cleanups.push(() => ui.destroy());

    ui.onFile(async (file) => {
      try {
        this.sourceFilename = file.name;
        await this.loadImage(file, ui.imgEl);
        ui.setHasImage(true);
        // First export runs immediately so the user sees an output the
        // moment the image lands. Subsequent exports come from the
        // cropper-selection 'change' listener below.
        this.scheduleExport(0);
      } catch (err) {
        log.error('upload-crop', err);
        ctx.onToast('Could not load image', 'error');
      }
    });
  }

  async getOutputBlob(): Promise<Blob | null> {
    return this.currentBlob;
  }

  destroy(): void {
    if (this.exportTimer !== null) {
      clearTimeout(this.exportTimer);
      this.exportTimer = null;
    }
    this.cropper?.destroy();
    this.cropper = null;
    this.currentBlob = null;
    this.ui = null;
    this.sourceFilename = null;
    for (const fn of this.cleanups) {
      try {
        fn();
      } catch (err) {
        log.warn('upload-crop', 'cleanup error', err);
      }
    }
    this.cleanups = [];
  }

  /** Schedule a debounced export. delay=0 runs on the next tick. */
  private scheduleExport(delay = this.EXPORT_DEBOUNCE_MS): void {
    if (this.exportTimer !== null) clearTimeout(this.exportTimer);
    this.exportTimer = window.setTimeout(() => {
      this.exportTimer = null;
      void this.runExport();
    }, delay);
  }

  private async runExport(): Promise<void> {
    if (!this.ctx) return;
    try {
      const target = await this.exportCurrent();
      if (!target) return;
      this.currentBlob = target.blob;
      this.ctx.onOutput(target.blob, target.filename);
      this.ui?.setStatus(
        `${target.filename} (${(target.blob.size / 1024).toFixed(0)} KB)`,
      );
    } catch (err) {
      log.warn('upload-crop', 'auto-export failed', err);
    }
  }

  updateConstraints(c: DetectedConstraints): void {
    if (!this.ctx) return;
    this.ctx.constraints = c;

    // Retarget the live cropper selection to the new aspect ratio. The
    // user keeps their loaded image and rough framing, the rectangle
    // just snaps to the new ratio. If no image is loaded yet, this is
    // a no-op.
    const selection = this.cropper?.getCropperSelection();
    if (selection) {
      const ratio = c.width / c.height;
      // CropperSelection observes both the attribute and the property,
      // so set both to be safe across cropperjs minor versions.
      try {
        (selection as unknown as { aspectRatio: number }).aspectRatio = ratio;
        selection.setAttribute('aspect-ratio', String(ratio));
      } catch (err) {
        log.warn('upload-crop', 'aspect ratio update failed', err);
      }
    }
    // Drop the cached blob and trigger a fresh export so the new
    // dimensions and size budget feed into compressToBudget. Without
    // this, slider-only changes (which don't move the cropper
    // selection) never re-run the compression pipeline.
    this.currentBlob = null;
    if (this.cropper) this.scheduleExport();
  }

  updateFormat(format: ImageFormat, jpegQuality: number): void {
    if (!this.ctx) return;
    this.ctx.format = format;
    this.ctx.jpegQuality = jpegQuality;
    this.currentBlob = null;
    if (this.cropper) this.scheduleExport();
  }

  private async loadImage(file: File, imgEl: HTMLImageElement): Promise<void> {
    const url = URL.createObjectURL(file);
    await new Promise<void>((resolve, reject) => {
      imgEl.onload = () => resolve();
      imgEl.onerror = () => reject(new Error('image load failed'));
      imgEl.src = url;
    });

    this.cropper?.destroy();
    if (!this.ctx) return;
    const c = this.ctx.constraints;
    this.cropper = new Cropper(imgEl, {
      // Cropper v2 reads aspect ratio from the imageSelection.
      template: `
        <cropper-canvas background>
          <cropper-image rotatable scalable skewable translatable></cropper-image>
          <cropper-shade hidden></cropper-shade>
          <cropper-handle action="select" plain></cropper-handle>
          <cropper-selection initial-coverage="0.95" movable resizable
            aspect-ratio="${c.width / c.height}">
            <cropper-grid role="grid" covered></cropper-grid>
            <cropper-crosshair centered></cropper-crosshair>
            <cropper-handle action="move" theme-color="rgba(255,255,255,0.35)"></cropper-handle>
            <cropper-handle action="n-resize"></cropper-handle>
            <cropper-handle action="e-resize"></cropper-handle>
            <cropper-handle action="s-resize"></cropper-handle>
            <cropper-handle action="w-resize"></cropper-handle>
            <cropper-handle action="ne-resize"></cropper-handle>
            <cropper-handle action="nw-resize"></cropper-handle>
            <cropper-handle action="se-resize"></cropper-handle>
            <cropper-handle action="sw-resize"></cropper-handle>
          </cropper-selection>
        </cropper-canvas>
      `,
    });

    // Auto-export on every selection change (debounced). The user no
    // longer needs to click "Apply" — the panel's Download/Copy/Insert
    // buttons always reflect the latest crop.
    const selection = this.cropper.getCropperSelection();
    if (selection) {
      const onSelectionChange = (): void => this.scheduleExport();
      selection.addEventListener('change', onSelectionChange);
      this.cleanups.push(() =>
        selection.removeEventListener('change', onSelectionChange),
      );
    }
  }

  private async exportCurrent(): Promise<{
    blob: Blob;
    filename: string;
  } | null> {
    if (!this.ctx) return null;
    const { constraints: c, format, jpegQuality } = this.ctx;

    const canvas = await this.getOutputCanvas();
    if (!canvas) return null;

    const sourceBlob = await canvasToBlob(canvas, format, jpegQuality);
    const finalBlob = await compressToBudget({
      source: sourceBlob,
      constraints: c,
      format,
      jpegQuality,
    });

    const filename = buildFilename(
      this.sourceFilename
        ? { constraints: c, format, sourceFilename: this.sourceFilename }
        : { constraints: c, format },
    );
    return { blob: finalBlob, filename };
  }

  private async getOutputCanvas(): Promise<HTMLCanvasElement | null> {
    if (!this.cropper || !this.ctx) return null;
    const selection = this.cropper.getCropperSelection();
    if (!selection) return null;
    const c = this.ctx.constraints;
    // Cropper v2 returns the canvas as a Promise.
    return selection.$toCanvas({ width: c.width, height: c.height });
  }
}
