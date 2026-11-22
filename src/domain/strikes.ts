import { normalizeMove } from "./notation";
import type { SideSegment } from "./sides";

const NOT_STRIKES = new Set(["dashblock", "kbd", "sidestep", "step-timing", "pause", "Wait", "stand-block", "wavedash"]);

const CHARACTER = /^[a-z0-9-]{1,32}$/;

export interface MoveRead {
  time: number;
  leftCharacter: string | null;
  rightCharacter: string | null;
  leftLines: string[];
  rightLines: string[];
}

export interface Strike {
  time: number;
  side: "left" | "right";
  characterId: string;
  move: string;
}

export interface VideoRead {
  segments: SideSegment[];
  strikes: Strike[];
}

export type StrikeCatalog = ReadonlyMap<string, ReadonlySet<string>>;

export function nameStrike(characterId: string | null, raw: string, catalog: StrikeCatalog): string | null {
  if (!characterId) return null;
  const move = normalizeMove(raw);
  if (!move || NOT_STRIKES.has(move)) return null;
  const book = catalog.get(characterId);
  if (!book || !book.has(move)) return null;
  return move;
}

function chronological(lines: string[], characterId: string | null, catalog: StrikeCatalog): string[] {
  const named: string[] = [];
  for (const line of lines) {
    const move = nameStrike(characterId, line, catalog);
    if (move) named.push(move);
  }
  named.reverse();
  return named;
}

function overlap(prev: string[], next: string[]): number {
  const max = Math.min(prev.length, next.length);
  for (let size = max; size > 0; size--) {
    let same = true;
    for (let i = 0; i < size; i++) {
      if (prev[prev.length - size + i] !== next[i]) {
        same = false;
        break;
      }
    }
    if (same) return size;
  }
  return 0;
}

export function settleStrikes(reads: MoveRead[], catalog: StrikeCatalog): Strike[] {
  const ordered = [...reads].sort((a, b) => a.time - b.time);
  const strikes: Strike[] = [];
  const held = {
    left: { character: null as string | null, window: [] as string[] },
    right: { character: null as string | null, window: [] as string[] },
  };
  for (const read of ordered) {
    for (const side of ["left", "right"] as const) {
      const character = side === "left" ? read.leftCharacter : read.rightCharacter;
      const lines = side === "left" ? read.leftLines : read.rightLines;
      const slot = held[side];
      if (character !== slot.character) {
        slot.character = character;
        slot.window = [];
      }
      if (!character) continue;
      const window = chronological(lines, character, catalog);
      if (window.length === 0) continue;
      const shared = overlap(slot.window, window);
      for (const move of window.slice(shared)) {
        strikes.push({ time: read.time, side, characterId: character, move });
      }
      slot.window = window;
    }
  }
  return strikes;
}

function clock(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 60 * 60) return null;
  return value;
}

function character(value: unknown): string | null | undefined {
  if (value == null) return null;
  if (typeof value !== "string" || !CHARACTER.test(value)) return undefined;
  return value;
}

export function parseVideoRead(value: unknown): VideoRead | null {
  if (!value || typeof value !== "object") return null;
  const record = value as { segments?: unknown; strikes?: unknown };
  if (!Array.isArray(record.segments) || !Array.isArray(record.strikes)) return null;
  if (record.segments.length > 48 || record.strikes.length > 400) return null;
  const segments: SideSegment[] = [];
  for (const item of record.segments) {
    if (!item || typeof item !== "object") return null;
    const row = item as { start?: unknown; end?: unknown; left?: unknown; right?: unknown };
    const start = clock(row.start);
    const end = clock(row.end);
    const left = character(row.left);
    const right = character(row.right);
    if (start == null || end == null || left === undefined || right === undefined) return null;
    segments.push({ start, end, left, right });
  }
  const strikes: Strike[] = [];
  for (const item of record.strikes) {
    if (!item || typeof item !== "object") return null;
    const row = item as { time?: unknown; side?: unknown; characterId?: unknown; move?: unknown };
    const time = clock(row.time);
    const characterId = character(row.characterId);
    if (time == null || characterId == null) return null;
    if (row.side !== "left" && row.side !== "right") return null;
    if (typeof row.move !== "string" || row.move.length < 1 || row.move.length > 48) return null;
    if (/[\s\u0000-\u001f]/.test(row.move)) return null;
    strikes.push({ time, side: row.side, characterId, move: row.move });
  }
  return { segments, strikes };
}
