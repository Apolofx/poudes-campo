export const IMAGE_MAX_DIMENSION = 1600;
export const JPEG_QUALITY = 0.8;

export class ImageProcessingFailed extends Error {
  constructor() {
    super('image processing failed');
    this.name = 'ImageProcessingFailed';
  }
}

export async function captureImage(file: Blob): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new ImageProcessingFailed();
  }
  try {
    const scale = Math.min(1, IMAGE_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new ImageProcessingFailed();
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    if (!blob) throw new ImageProcessingFailed();
    return blob;
  } finally {
    bitmap.close();
  }
}
