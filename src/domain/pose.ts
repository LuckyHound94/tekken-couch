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
}

const READABLE = new Set(["reina", "alisa"]);

const FAMILIES: Record<string, Record<string, string>> = {
  reina: {
    electric: "f,n,d,df:2",
    hellsweep: "hellsweep",
    hopkick: "hopkick",
    df2: "df+2",
    df1: "df+1",
    straight: "2",
    jab: "1",
  },
  alisa: {
    hopkick: "hopkick",
    df2: "df+2",
    df1: "df+1",
    straight: "2",
    jab: "1",
  },
};

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
  return joint.visibility == null || joint.visibility >= 0.4;
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

function offer(family: string, book: Record<string, string>, allowed: ReadonlySet<string>): string | null {
  const move = book[family];
  if (!move || !allowed.has(move)) return null;
  return move;
}

function crouchedBefore(
  samples: Array<{ time: number; pose: BodyPose }>,
  index: number,
): boolean {
  const end = samples[index].time;
  for (let i = index - 1; i >= 0; i--) {
    if (end - samples[i].time > 0.45) break;
    if (shapeOf(samples[i].pose).kneeY > -0.32) return true;
  }
  return false;
}

function classify(
  samples: Array<{ time: number; pose: BodyPose }>,
  index: number,
  book: Record<string, string>,
  allowed: ReadonlySet<string>,
): string | null {
  if (index === 0 || samples[index].time - samples[index - 1].time > 0.28) return null;
  const now = shapeOf(samples[index].pose);
  const prev = shapeOf(samples[index - 1].pose);
  const risingLead = now.leadReach > prev.leadReach + 0.12;
  const risingRear = now.rearReach > prev.rearReach + 0.12;
  const risingKnee = now.kneeHigh > prev.kneeHigh + 0.12;
  const risingHand = now.handHigh > prev.handHigh + 0.12;
  const risingFoot = now.footForward > prev.footForward + 0.12;
  if (crouchedBefore(samples, index) && risingHand && now.handHigh > 0.45 && now.footForward < 0.85) {
    return offer("electric", book, allowed);
  }
  if (crouchedBefore(samples, index) && risingFoot && now.footForward > 0.55 && now.footLow < -0.3 && now.handHigh < 0.2) {
    return offer("hellsweep", book, allowed);
  }
  if (risingKnee && now.kneeHigh > 0.35) return offer("hopkick", book, allowed);
  if (risingRear && now.lean > 0.22 && now.rearReach > 0.7 && now.kneeHigh < 0.2) return offer("df2", book, allowed);
  if (risingLead && now.lean > 0.22 && now.leadReach > 0.5 && now.rearReach < 0.4 && now.kneeY < -0.35 && now.kneeHigh < 0.2) {
    return offer("df1", book, allowed);
  }
  if (
    risingRear &&
    now.rearReach > 0.75 &&
    now.leadReach < 0.45 &&
    now.lean < 0.18 &&
    now.kneeY < -0.4 &&
    now.kneeHigh < 0.2 &&
    now.handHigh < 0.3
  ) {
    return offer("straight", book, allowed);
  }
  if (
    risingLead &&
    now.leadReach > 0.55 &&
    now.rearReach < 0.35 &&
    now.lean < 0.18 &&
    now.kneeY < -0.4 &&
    now.kneeHigh < 0.2 &&
    now.handHigh < 0.25
  ) {
    return offer("jab", book, allowed);
  }
  return null;
}

export function recognizePoseMoves(
  samples: Array<{ time: number; pose: BodyPose }>,
  book: Record<string, string>,
  allowed: ReadonlySet<string>,
): Array<{ time: number; move: string }> {
  const ordered = [...samples].sort((a, b) => a.time - b.time);
  const hits: Array<{ time: number; move: string }> = [];
  let blockedUntil = -1;
  for (let i = 0; i < ordered.length; i++) {
    if (ordered[i].time < blockedUntil) continue;
    const move = classify(ordered, i, book, allowed);
    if (!move) continue;
    hits.push({ time: ordered[i].time, move });
    blockedUntil = ordered[i].time + 0.5;
  }
  return hits;
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
      const book = character ? FAMILIES[character] : undefined;
      const allowed = character ? catalog.get(character) : undefined;
      if (character && book && allowed) {
        for (const hit of recognizePoseMoves(
          bucket.map((sample) => ({ time: sample.time, pose: sample.pose })),
          book,
          allowed,
        )) {
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
