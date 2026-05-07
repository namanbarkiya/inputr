/**
 * Shared dimension presets for upload targets.
 *
 * Used by the side-panel detection banner (preset dropdown) and by the
 * standalone Create page (preset picker). Keep this list curated rather
 * than exhaustive: it should cover the 90% of cases the user actually
 * hits, not every social-media variant ever shipped.
 */

export interface SizePreset {
  id: string;
  label: string;
  width: number;
  height: number;
  /** Suggested max file size, in megabytes. */
  sizeMB: number;
}

export const CUSTOM_PRESET_ID = 'custom';

export const SIZE_PRESETS: SizePreset[] = [
  { id: 'linkedin-banner', label: 'LinkedIn banner', width: 1584, height: 396, sizeMB: 8 },
  { id: 'linkedin-post', label: 'LinkedIn post', width: 1200, height: 627, sizeMB: 5 },
  { id: 'profile-pic', label: 'Profile picture (square)', width: 512, height: 512, sizeMB: 2 },
  { id: 'x-banner', label: 'X / Twitter banner', width: 1500, height: 500, sizeMB: 5 },
  { id: 'x-post', label: 'X / Twitter post', width: 1600, height: 900, sizeMB: 5 },
  { id: 'ig-square', label: 'Instagram square', width: 1080, height: 1080, sizeMB: 5 },
  { id: 'ig-story', label: 'Instagram story / reel', width: 1080, height: 1920, sizeMB: 5 },
  { id: 'yt-thumb', label: 'YouTube thumbnail', width: 1280, height: 720, sizeMB: 2 },
  { id: 'yt-banner', label: 'YouTube banner', width: 2560, height: 1440, sizeMB: 6 },
  { id: 'og-share', label: 'Social share (OG)', width: 1200, height: 630, sizeMB: 5 },
];

export function findPreset(width: number, height: number): SizePreset | null {
  return (
    SIZE_PRESETS.find((p) => p.width === width && p.height === height) ?? null
  );
}
