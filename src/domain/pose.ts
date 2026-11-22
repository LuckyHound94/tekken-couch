import { patternsFor, type MovePattern } from "./poseBook";
import type { SideSegment } from "./sides";
import type { Strike, StrikeCatalog } from "./strikes";

export interface Vec {
  x: number;
  y: number;
}

export interface BodyPose {
  leftShoulder: Vec;
  rightShoulder: Vec;
  leftElbow: Vec;
  rightElbow: Vec;
  leftWrist: Vec;
  rightWrist: Vec;
  leftHip: Vec;
  rightHip: Vec;
  leftKnee: Vec;
  rightKnee: Vec;
  leftAnkle: Vec;
  rightAnkle: Vec;
}

export interface RawJoint {
  x: number;
  y: number;
  visibility?: number;
}

export type RawBody = { [K in keyof BodyPose]: RawJoint };

export interface PoseSample {
  time: number;
  side: "left" | "right";
  pose: BodyPose;
  forward?: number;
}

const READABLE = new Set(["reina", "alisa"]);

interface ObservedHit {
  time: number;
  limb: string;
  low: boolean;
  high: boolean;
  back: boolean;
  forward: boolean;
  rising: boolean;
  crouched: boolean;
  dash: boolean;
  crouchDash: boolean;
}

interface Shape {
  leadReach: number;
  rearReach: number;
  lean: number;
  kneeY: number;
  handHigh: number;
  kneeHigh: number;
  footForward: number;
  footLow: number;
}

