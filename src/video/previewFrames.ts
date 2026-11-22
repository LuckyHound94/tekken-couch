import type { RgbaFrame } from "../domain/frame";
import { youtubePreviewUrls } from "../domain/youtube";

function frameFromBitmap(bitmap: ImageBitmap): RgbaFrame {
  const scale = bitmap.width > 1920 ? 1920 / bitmap.width : 1;
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bitmap, 0, 0, width, height);
  const image = ctx.getImageData(0, 0, width, height);
  return { width, height, data: image.data };
}

export async function loadYoutubePreviews(id: string, signal: AbortSignal): Promise<RgbaFrame[]> {
  const frames: RgbaFrame[] = [];
  for (const url of youtubePreviewUrls(id)) {
    if (signal.aborted) return frames;
    const response = await fetch(url, { signal, mode: "cors" });
    if (!response.ok) continue;
    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) continue;
    const bitmap = await createImageBitmap(blob);
    if (bitmap.width >= 640 && bitmap.height >= 360) frames.push(frameFromBitmap(bitmap));
    bitmap.close();
  }
  return frames;
}
