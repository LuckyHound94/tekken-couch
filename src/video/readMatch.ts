import { findCornerNames, findMoveColumn, findNameSlots } from "../domain/hud";
import { inkPlate, scaledCommand, scaledCrop, scaledPlate } from "../domain/plateImage";
import { characterFromReads } from "../domain/roster";
import { sampleTimes, settleSides, type SettledSides, type SideRead } from "../domain/sides";
import type { PoseSample } from "../domain/pose";
import type { MoveRead } from "../domain/strikes";
import { detectPoses } from "./poseTrack";
import type { Rect, RgbaFrame } from "../domain/frame";
import { MOVE_LETTERS, readPlate } from "./ocr";
import { PSM } from "tesseract.js";

const THRESHOLD = 190;
const CORNER_THRESHOLDS = [180, 190];
const POSE_STEP = 0.1;
const POSE_LIMIT = 900;
const POSE_WIDTH = 640;
const POSE_HEIGHT = 360;

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
    .filter((line) => line.length > 0 && line.length <= 40)
    .slice(0, 16);
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
  poses: PoseSample[];
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
  return { settled: settleSides(sides), moves, poses: [] };
}

function poseCount(duration: number): number {
  const span = Math.min(Math.max(0, duration), POSE_STEP * (POSE_LIMIT - 1));
  return Math.max(1, Math.floor(span / POSE_STEP) + 1);
}

async function collectPoses(
  video: HTMLVideoElement,
  duration: number,
  total: number,
  signal: AbortSignal | undefined,
  onProgress: (done: number, total: number) => void,
): Promise<PoseSample[]> {
  const canvas = document.createElement("canvas");
  canvas.width = POSE_WIDTH;
  canvas.height = POSE_HEIGHT;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  const count = poseCount(duration);
  const samples: PoseSample[] = [];
  for (let i = 0; i < count; i++) {
    if (signal?.aborted) break;
    const time = Math.min(i * POSE_STEP, Math.max(0, duration - 0.04));
    await seek(video, time);
    const sourceY = video.videoHeight * 0.2;
    const sourceH = video.videoHeight * 0.8;
    const half = video.videoWidth / 2;
    ctx.drawImage(video, 0, sourceY, half, sourceH, 0, 0, POSE_WIDTH, POSE_HEIGHT);
    const left = await detectPoses(canvas, time, "left");
    if (left) samples.push(left);
    ctx.drawImage(video, half, sourceY, half, sourceH, 0, 0, POSE_WIDTH, POSE_HEIGHT);
    const right = await detectPoses(canvas, time, "right");
    if (right) samples.push(right);
    onProgress(i + 1, total);
  }
  return samples;
}

export async function readMatchVideo(
  file: Blob,
  onProgress: (done: number, total: number) => void,
  signal?: AbortSignal,
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
    const total = poseCount(duration) + times.length;
    const poses = await collectPoses(video, duration, total, signal, onProgress);
    const sides: SideRead[] = [];
    const moves: MoveRead[] = [];
    for (let i = 0; i < times.length; i++) {
      if (signal?.aborted) break;
      await seek(video, times[i]);
      const frame = frameFromVideo(video);
      const read = await readFrame(frame, times[i]);
      sides.push(read.side);
      moves.push(read.moves);
      onProgress(poseCount(duration) + i + 1, total);
    }
    return { settled: settleSides(sides), moves, poses };
  } finally {
    URL.revokeObjectURL(url);
    video.removeAttribute("src");
    video.load();
  }
}
