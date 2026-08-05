import { describe, it, expect, vi, afterEach } from 'vitest';
import { captureImage, IMAGE_MAX_DIMENSION, JPEG_QUALITY } from '@/ui/media/capture-image';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('captureImage', () => {
  it('reduce al lado largo de 1600px y devuelve un JPEG', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({
      width: 4000, height: 3000, close: vi.fn(),
    })));
    const toBlob = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob')
      .mockImplementation(function (cb) { cb?.(new Blob(['jpeg'], { type: 'image/jpeg' })); });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);

    const blob = await captureImage(new Blob(['raw']));

    expect(blob.type).toBe('image/jpeg');
    const canvas = toBlob.mock.instances[0] as unknown as HTMLCanvasElement;
    expect(canvas.width).toBe(1600);
    expect(canvas.height).toBe(1200);
  });

  it('no agranda imágenes menores a 1600px', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({
      width: 800, height: 600, close: vi.fn(),
    })));
    const toBlob = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob')
      .mockImplementation(function (cb) { cb?.(new Blob(['jpeg'], { type: 'image/jpeg' })); });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);

    await captureImage(new Blob(['raw']));

    const canvas = toBlob.mock.instances[0] as unknown as HTMLCanvasElement;
    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(600);
  });

  it('decodifica con orientación EXIF respetada', async () => {
    const bitmap = vi.fn(async (_file: Blob, options: unknown) => {
      expect(options).toEqual({ imageOrientation: 'from-image' });
      return { width: 100, height: 100, close: vi.fn() };
    });
    vi.stubGlobal('createImageBitmap', bitmap);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob')
      .mockImplementation(function (cb) { cb?.(new Blob(['jpeg'], { type: 'image/jpeg' })); });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);

    await captureImage(new Blob(['raw']));
    expect(bitmap).toHaveBeenCalled();
  });
});
