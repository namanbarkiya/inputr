import { describe, expect, it, vi } from 'vitest';

import { renderUploadCropUI } from './ui';

describe('upload-crop UI', () => {
  it('renders the empty-state drop zone and a hidden cropper', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    renderUploadCropUI(root);

    const drop = root.querySelector('.ip-drop');
    expect(drop).not.toBeNull();
    expect(drop?.classList.contains('is-empty')).toBe(true);

    const cropper = root.querySelector<HTMLElement>('.ip-cropper');
    expect(cropper).not.toBeNull();
    expect(cropper?.style.display).toBe('none');

    expect(root.querySelector('img')).not.toBeNull();
    document.body.removeChild(root);
  });

  it('fires onFile when a file is selected', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const ui = renderUploadCropUI(root);
    const handler = vi.fn();
    ui.onFile(handler);

    const input = root.querySelector(
      'input[type=file]',
    ) as HTMLInputElement;
    const blob = new Blob(['x'], { type: 'image/png' });
    const file = new File([blob], 't.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { value: [file] });
    input.dispatchEvent(new Event('change'));
    expect(handler).toHaveBeenCalledWith(file);
    document.body.removeChild(root);
  });

  it('setHasImage(true) reveals the cropper and shrinks the drop zone', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const ui = renderUploadCropUI(root);

    ui.setHasImage(true);

    const drop = root.querySelector('.ip-drop');
    expect(drop?.classList.contains('is-empty')).toBe(false);

    const cropper = root.querySelector<HTMLElement>('.ip-cropper');
    expect(cropper?.style.display).toBe('');

    expect(drop?.querySelector('.ip-drop-line')?.textContent).toBe(
      'Replace image',
    );

    document.body.removeChild(root);
  });

  it('destroy() empties the container', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const ui = renderUploadCropUI(root);
    ui.destroy();
    expect(root.children.length).toBe(0);
    document.body.removeChild(root);
  });
});
