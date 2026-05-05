import { describe, expect, it } from 'vitest';

import type { DetectedConstraints } from '../types/detection';

import {
  buildFilename,
  extensionFor,
  slugify,
  stripExtension,
} from './filename';

const constraints: DetectedConstraints = {
  width: 1584,
  height: 396,
  acceptedFormats: ['image/png', 'image/jpeg'],
  maxSizeBytes: 8 * 1024 * 1024,
  label: 'LinkedIn banner',
  siteId: 'linkedin',
  source: 'known-site',
};

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('LinkedIn Banner')).toBe('linkedin-banner');
  });

  it('strips unicode diacritics', () => {
    expect(slugify('Naïve Café')).toBe('naive-cafe');
  });

  it('clamps very long input', () => {
    const long = 'a'.repeat(200);
    expect(slugify(long).length).toBeLessThanOrEqual(60);
  });

  it('returns empty string for non-alphanumerics only', () => {
    expect(slugify('!!! ???')).toBe('');
  });
});

describe('stripExtension', () => {
  it('removes the trailing extension', () => {
    expect(stripExtension('vacation.jpg')).toBe('vacation');
    expect(stripExtension('Photo.JPEG')).toBe('Photo');
    expect(stripExtension('a.b.c.png')).toBe('a.b.c');
  });

  it('returns the input when no extension is present', () => {
    expect(stripExtension('no-ext')).toBe('no-ext');
  });

  it('preserves leading-dot files', () => {
    expect(stripExtension('.hidden')).toBe('.hidden');
  });
});

describe('extensionFor', () => {
  it('maps jpeg → jpg', () => {
    expect(extensionFor('image/jpeg')).toBe('jpg');
  });

  it('maps png → png', () => {
    expect(extensionFor('image/png')).toBe('png');
  });
});

describe('buildFilename', () => {
  it('uses the user-supplied filename with _inputr suffix', () => {
    expect(
      buildFilename({
        constraints,
        format: 'image/png',
        sourceFilename: 'vacation.JPG',
      }),
    ).toBe('vacation_inputr.png');
  });

  it('slugifies non-ascii source filenames', () => {
    expect(
      buildFilename({
        constraints,
        format: 'image/jpeg',
        sourceFilename: 'Naïve Café.heic',
      }),
    ).toBe('naive-cafe_inputr.jpg');
  });

  it('falls back to constraints-based name when no source filename', () => {
    expect(buildFilename({ constraints, format: 'image/png' })).toBe(
      'linkedin-banner-1584x396.png',
    );
  });

  it('falls back to inputr when no label and no siteId', () => {
    const minimal: DetectedConstraints = {
      ...constraints,
      label: undefined,
      siteId: undefined,
    };
    expect(buildFilename({ constraints: minimal, format: 'image/jpeg' })).toBe(
      'inputr-1584x396.jpg',
    );
  });

  it('falls back to constraints when source filename is non-alphanumeric', () => {
    expect(
      buildFilename({
        constraints,
        format: 'image/png',
        sourceFilename: '!!!.png',
      }),
    ).toBe('linkedin-banner-1584x396.png');
  });
});
