import type { SideSegment } from "./sides";
import type { Strike } from "./strikes";

export const SEEN_STRIKE = "seen-strike";

export interface MotionFrame {
  time: number;
  width: number;
  height: number;
  gray: Uint8Array;
}

export interface AnimatedStrike {
  time: number;
  side: "left" | "right";
}

const MAX_GAP = 0.28;
const MIN_ENERGY = 14;
const COOLDOWN = 0.45;

interface Sample {
  time: number;
  left: number;
  right: number;
}

function bounds(width: number, height: number, side: "left" | "right") {
  const y0 = Math.min(height, Math.max(0, Math.floor(height * 0.18)));
  const y1 = Math.min(height, Math.max(y0, Math.ceil(height * 0.9)));
  const x0 = side === "left" ? Math.floor(width * 0.05) : Math.floor(width * 0.52);
  const x1 = side === "left" ? Math.ceil(width * 0.48) : Math.ceil(width * 0.95);
  return { x0, y0, x1: Math.min(width, Math.max(x0, x1)), y1 };
}

function energy(prev: MotionFrame, next: MotionFrame, side: "left" | "right"): number {
  const { x0, y0, x1, y1 } = bounds(next.width, next.height, side);
  let sum = 0;
  let count = 0;
  const width = next.width;
  for (let y = y0; y < y1; y++) {
    const row = y * width;
    for (let x = x0; x < x1; x++) {
      const i = row + x;
      const delta = next.gray[i] - prev.gray[i];
      sum += delta < 0 ? -delta : delta;
      count += 1;
    }
  }
  if (count === 0) return 0;
  return sum / count;
}

function samples(frames: MotionFrame[]): Sample[] {
  const ordered = [...frames].sort((a, b) => a.time - b.time);
  const out: Sample[] = [];
  for (let i = 1; i < ordered.length; i++) {
    const prev = ordered[i - 1];
    const next = ordered[i];
    const gap = next.time - prev.time;
    if (gap <= 0 || gap > MAX_GAP) continue;
    if (prev.width !== next.width || prev.height !== next.height) continue;
    if (prev.gray.length !== prev.width * prev.height || next.gray.length !== next.width * next.height) continue;
    out.push({ time: next.time, left: energy(prev, next, "left"), right: energy(prev, next, "right") });
  }
  return out;
}

function sidePeaks(rows: Sample[], side: "left" | "right"): AnimatedStrike[] {
  const other = side === "left" ? "right" : "left";
  const hits: AnimatedStrike[] = [];
  let blockedUntil = -1;
  for (let i = 1; i < rows.length - 1; i++) {
    const row = rows[i];
    if (row.time < blockedUntil) continue;
    if (row.time - rows[i - 1].time > MAX_GAP || rows[i + 1].time - row.time > MAX_GAP) continue;
    const value = row[side];
    if (value < MIN_ENERGY) continue;
    if (value <= rows[i - 1][side] || value <= rows[i + 1][side]) continue;
    if (rows[i - 1][side] > value * 0.75) continue;
    if (row[other] > value * 0.6) continue;
    let fell = false;
    for (let j = i + 1; j < rows.length && rows[j].time - row.time <= 0.4; j++) {
      if (rows[j].time - rows[j - 1].time > MAX_GAP) break;
      if (rows[j][side] < value * 0.55) {
        fell = true;
        break;
      }
    }
    if (!fell) continue;
    hits.push({ time: row.time, side });
    blockedUntil = row.time + COOLDOWN;
  }
  return hits;
}

export function findAnimatedStrikes(frames: MotionFrame[]): AnimatedStrike[] {
  const rows = samples(frames);
  return [...sidePeaks(rows, "left"), ...sidePeaks(rows, "right")].sort((a, b) => a.time - b.time);
}

function characterOn(segments: SideSegment[], time: number, side: "left" | "right"): string | null {
  for (const segment of segments) {
    if (time < segment.start - 0.5 || time > segment.end + 0.5) continue;
    return side === "left" ? segment.left : segment.right;
  }
  return null;
}

export function attachAnimatedStrikes(named: Strike[], hits: AnimatedStrike[], segments: SideSegment[]): Strike[] {
  const extra: Strike[] = [];
  for (const hit of hits) {
    if (extra.length >= 160) break;
    const characterId = characterOn(segments, hit.time, hit.side);
    if (!characterId) continue;
    const already = named.some((item) => item.side === hit.side && Math.abs(item.time - hit.time) < 0.4);
    if (already) continue;
    extra.push({ time: hit.time, side: hit.side, characterId, move: SEEN_STRIKE });
  }
  return [...named, ...extra].sort((a, b) => a.time - b.time || (a.side === b.side ? 0 : a.side === "left" ? -1 : 1));
}
