/**
 * Format helpers for surfacing constraint info in the UI.
 */

import type { DetectedConstraints, ImageFormat } from '../types/detection';

const HUMAN_NAME: Record<ImageFormat, string> = {
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
  'image/gif': 'GIF',
  'image/bmp': 'BMP',
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)}MB`;
}

export function formatFormats(formats: ImageFormat[]): string {
  return formats.map((f) => HUMAN_NAME[f]).join('/');
}

export function formatConstraints(c: DetectedConstraints): string {
  return `${c.width} × ${c.height} px • ${formatFormats(c.acceptedFormats)} • max ${formatBytes(c.maxSizeBytes)}`;
}

/**
 * Pick a sensible output format given the user's preferred default and the
 * accepted formats reported on the page.
 */
export function pickOutputFormat(
  preferred: 'image/jpeg' | 'image/png' | 'auto',
  accepted: ImageFormat[],
): ImageFormat {
  if (preferred !== 'auto' && accepted.includes(preferred)) return preferred;
  // Prefer PNG for square/transparent-friendly outputs, JPEG otherwise.
  if (accepted.includes('image/png')) return 'image/png';
  if (accepted.includes('image/jpeg')) return 'image/jpeg';
  return accepted[0] ?? 'image/png';
}
