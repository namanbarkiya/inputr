import { describe, expect, it } from 'vitest';

import { KNOWN_SITES, matchKnownSite } from './known-sites';

describe('matchKnownSite', () => {
  it('matches linkedin.com by host', () => {
    const m = matchKnownSite('https://www.linkedin.com/in/someuser/');
    expect(m?.id).toBe('linkedin');
  });

  it('matches x.com via the twitter alias', () => {
    expect(matchKnownSite('https://x.com/home')?.id).toBe('twitter');
  });

  it('only matches github profile settings, not the home page', () => {
    expect(matchKnownSite('https://github.com/foo/bar')).toBeNull();
    expect(matchKnownSite('https://github.com/settings/profile')?.id).toBe(
      'github',
    );
  });

  it('matches notion subdomains', () => {
    expect(matchKnownSite('https://workspace.notion.site/page')?.id).toBe(
      'notion',
    );
  });

  it('returns null for unknown sites', () => {
    expect(matchKnownSite('https://example.com')).toBeNull();
  });

  it('returns null for malformed urls', () => {
    expect(matchKnownSite('not-a-url')).toBeNull();
  });

  it('every known site has positive dimensions and a non-empty format list', () => {
    for (const site of KNOWN_SITES) {
      expect(site.constraints.width).toBeGreaterThan(0);
      expect(site.constraints.height).toBeGreaterThan(0);
      expect(site.constraints.acceptedFormats.length).toBeGreaterThan(0);
      expect(site.constraints.maxSizeBytes).toBeGreaterThan(0);
    }
  });
});
