import { describe, expect, it } from 'vitest';

import { autoInsert, findImageFileInputs, tryInsertIntoPage } from './inserter';

describe('tryInsertIntoPage', () => {
  it('sets files and dispatches change/input', () => {
    const input = document.createElement('input');
    input.type = 'file';
    document.body.appendChild(input);
    let changeFired = false;
    let inputFired = false;
    input.addEventListener('change', () => {
      changeFired = true;
    });
    input.addEventListener('input', () => {
      inputFired = true;
    });

    const blob = new Blob(['x'], { type: 'image/png' });
    const ok = tryInsertIntoPage(input, blob, 'test.png');

    expect(ok).toBe(true);
    expect(input.files?.length).toBe(1);
    expect(changeFired).toBe(true);
    expect(inputFired).toBe(true);
    document.body.removeChild(input);
  });

  it('returns false if files setter throws', () => {
    const input = document.createElement('input');
    input.type = 'file';
    Object.defineProperty(input, 'files', {
      set() {
        throw new Error('locked down');
      },
    });
    expect(
      tryInsertIntoPage(input, new Blob(['x']), 'test.png'),
    ).toBe(false);
  });
});

describe('findImageFileInputs', () => {
  it('returns inputs that accept images, skips non-image inputs', () => {
    document.body.innerHTML =
      '<input type="file" accept="application/pdf"/>' +
      '<input type="file" accept="image/png"/>' +
      '<input type="file"/>';
    const found = findImageFileInputs();
    expect(found.length).toBe(2);
    document.body.innerHTML = '';
  });
});

describe('autoInsert', () => {
  it('returns no-input when nothing is found', () => {
    document.body.innerHTML = '<div></div>';
    const out = autoInsert(new Blob(['x']), 'f.png');
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('no-input');
  });

  it('inserts into the first eligible input', () => {
    document.body.innerHTML = '<input type="file" accept="image/*"/>';
    const out = autoInsert(new Blob(['x']), 'f.png');
    expect(out.ok).toBe(true);
    document.body.innerHTML = '';
  });
});
