/**
 * Hardcoded known-site selectors for v1.
 *
 * When the content script runs on a matching origin, these constraints take
 * precedence over the regex-based generic detector. To add a new site, append
 * an entry here and document it in docs/ADDING_A_SITE.md.
 */

import type { DetectedConstraints } from '../types/detection';

export interface KnownSite {
  id: string;
  /** Hostname suffixes that count as a match (case-insensitive). */
  hosts: string[];
  /** Optional URL path includes; if present, all must match. */
  pathIncludes?: string[];
  /** Optional CSS selectors that must be present on the page to match. */
  domSelectors?: string[];
  /** The constraints to apply when matched. */
  constraints: DetectedConstraints;
}

export const KNOWN_SITES: KnownSite[] = [
  {
    id: 'linkedin',
    hosts: ['linkedin.com'],
    constraints: {
      width: 1584,
      height: 396,
      acceptedFormats: ['image/jpeg', 'image/png'],
      maxSizeBytes: 8 * 1024 * 1024,
      label: 'LinkedIn banner',
      source: 'known-site',
      siteId: 'linkedin',
    },
  },
  {
    id: 'twitter',
    hosts: ['twitter.com', 'x.com'],
    constraints: {
      width: 1500,
      height: 500,
      acceptedFormats: ['image/jpeg', 'image/png'],
      maxSizeBytes: 5 * 1024 * 1024,
      label: 'X / Twitter banner',
      source: 'known-site',
      siteId: 'twitter',
    },
  },
  {
    id: 'github',
    hosts: ['github.com'],
    pathIncludes: ['/settings/profile'],
    constraints: {
      width: 460,
      height: 460,
      acceptedFormats: ['image/jpeg', 'image/png', 'image/gif'],
      maxSizeBytes: 1 * 1024 * 1024,
      label: 'GitHub avatar',
      source: 'known-site',
      siteId: 'github',
    },
  },
  {
    id: 'notion',
    hosts: ['notion.so', 'notion.site'],
    constraints: {
      width: 1500,
      height: 600,
      acceptedFormats: ['image/jpeg', 'image/png'],
      maxSizeBytes: 5 * 1024 * 1024,
      label: 'Notion page cover',
      source: 'known-site',
      siteId: 'notion',
    },
  },
  {
    id: 'youtube',
    hosts: ['youtube.com', 'studio.youtube.com'],
    constraints: {
      width: 150,
      height: 150,
      acceptedFormats: ['image/png', 'image/jpeg', 'image/bmp', 'image/gif'],
      maxSizeBytes: 1 * 1024 * 1024,
      label: 'YouTube branding watermark',
      source: 'known-site',
      siteId: 'youtube',
    },
  },
];

/** Return the matching known site for the given URL, or null. */
export function matchKnownSite(url: string): KnownSite | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname;

  for (const site of KNOWN_SITES) {
    const hostMatches = site.hosts.some(
      (h) => host === h || host.endsWith(`.${h}`),
    );
    if (!hostMatches) continue;
    if (site.pathIncludes && site.pathIncludes.length > 0) {
      const allInPath = site.pathIncludes.every((p) => path.includes(p));
      if (!allInPath) continue;
    }
    return site;
  }
  return null;
}
