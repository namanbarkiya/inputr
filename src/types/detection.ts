/**
 * Detection types — describe what the content script reports about a page's
 * file upload constraints. Stored in chrome.storage.local keyed by tab id.
 */

export type ImageFormat = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'image/bmp';

export interface DetectedConstraints {
  /** Target output width in pixels. */
  width: number;
  /** Target output height in pixels. */
  height: number;
  /** Accepted output MIME types, narrowed to the formats this extension supports. */
  acceptedFormats: ImageFormat[];
  /** Maximum file size in bytes. */
  maxSizeBytes: number;
  /** Human-friendly label, e.g. "LinkedIn banner". */
  label?: string;
  /** Source of the detection — used to show provenance and help debugging. */
  source: 'known-site' | 'regex' | 'manual';
  /** Site identifier for known sites (e.g., 'linkedin'). */
  siteId?: string;
}

export interface DetectionResult {
  /** Whether anything was detected on the page. */
  detected: boolean;
  /** The constraints, if detection succeeded. */
  constraints?: DetectedConstraints;
  /** URL of the page where detection ran. */
  url: string;
  /** Origin of the page, useful for known-site lookups. */
  origin: string;
  /** Timestamp of detection. */
  detectedAt: number;
  /** Number of file inputs found on the page. */
  inputCount: number;
}

/** Default constraints used when nothing is detected. */
export const DEFAULT_CONSTRAINTS: DetectedConstraints = {
  width: 1200,
  height: 630,
  acceptedFormats: ['image/png', 'image/jpeg'],
  maxSizeBytes: 10 * 1024 * 1024,
  source: 'manual',
};
