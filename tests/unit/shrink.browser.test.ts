import { describe, expect, it } from 'vitest';
import { shrinkPicture } from '../../lib/previews/shrink';

/** A picture like Chrome's captureVisibleTab gives: a JPEG data: URL of a 1920 x 1080 page. */
async function screenshot(): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = 1920;
  canvas.height = 1080;
  const context = canvas.getContext('2d') as CanvasRenderingContext2D;
  context.fillStyle = '#0f766e';
  context.fillRect(0, 0, 1920, 120);
  context.fillStyle = '#f8f9fa';
  context.fillRect(0, 120, 1920, 960);
  return canvas.toDataURL('image/jpeg', 0.85);
}

function size(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((done) => {
    const image = new Image();
    image.onload = () => done({ width: image.naturalWidth, height: image.naturalHeight });
    image.src = dataUrl;
  });
}

describe('shrinkPicture', () => {
  it('makes a small WebP picture, keeping the proportions', async () => {
    const original = await screenshot();
    const small = await shrinkPicture(original, 376);
    expect(small.startsWith('data:image/webp;base64,')).toBe(true);
    expect(await size(small)).toEqual({ width: 376, height: 212 });
    expect(small.length).toBeLessThan(original.length / 4);
  });
});
