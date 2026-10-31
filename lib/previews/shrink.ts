/**
 * A picture of a tab (a data: URL, as Chrome's captureVisibleTab gives it) made small: `width` pixels wide at most
 * (the size shown times the screen's density), WebP. Decoded and drawn by the browser itself, off the page: nothing
 * else waits for it.
 */
export async function shrinkPicture(dataUrl: string, width: number): Promise<string> {
  const bitmap = await createImageBitmap(dataUrlToBlob(dataUrl), { resizeWidth: width, resizeQuality: 'medium' });
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No 2D canvas to shrink the picture.');
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  return blobToDataUrl(await canvas.convertToBlob({ type: 'image/webp', quality: 0.75 }));
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header = '', data = ''] = dataUrl.split(',', 2);
  const type = header.slice('data:'.length).split(';')[0] ?? '';
  const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
  return new Blob([bytes], { type });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((done, fail) => {
    const reader = new FileReader();
    reader.onload = () => done(reader.result as string);
    reader.onerror = () => fail(reader.error);
    reader.readAsDataURL(blob);
  });
}
