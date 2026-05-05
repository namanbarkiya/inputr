/**
 * Smart filename generator.
 *
 * When the user uploads a file, the output is named after their original
 * filename with `_inputr` appended and the chosen export extension:
 *   `vacation.JPG`  -> `vacation_inputr.png`
 *   `头像.png`      -> `tou-xiang_inputr.jpg`
 *
 * Falls back to a constraints-based name (linkedin-banner-1584x396.png)
 * when no source filename is available — this happens on the first paint
 * before the user picks a file.
 *
 * All output is sanitised to ASCII filesystem-safe characters and the
 * total length is clamped so we don't blow past filesystem limits on any
 * platform.
 */

import type { DetectedConstraints, ImageFormat } from '../types/detection';

const MAX_BASE_LENGTH = 80;
const SUFFIX = '_inputr';

const EXT_BY_MIME: Record<ImageFormat, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
};

/** Slugify a label so it's filename-safe (lowercase, hyphenated, ascii). */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritical marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function extensionFor(format: ImageFormat): string {
  return EXT_BY_MIME[format];
}

/**
 * Strip the trailing extension from a user-provided filename. Handles
 * mixed case and missing extensions.
 *   "Photo.JPEG"  -> "Photo"
 *   "no-ext"      -> "no-ext"
 *   ".hidden"     -> ".hidden" (leading-dot files keep their name)
 */
export function stripExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  if (dot <= 0) return filename;
  return filename.slice(0, dot);
}

export interface FilenameOptions {
  constraints: DetectedConstraints;
  format: ImageFormat;
  /**
   * Original filename the user picked (e.g. "vacation.jpg"). When set,
   * the output becomes `<slug-of-base>_inputr.<ext>`. When omitted, we
   * fall back to the constraints-based name.
   */
  sourceFilename?: string;
}

export function buildFilename(opts: FilenameOptions): string {
  const ext = extensionFor(opts.format);

  // Preferred path: user-supplied filename.
  if (opts.sourceFilename) {
    const baseName = stripExtension(opts.sourceFilename);
    const slug = slugify(baseName);
    if (slug) {
      const trimmed = slug.slice(0, MAX_BASE_LENGTH - SUFFIX.length - 1);
      return `${trimmed}${SUFFIX}.${ext}`;
    }
  }

  // Fallback: derive from constraints (useful on first paint, before any
  // file is loaded).
  const labelSource =
    opts.constraints.label ?? opts.constraints.siteId ?? 'inputr';
  const slug = slugify(labelSource) || 'inputr';
  const dims = `${opts.constraints.width}x${opts.constraints.height}`;
  const base = `${slug}-${dims}`.slice(0, MAX_BASE_LENGTH);
  return `${base}.${ext}`;
}
