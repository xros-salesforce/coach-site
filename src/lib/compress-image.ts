// Browser-only: shrinks a photo before upload. Phone photos are often 3–8 MB; a 1600 px WebP is
// usually 150–400 KB, uploads fast, stays under the server's limits, and loads faster for visitors.

export const MAX_SIDE = 1600;

/** Size that fits within `max` on the longest side, never upscaling. */
export function fitWithin(width: number, height: number, max = MAX_SIDE) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Returns a smaller WebP version of `file`, or the original if it can't be decoded or wouldn't shrink. */
export async function compressImage(file: File, { max = MAX_SIDE, quality = 0.82 } = {}): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file; // e.g. HEIC on browsers that can't decode it; the server will validate the type
  }
  const { width, height } = fitWithin(bitmap.width, bitmap.height, max);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
  if (!blob || blob.type !== "image/webp" || blob.size >= file.size) return file;
  const name = file.name.replace(/\.[^.]+$/, "") + ".webp";
  return new File([blob], name, { type: "image/webp", lastModified: Date.now() });
}
