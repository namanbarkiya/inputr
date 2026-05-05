/**
 * Generic regex-based detection for sites that don't have a hardcoded
 * known-sites entry. Walks the DOM near each `<input type="file">` looking
 * for upload constraints in nearby text.
 */

import type {
  DetectedConstraints,
  ImageFormat,
} from '../types/detection';

// Matches "1584x396", "1584 x 396", "1584×396" — used to extract target
// dimensions from upload helper text. Captures both numbers as groups.
const DIMENSIONS_RE = /(\d{2,5})\s?[x×]\s?(\d{2,5})/i;

// Matches "5 MB", "500 KB", "1.5MB" — used to extract max file size.
const SIZE_RE = /(\d+(?:\.\d+)?)\s?(MB|KB|GB)\b/i;

const ALL_IMAGE_FORMATS: readonly ImageFormat[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
] as const;

/** How many DOM levels up to walk while collecting nearby text. */
const ANCESTOR_WALK_LIMIT = 4;
const TEXT_CHAR_LIMIT = 2000;

/**
 * Returns true if the file input's `accept` attribute admits at least one
 * image format we can produce.
 */
export function inputAcceptsImages(input: HTMLInputElement): boolean {
  const accept = (input.getAttribute('accept') ?? '').toLowerCase().trim();
  if (accept === '' || accept === '*') return true;
  if (accept.includes('image/')) return true;
  if (accept.includes('image/*')) return true;
  return /\.(png|jpe?g|gif|webp|bmp|svg)\b/.test(accept);
}

/** Parse the input's `accept` attribute into image MIME types. */
export function parseAcceptedFormats(
  input: HTMLInputElement,
): ImageFormat[] {
  const accept = (input.getAttribute('accept') ?? '').toLowerCase().trim();
  if (accept === '' || accept === '*' || accept.includes('image/*')) {
    return ['image/jpeg', 'image/png'];
  }

  const found: ImageFormat[] = [];
  for (const fmt of ALL_IMAGE_FORMATS) {
    if (accept.includes(fmt)) found.push(fmt);
  }
  // Extension-based fallbacks
  if (found.length === 0) {
    if (/\.jpe?g\b/.test(accept)) found.push('image/jpeg');
    if (/\.png\b/.test(accept)) found.push('image/png');
    if (/\.webp\b/.test(accept)) found.push('image/webp');
    if (/\.gif\b/.test(accept)) found.push('image/gif');
    if (/\.bmp\b/.test(accept)) found.push('image/bmp');
  }
  return found.length > 0 ? found : ['image/jpeg', 'image/png'];
}

/** Walk up `ANCESTOR_WALK_LIMIT` ancestors and concatenate textContent. */
export function collectNearbyText(input: HTMLInputElement): string {
  const parts: string[] = [];
  let node: HTMLElement | null = input.parentElement;
  let depth = 0;
  while (node && depth < ANCESTOR_WALK_LIMIT) {
    parts.push(node.textContent ?? '');
    node = node.parentElement;
    depth += 1;
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim().slice(0, TEXT_CHAR_LIMIT);
}

/** Extract dimensions like "1584x396" from a chunk of text. */
export function extractDimensions(
  text: string,
): { width: number; height: number } | null {
  const m = DIMENSIONS_RE.exec(text);
  if (!m) return null;
  const w = Number(m[1]);
  const h = Number(m[2]);
  if (!Number.isFinite(w) || !Number.isFinite(h)) return null;
  if (w < 8 || h < 8 || w > 16384 || h > 16384) return null;
  return { width: w, height: h };
}

/** Extract a max file size like "5MB" → bytes. */
export function extractMaxSizeBytes(text: string): number | null {
  const m = SIZE_RE.exec(text);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = m[2]?.toUpperCase();
  const multiplier =
    unit === 'GB' ? 1024 ** 3 : unit === 'MB' ? 1024 ** 2 : 1024;
  return Math.floor(n * multiplier);
}

/**
 * Run the regex detector on a single input. Returns null if nothing usable
 * was found (caller should fall back to manual entry).
 */
export function detectFromInput(
  input: HTMLInputElement,
): DetectedConstraints | null {
  if (!inputAcceptsImages(input)) return null;

  const text = collectNearbyText(input);
  const dims = extractDimensions(text);
  if (!dims) return null;

  return {
    width: dims.width,
    height: dims.height,
    acceptedFormats: parseAcceptedFormats(input),
    maxSizeBytes: extractMaxSizeBytes(text) ?? 10 * 1024 * 1024,
    source: 'regex',
  };
}
