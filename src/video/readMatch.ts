import { findNameSlots } from "../domain/hud";
import { inkPlate, scaledPlate } from "../domain/plateImage";
import { characterFromReads } from "../domain/roster";
import { sampleTimes, settleSides, type SettledSides, type SideRead } from "../domain/sides";
import type { RgbaFrame } from "../domain/frame";
import { readPlate } from "./ocr";

const THRESHOLD = 190;

function frameFromVideo(video: HTMLVideoElement): RgbaFrame {
  const scale = video.videoWidth > 1920 ? 1920 / video.videoWidth : 1;
  const width = Math.max(1, Math.round(video.videoWidth * scale));
  const height = Math.max(1, Math.round(video.videoHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(video, 0, 0, width, height);
  const image = ctx.getImageData(0, 0, width, height);
  return { width, height, data: image.data };
}

function seek(video: HTMLVideoElement, time: number): Promise<void> {
  const limit = Number.isFinite(video.duration) ? Math.max(0, video.duration - 0.05) : time;
  const target = Math.min(Math.max(0, time), limit);
  if (Math.abs(video.currentTime - target) < 0.04) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const done = () => {
      video.removeEventListener("seeked", done);
      video.removeEventListener("error", fail);
      resolve();
    };
    const fail = () => {
      video.removeEventListener("seeked", done);
      video.removeEventListener("error", fail);
      reject(new Error("seek"));
    };
    video.addEventListener("seeked", done);
    video.addEventListener("error", fail);
    video.currentTime = target;
  });
}

async function videoDuration(video: HTMLVideoElement): Promise<number> {
  if (Number.isFinite(video.duration) && video.duration > 0) return video.duration;
  try {
    await seek(video, 1e101);
  } catch {
    return 0;
  }
  const duration = video.duration;
  await seek(video, 0);
  return Number.isFinite(duration) ? duration : 0;
}

async function readSide(frame: RgbaFrame, slot: { x: number; y: number; width: number; height: number }): Promise<string | null> {
  const scaled = scaledPlate(frame, slot);
  const texts = [await readPlate(inkPlate(scaled, THRESHOLD))];
  return characterFromReads(texts)?.id ?? null;
}

export async function readMatchVideo(
  file: Blob,
  onProgress: (done: number, total: number) => void,
): Promise<SettledSides> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("video"));
    });
    if (video.videoWidth < 16) throw new Error("video");
    const duration = await videoDuration(video);
    const times = sampleTimes(duration);
    const reads: SideRead[] = [];
    for (let i = 0; i < times.length; i++) {
      await seek(video, times[i]);
      const frame = frameFromVideo(video);
      const slots = findNameSlots(frame);
      reads.push({
        time: times[i],
        left: slots ? await readSide(frame, slots.left) : null,
        right: slots ? await readSide(frame, slots.right) : null,
      });
      onProgress(i + 1, times.length);
    }
    return settleSides(reads);
  } finally {
    URL.revokeObjectURL(url);
    video.removeAttribute("src");
    video.load();
  }
}
