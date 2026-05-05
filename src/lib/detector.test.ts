import { describe, expect, it } from 'vitest';

import {
  collectNearbyText,
  detectFromInput,
  extractDimensions,
  extractMaxSizeBytes,
  inputAcceptsImages,
  parseAcceptedFormats,
} from './detector';

function makeInput(attrs: Record<string, string> = {}): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'file';
  for (const [k, v] of Object.entries(attrs)) input.setAttribute(k, v);
  return input;
}

describe('extractDimensions', () => {
  it('parses 1584x396', () => {
    expect(extractDimensions('Recommended size: 1584x396 px')).toEqual({
      width: 1584,
      height: 396,
    });
  });

  it('parses 1500 × 500 with unicode times', () => {
    expect(extractDimensions('Banner: 1500 × 500')).toEqual({
      width: 1500,
      height: 500,
    });
  });

  it('rejects out-of-range dimensions', () => {
    expect(extractDimensions('1x1 pixel')).toBeNull();
    expect(extractDimensions('99999x99999')).toBeNull();
  });

  it('returns null when no dimensions present', () => {
    expect(extractDimensions('upload an image')).toBeNull();
  });
});

describe('extractMaxSizeBytes', () => {
  it('parses MB', () => {
    expect(extractMaxSizeBytes('Max 5MB')).toBe(5 * 1024 * 1024);
  });

  it('parses KB', () => {
    expect(extractMaxSizeBytes('500 KB')).toBe(500 * 1024);
  });

  it('parses fractional MB', () => {
    expect(extractMaxSizeBytes('1.5 MB')).toBe(Math.floor(1.5 * 1024 * 1024));
  });

  it('returns null when nothing found', () => {
    expect(extractMaxSizeBytes('any size')).toBeNull();
  });
});

describe('inputAcceptsImages', () => {
  it('accepts wildcard accept', () => {
    expect(inputAcceptsImages(makeInput())).toBe(true);
    expect(inputAcceptsImages(makeInput({ accept: '*' }))).toBe(true);
  });

  it('accepts image MIME', () => {
    expect(inputAcceptsImages(makeInput({ accept: 'image/png' }))).toBe(true);
  });

  it('accepts image extensions', () => {
    expect(inputAcceptsImages(makeInput({ accept: '.jpg,.png' }))).toBe(true);
  });

  it('rejects non-image accepts', () => {
    expect(inputAcceptsImages(makeInput({ accept: 'application/pdf' }))).toBe(
      false,
    );
  });
});

describe('parseAcceptedFormats', () => {
  it('returns jpeg+png for wildcards', () => {
    expect(parseAcceptedFormats(makeInput())).toEqual([
      'image/jpeg',
      'image/png',
    ]);
  });

  it('parses explicit MIMEs', () => {
    expect(
      parseAcceptedFormats(makeInput({ accept: 'image/png,image/webp' })),
    ).toContain('image/webp');
  });

  it('falls back to extension parsing', () => {
    expect(parseAcceptedFormats(makeInput({ accept: '.gif' }))).toContain(
      'image/gif',
    );
  });
});

describe('detectFromInput end-to-end', () => {
  it('finds dimensions in the parent label text', () => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML =
      '<label>Banner — recommended 1584x396, max 8MB</label><input type="file" accept="image/png,image/jpeg" />';
    document.body.appendChild(wrapper);

    const input = wrapper.querySelector(
      'input[type=file]',
    ) as HTMLInputElement;
    const result = detectFromInput(input);

    expect(result).not.toBeNull();
    expect(result?.width).toBe(1584);
    expect(result?.height).toBe(396);
    expect(result?.maxSizeBytes).toBe(8 * 1024 * 1024);
    expect(result?.source).toBe('regex');

    document.body.removeChild(wrapper);
  });

  it('returns null when the input does not accept images', () => {
    const input = makeInput({ accept: 'application/pdf' });
    document.body.appendChild(input);
    expect(detectFromInput(input)).toBeNull();
    document.body.removeChild(input);
  });

  it('returns null when no dimensions are found nearby', () => {
    const input = makeInput({ accept: 'image/*' });
    document.body.appendChild(input);
    expect(detectFromInput(input)).toBeNull();
    document.body.removeChild(input);
  });
});

describe('collectNearbyText', () => {
  it('walks up the DOM a few levels', () => {
    const root = document.createElement('div');
    root.innerHTML = '<div>outer 1500x500</div><div><input type="file"/></div>';
    document.body.appendChild(root);
    const input = root.querySelector('input') as HTMLInputElement;
    expect(collectNearbyText(input)).toContain('1500x500');
    document.body.removeChild(root);
  });
});
