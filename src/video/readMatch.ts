import { findCornerNames, findMoveColumn, findNameSlots } from "../domain/hud";
import { inkPlate, scaledCommand, scaledCrop, scaledPlate } from "../domain/plateImage";
import { characterFromReads } from "../domain/roster";
import { sampleTimes, settleSides, type SettledSides, type SideRead } from "../domain/sides";
import type { MoveRead } from "../domain/strikes";
import type { Rect, RgbaFrame } from "../domain/frame";
import { MOVE_LETTERS, readPlate } from "./ocr";
import { PSM } from "tesseract.js";

const THRESHOLD = 190;
const CORNER_THRESHOLDS = [180, 190];

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

async function readSlot(
  frame: RgbaFrame,
  slot: Rect,
  thresholds: number[],
  crop: boolean,
  mode: PSM,
): Promise<string[]> {
  const scaled = crop ? scaledCrop(frame, slot) : scaledPlate(frame, slot);
  const texts: string[] = [];
  for (const threshold of thresholds) texts.push(await readPlate(inkPlate(scaled, threshold), mode));
  return texts;
}

async function readSide(frame: RgbaFrame, slot: Rect | null, corner: Rect | null): Promise<string | null> {
  const classic = slot ? await readSlot(frame, slot, [THRESHOLD], false, PSM.SINGLE_LINE) : [];
  const classicId = characterFromReads(classic)?.id ?? null;
  if (classicId) return classicId;
  if (!corner) return null;
  const extra = await readSlot(frame, corner, CORNER_THRESHOLDS, true, PSM.SINGLE_BLOCK);
  return characterFromReads(extra)?.id ?? null;
}

async function readColumn(frame: RgbaFrame, slot: Rect | null): Promise<string[]> {
  if (!slot) return [];
  const column = findMoveColumn(frame, slot);
  if (!column) return [];
  const scaled = scaledCommand(frame, column);
  if (!scaled) return [];
  const text = await readPlate(inkPlate(scaled, THRESHOLD), PSM.SINGLE_BLOCK, MOVE_LETTERS);
  return text
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line.length <= 40);
}

async function readMoveLines(frame: RgbaFrame, primary: Rect | null, fallback: Rect | null): Promise<string[]> {
  const lines = await readColumn(frame, primary);
  if (lines.length > 0 || !fallback || primary === fallback) return lines;
  return readColumn(frame, fallback);
}

interface FrameRead {
  side: SideRead;
  moves: MoveRead;
}

async function readFrame(frame: RgbaFrame, time: number): Promise<FrameRead> {
  const slots = findNameSlots(frame);
  const corners = findCornerNames(frame);
  const left = await readSide(frame, slots?.left ?? null, corners.left);
  const right = await readSide(frame, slots?.right ?? null, corners.right);
  return {
    side: { time, left, right },
    moves: {
      time,
      leftCharacter: left,
      rightCharacter: right,
      leftLines: await readMoveLines(frame, slots?.left ?? null, corners.left),
      rightLines: await readMoveLines(frame, slots?.right ?? null, corners.right),
    },
  };
}

export interface MatchFrames {
  settled: SettledSides;
  moves: MoveRead[];
}

export async function readMatchFrames(
  frames: RgbaFrame[],
  onProgress: (done: number, total: number) => void,
): Promise<MatchFrames> {
  const sides: SideRead[] = [];
  const moves: MoveRead[] = [];
  for (let i = 0; i < frames.length; i++) {
    const read = await readFrame(frames[i], i);
    sides.push(read.side);
    moves.push(read.moves);
    onProgress(i + 1, frames.length);
  }
  return { settled: settleSides(sides), moves };
}

export async function readMatchVideo(
  file: Blob,
  onProgress: (done: number, total: number) => void,
): Promise<MatchFrames> {
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
    const sides: SideRead[] = [];
    const moves: MoveRead[] = [];
    for (let i = 0; i < times.length; i++) {
      await seek(video, times[i]);
      const frame = frameFromVideo(video);
      const read = await readFrame(frame, times[i]);
      sides.push(read.side);
      moves.push(read.moves);
      onProgress(i + 1, times.length);
    }
    return { settled: settleSides(sides), moves };
  } finally {
    URL.revokeObjectURL(url);
    video.removeAttribute("src");
    video.load();
  }
}