function mid(a: Vec, b: Vec): Vec {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function seen(joint: RawJoint): boolean {
  return joint.visibility == null || joint.visibility >= 0.25;
}

export function normalizeBody(raw: RawBody, facing: 1 | -1): BodyPose | null {
  if (!seen(raw.leftHip) || !seen(raw.rightHip) || !seen(raw.leftShoulder) || !seen(raw.rightShoulder)) return null;
  const hip = mid(raw.leftHip, raw.rightHip);
  const shoulder = mid(raw.leftShoulder, raw.rightShoulder);
  const scale = Math.hypot(shoulder.x - hip.x, shoulder.y - hip.y);
  if (scale < 1e-3) return null;
  const map = (joint: RawJoint): Vec => ({
    x: (facing * (joint.x - hip.x)) / scale,
    y: -(joint.y - hip.y) / scale,
  });
  return {
    leftShoulder: map(raw.leftShoulder),
    rightShoulder: map(raw.rightShoulder),
    leftElbow: map(raw.leftElbow),
    rightElbow: map(raw.rightElbow),
    leftWrist: map(raw.leftWrist),
    rightWrist: map(raw.rightWrist),
    leftHip: map(raw.leftHip),
    rightHip: map(raw.rightHip),
    leftKnee: map(raw.leftKnee),
    rightKnee: map(raw.rightKnee),
    leftAnkle: map(raw.leftAnkle),
    rightAnkle: map(raw.rightAnkle),
  };
}

function shapeOf(pose: BodyPose): Shape {
  const shoulder = mid(pose.leftShoulder, pose.rightShoulder);
  const hip = mid(pose.leftHip, pose.rightHip);
  return {
    leadReach: pose.leftWrist.x - pose.leftShoulder.x,
    rearReach: pose.rightWrist.x - pose.rightShoulder.x,
    lean: shoulder.x - hip.x,
    kneeY: (pose.leftKnee.y + pose.rightKnee.y) / 2,
    handHigh: Math.max(pose.leftWrist.y, pose.rightWrist.y) - shoulder.y,
    kneeHigh: Math.max(pose.leftKnee.y, pose.rightKnee.y),
    footForward: Math.max(pose.leftAnkle.x, pose.rightAnkle.x),
    footLow: Math.min(pose.leftAnkle.y, pose.rightAnkle.y),
  };
}

function wasCrouched(samples: PoseSample[], index: number): boolean {
  const end = samples[index].time;
  for (let i = index - 1; i >= 0; i--) {
    if (end - samples[i].time > 0.35) break;
    if (shapeOf(samples[i].pose).kneeY > -0.32) return true;
  }
  return false;
}

function traveled(samples: PoseSample[], index: number): boolean {
  const now = samples[index].forward;
  if (now == null) return false;
  for (let i = index - 1; i >= 0; i--) {
    if (samples[index].time - samples[i].time > 0.35) break;
    const previous = samples[i].forward;
    if (previous != null && now - previous > 0.04) return true;
  }
  return false;
}

function quietest(samples: PoseSample[], index: number): { pose: BodyPose; shape: Shape } | null {
  const end = samples[index].time;
  let pose = samples[index].pose;
  let shape = shapeOf(pose);
  let found = false;
  for (let i = index - 1; i >= 0; i--) {
    if (end - samples[i].time > 0.45) break;
    const older = shapeOf(samples[i].pose);
    if (!found || older.leadReach + older.rearReach < shape.leadReach + shape.rearReach) {
      pose = samples[i].pose;
      shape = older;
    }
    found = true;
  }
  return found ? { pose, shape } : null;
}

function observeHit(samples: PoseSample[], index: number): ObservedHit | null {
  const baseline = quietest(samples, index);
  if (!baseline) return null;
  const pose = samples[index].pose;
  const previous = baseline.pose;
  const now = shapeOf(pose);
  const before = baseline.shape;
  const arm1 = (now.leadReach > before.leadReach + 0.12 && now.leadReach > 0.42) || pose.leftWrist.y > previous.leftWrist.y + 0.22;
  const arm2 = (now.rearReach > before.rearReach + 0.12 && now.rearReach > 0.38) || pose.rightWrist.y > previous.rightWrist.y + 0.22;
  const leg3 = (pose.leftAnkle.x > previous.leftAnkle.x + 0.12 && pose.leftAnkle.x > 0.32) || (pose.leftKnee.y > previous.leftKnee.y + 0.16 && pose.leftKnee.y > 0);
  const leg4 = (pose.rightAnkle.x > previous.rightAnkle.x + 0.12 && pose.rightAnkle.x > 0.32) || (pose.rightKnee.y > previous.rightKnee.y + 0.16 && pose.rightKnee.y > 0);
  const ids: number[] = [];
  if (arm1) ids.push(1);
  if (arm2) ids.push(2);
  if (leg3) ids.push(3);
  if (leg4) ids.push(4);
  const leanDelta = now.lean - before.lean;
  let limb = ids.join("+");
  if (!limb && Math.abs(leanDelta) > 0.2) limb = "body";
  if (!limb) return null;
  const high = now.handHigh > 0.3 || now.kneeHigh > 0.2;
  const crouched = now.kneeY > -0.32;
  const swept = (leg3 && pose.leftAnkle.y < -0.45 && pose.leftAnkle.x > 0.4) || (leg4 && pose.rightAnkle.y < -0.45 && pose.rightAnkle.x > 0.4);
  const low = swept || ((arm1 || arm2) && crouched && !high);
  const priorCrouch = wasCrouched(samples, index);
  return {
    time: samples[index].time,
    limb,
    low,
    high,
    back: leanDelta < -0.12,
    forward: leanDelta > 0.12 || now.lean > 0.22,
    rising: priorCrouch && !high && !swept && now.kneeY < -0.4,
    crouched,
    dash: traveled(samples, index),
    crouchDash: priorCrouch && (now.handHigh > 0.3 || swept),
  };
}

function hitsOf(samples: PoseSample[]): ObservedHit[] {
  const ordered = [...samples].sort((a, b) => a.time - b.time);
  const hits: ObservedHit[] = [];
  for (let i = 1; i < ordered.length; i++) {
    const hit = observeHit(ordered, i);
    if (!hit) continue;
    const previous = hits[hits.length - 1];
    if (previous && hit.time - previous.time < 0.28 && previous.limb === hit.limb) continue;
    hits.push(hit);
  }
  return hits;
}

function flag(spec: boolean, observed: boolean, weight = 2): number {
  if (spec && observed) return weight;
  if (spec && !observed) return -weight * 2;
  if (!spec && observed) return -weight;
  return 0;
}

function scorePattern(pattern: MovePattern, hits: ObservedHit[]): number | null {
  if (pattern.hits.length !== hits.length) return null;
  let score = 0;
  for (let i = 0; i < hits.length; i++) {
    const spec = pattern.hits[i];
    const observed = hits[i];
    if (spec.limb !== observed.limb) return null;
    score += 10;
    score += flag(spec.low, observed.low);
    score += flag(spec.high, observed.high);
    score += flag(spec.back, observed.back);
    score += flag(spec.forward, observed.forward);
  }
  const first = hits[0];
  score += flag(pattern.rising, first.rising, 3);
  score += flag(pattern.crouched, first.crouched, 3);
  score += flag(pattern.dash, first.dash, 3);
  score += flag(pattern.crouchDash, first.crouchDash, 3);
  if (pattern.stance) score -= 3;
  return score;
}

export function recognizePoseMoves(samples: PoseSample[], patterns: MovePattern[]): Array<{ time: number; move: string }> {
  const hits = hitsOf(samples);
  const named: Array<{ time: number; move: string }> = [];
  let cursor = 0;
  while (cursor < hits.length) {
    let chain = 1;
    while (cursor + chain < hits.length && hits[cursor + chain].time - hits[cursor + chain - 1].time <= 0.4) chain += 1;
    let bestScore = -1;
    let bestLength = 0;
    let bestIndex = Number.POSITIVE_INFINITY;
    let bestMove = "";
    for (let length = chain; length >= 1; length--) {
      const slice = hits.slice(cursor, cursor + length);
      patterns.forEach((pattern, index) => {
        const score = scorePattern(pattern, slice);
        if (score == null || score < 6) return;
        const better =
          score > bestScore ||
          (score === bestScore && length > bestLength) ||
          (score === bestScore && length === bestLength && index < bestIndex);
        if (!better) return;
        bestScore = score;
        bestLength = length;
        bestIndex = index;
        bestMove = pattern.move;
      });
    }
    if (!bestMove) {
      cursor += 1;
      continue;
    }
    named.push({ time: hits[cursor].time, move: bestMove });
    cursor += bestLength;
  }
  return named;
}

function characterOn(segments: SideSegment[], time: number, side: "left" | "right"): string | null {
  for (const segment of segments) {
    if (time < segment.start - 0.5 || time > segment.end + 0.5) continue;
    return side === "left" ? segment.left : segment.right;
  }
  return null;
}

export function poseStrikes(samples: PoseSample[], segments: SideSegment[], catalog: StrikeCatalog): Strike[] {
  const strikes: Strike[] = [];
  for (const side of ["left", "right"] as const) {
    const rows = samples.filter((sample) => sample.side === side).sort((a, b) => a.time - b.time);
    let bucket: PoseSample[] = [];
    let character: string | null = null;
    const flush = () => {
      const allowed = character ? catalog.get(character) : undefined;
      const book = character && allowed ? patternsFor(character).filter((pattern) => allowed.has(pattern.move)) : [];
      if (character && book.length) {
        for (const hit of recognizePoseMoves(bucket, book)) {
          if (strikes.length >= 160) break;
          strikes.push({ time: hit.time, side, characterId: character, move: hit.move });
        }
      }
      bucket = [];
    };
    for (const row of rows) {
      const next = characterOn(segments, row.time, side);
      if (next !== character) {
        flush();
        character = next && READABLE.has(next) ? next : null;
      }
      if (character) bucket.push(row);
    }
    flush();
  }
  return strikes.sort((a, b) => a.time - b.time || (a.side === b.side ? 0 : a.side === "left" ? -1 : 1));
}

export function mergePoseStrikes(named: Strike[], posed: Strike[]): Strike[] {
  const extra = posed.filter(
    (hit) => !named.some((item) => item.side === hit.side && Math.abs(item.time - hit.time) < 0.4),
  );
  return [...named, ...extra].sort((a, b) => a.time - b.time || (a.side === b.side ? 0 : a.side === "left" ? -1 : 1));
}
