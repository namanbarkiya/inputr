import { describe, expect, it, vi } from 'vitest';

import type { DetectedConstraints } from '../types/detection';

vi.mock('browser-image-compression', () => ({
  default: vi.fn(async (file: File) => {
    // Pretend we compressed by halving the size
    const trimmed = await file.slice(0, Math.floor(file.size / 2));
    return new File([trimmed], file.name, { type: file.type });
  }),
}));

import { canvasToBlob, compressToBudget } from './compressor';

const constraints: DetectedConstraints = {
  width: 1000,
  height: 1000,
  acceptedFormats: ['image/jpeg'],
  maxSizeBytes: 100,
  source: 'manual',
};

describe('compressToBudget', () => {
  it('returns the source unchanged when already under budget', async () => {
    const blob = new Blob(['x'.repeat(50)], { type: 'image/jpeg' });
    const out = await compressToBudget({
      source: blob,
      constraints,
      format: 'image/jpeg',
      noWorker: true,
    });
    expect(out).toBe(blob);
  });

  it('runs compression when over budget', async () => {
    const blob = new Blob(['x'.repeat(500)], { type: 'image/jpeg' });
    const out = await compressToBudget({
      source: blob,
      constraints,
      format: 'image/jpeg',
      noWorker: true,
    });
    expect(out.size).toBeLessThan(blob.size);
  });

  it('clamps absurd jpegQuality values', async () => {
    const blob = new Blob(['x'.repeat(200)], { type: 'image/jpeg' });
    await expect(
      compressToBudget({
        source: blob,
        constraints,
        format: 'image/jpeg',
        jpegQuality: 9000,
        noWorker: true,
      }),
    ).resolves.toBeInstanceOf(File);
  });
});

describe('canvasToBlob', () => {
  it('rejects when the canvas returns null', async () => {
    const fakeCanvas = {
      toBlob: (cb: BlobCallback) => cb(null),
    } as unknown as HTMLCanvasElement;
    await expect(canvasToBlob(fakeCanvas, 'image/png')).rejects.toThrow();
  });

  it('resolves with the produced blob', async () => {
    const blob = new Blob(['hello'], { type: 'image/png' });
    const fakeCanvas = {
      toBlob: (cb: BlobCallback) => cb(blob),
    } as unknown as HTMLCanvasElement;
    await expect(canvasToBlob(fakeCanvas, 'image/png')).resolves.toBe(blob);
  });
});
