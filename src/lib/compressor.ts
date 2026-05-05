/**
 * Wrapper around `browser-image-compression` that adapts a Blob to the
 * target constraints and returns a compressed Blob.
 *
 * If the input already satisfies the size budget, it is returned unchanged
 * (apart from format conversion, which happens via canvas.toBlob upstream).
 */

import imageCompression from 'browser-image-compression';

import type { DetectedConstraints, ImageFormat } from '../types/detection';

export interface CompressOptions {
  /** Source blob — the canvas.toBlob output, typically. */
  source: Blob;
  /** Target constraints (width/height already enforced upstream). */
  constraints: DetectedConstraints;
  /** Output format MIME (e.g. 'image/jpeg'). */
  format: ImageFormat;
  /** Initial quality for jpeg/webp (1-100). PNG ignores this. */
  jpegQuality?: number;
  /** When true, do compression on the main thread (testing only). */
  noWorker?: boolean;
}

export async function compressToBudget({
  source,
  constraints,
  format,
  jpegQuality = 85,
  noWorker = false,
}: CompressOptions): Promise<Blob> {
  if (source.size <= constraints.maxSizeBytes) return source;

  const file = new File([source], 'temp', { type: format });
  const compressed = await imageCompression(file, {
    maxSizeMB: constraints.maxSizeBytes / (1024 * 1024),
    maxWidthOrHeight: Math.max(constraints.width, constraints.height),
    useWebWorker: !noWorker,
    initialQuality: clamp01(jpegQuality / 100),
    fileType: format,
  });
  return compressed;
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0.85;
  return Math.max(0.1, Math.min(1, n));
}

/**
 * Convert any canvas to a blob in the requested format. Wrapped because
 * canvas.toBlob is callback-based and the rest of the codebase is async.
 */
export function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: ImageFormat,
  qualityPercent = 95,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error(`canvas.toBlob returned null for ${format}`));
          return;
        }
        resolve(blob);
      },
      format,
      qualityPercent / 100,
    );
  });
}
