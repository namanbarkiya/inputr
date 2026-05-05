import { describe, expect, it } from 'vitest';

import { base64ToBlob, blobToBase64 } from './clipboard';

describe('blob ↔ base64', () => {
  it('round-trips a small binary blob', async () => {
    const original = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    const blob = new Blob([original], { type: 'image/png' });

    const b64 = await blobToBase64(blob);
    const restored = base64ToBlob(b64, 'image/png');

    expect(restored.type).toBe('image/png');
    const buf = new Uint8Array(await restored.arrayBuffer());
    expect(Array.from(buf)).toEqual(Array.from(original));
  });

  it('preserves bytes across a JSON round trip (the chrome.runtime path)', async () => {
    const original = new Uint8Array(256);
    for (let i = 0; i < 256; i += 1) original[i] = i;
    const blob = new Blob([original], { type: 'image/png' });

    const b64 = await blobToBase64(blob);
    const wire = JSON.parse(JSON.stringify({ b64 })).b64 as string;
    const restored = base64ToBlob(wire, 'image/png');

    const buf = new Uint8Array(await restored.arrayBuffer());
    expect(Array.from(buf)).toEqual(Array.from(original));
  });
});
