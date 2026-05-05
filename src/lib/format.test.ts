import { describe, expect, it } from 'vitest';

import {
  formatBytes,
  formatConstraints,
  formatFormats,
  pickOutputFormat,
} from './format';

describe('formatBytes', () => {
  it('formats bytes', () => {
    expect(formatBytes(900)).toBe('900B');
  });

  it('formats KB', () => {
    expect(formatBytes(2048)).toBe('2KB');
  });

  it('formats MB', () => {
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0MB');
  });
});

describe('formatFormats', () => {
  it('joins format human names', () => {
    expect(formatFormats(['image/png', 'image/jpeg'])).toBe('PNG/JPEG');
  });
});

describe('formatConstraints', () => {
  it('renders the canonical badge string', () => {
    expect(
      formatConstraints({
        width: 1584,
        height: 396,
        acceptedFormats: ['image/png', 'image/jpeg'],
        maxSizeBytes: 8 * 1024 * 1024,
        source: 'known-site',
      }),
    ).toBe('1584 × 396 px • PNG/JPEG • max 8.0MB');
  });
});

describe('pickOutputFormat', () => {
  it('honors explicit user preference when accepted', () => {
    expect(pickOutputFormat('image/jpeg', ['image/png', 'image/jpeg'])).toBe(
      'image/jpeg',
    );
  });

  it('falls back to png when user preference is not accepted', () => {
    expect(pickOutputFormat('image/jpeg', ['image/png'])).toBe('image/png');
  });

  it('returns first format when neither png nor jpeg is accepted', () => {
    expect(pickOutputFormat('auto', ['image/webp'])).toBe('image/webp');
  });
});
