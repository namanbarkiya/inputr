/**
 * Integration tests for detection logic against fixture HTML samples.
 *
 * Each fixture mimics the relevant DOM around a real site's upload box.
 * They are deliberately stripped — we don't want to bake in hostile-page
 * complexity, just enough that the regex / known-site path makes a real
 * decision.
 */

import { describe, expect, it } from 'vitest';

import { detectFromInput } from '../../src/lib/detector';
import { matchKnownSite } from '../../src/lib/known-sites';

describe('site detection (integration)', () => {
  it('LinkedIn known-site match by hostname', () => {
    expect(
      matchKnownSite('https://www.linkedin.com/in/me/edit/intro/')?.id,
    ).toBe('linkedin');
  });

  it('GitHub known-site requires the profile path', () => {
    expect(matchKnownSite('https://github.com/explore')).toBeNull();
    expect(matchKnownSite('https://github.com/settings/profile')?.id).toBe(
      'github',
    );
  });

  it('Notion subdomains match', () => {
    expect(matchKnownSite('https://acme.notion.site/somepage')?.id).toBe(
      'notion',
    );
  });

  it('regex detector picks up dimensions from a generic site', () => {
    document.body.innerHTML = `
      <form>
        <p>Upload your cover photo. Recommended 1500x600, max 5MB.</p>
        <input type="file" accept="image/png,image/jpeg" />
      </form>
    `;
    const input = document.querySelector(
      'input[type=file]',
    ) as HTMLInputElement;
    const c = detectFromInput(input);
    expect(c?.width).toBe(1500);
    expect(c?.height).toBe(600);
    expect(c?.maxSizeBytes).toBe(5 * 1024 * 1024);
    document.body.innerHTML = '';
  });

  it('regex detector returns null when nothing useful is nearby', () => {
    document.body.innerHTML = `
      <input type="file" accept="image/*" />
    `;
    const input = document.querySelector(
      'input[type=file]',
    ) as HTMLInputElement;
    expect(detectFromInput(input)).toBeNull();
    document.body.innerHTML = '';
  });
});
