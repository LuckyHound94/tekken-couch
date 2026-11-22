import type { VideoRead } from "./strikes";

export type Phase =
  | "start"
  | "red-zone"
  | "denied-entry"
  | "poke-panic"
  | "their-spam"
  | "turtle"
  | "my-plus"
  | "their-plus"
  | "wall"
  | "oki";

export type Vertex = "Press" | "Wait" | "Move";

export type Distance = "their-face" | "mishima" | "open-neutral";

export type WallRead = "crouch" | "stand" | "sidewalk" | "none";

export type Stance = "standing" | "SEN" | "WRA" | "UNS" | "FC" | "crouch";

export type HitResult = "hit" | "block" | "whiff" | "unknown";

export type Outcome = "match" | "mismatch" | "unresolved" | "execution" | "skipped";

export type RuleScope = "floor" | "matchup" | "edit";

export type RuleKind = "decision" | "punish";

export type ButtonFilter = "korean" | "european" | "pakistani" | "american";

export type FramesSign = "plus" | "minus" | "even";

export interface When {
  phase?: Phase;
  phaseNot?: Phase[];
  opponent?: string;
  vertex?: Vertex;
  vertexNot?: Vertex[];
  distance?: Distance;
  stance?: Stance;
  wall?: WallRead;
  frames?: FramesSign;
  layerAlive?: boolean;
  counterBelow?: number;
  counterAtLeast?: number;
  theirMove?: string;
}

export interface FloorRule {
  id: string;
  origin: "canon" | "edit";
  scope: RuleScope;
  kind: RuleKind;
  title: string;
  sentence: string;
  source: string;
  checked: string;
  framesPatch?: string;
  personId?: string;
  destination?: "floor" | "matchup";
  when: When;
  allow: string[];
  deny: string[];
  createdAt: string;
}

export interface Situation {
  phase: Phase | null;
  opponent: string | null;
  vertex: Vertex | null;
  distance: Distance | null;
  stance: Stance | null;
  frames: number | null;
  wall: WallRead | null;
  counter: number | null;
  layerAlive: boolean | null;
  theirMove: string | null;
  gameIndex: number | null;
}

export interface Exchange {
  id: string;
  order: number;
  round: number | null;
  situation: Situation;
  answer: string;
  priorInput: string | null;
  hit: HitResult;
  damage: number | null;
  roundScore: string | null;
  patch: string | null;
  opponentPlayerId: string | null;
  deathClip: boolean;
  note: string;
}

export type ReplayFile = "dead" | "manual" | "local";

export interface Match {
  id: string;
  playedAt: string;
  playerCharacter: string;
  opponentCharacter: string;
  opponentPlayerId: string;
  rounds: string;
  rating: number | null;
  ratingDelta: number | null;
  patch: string | null;
  file: ReplayFile;
  fixture: boolean;
  blurb: string;
  exchanges: Exchange[];
}

export interface Habit {
  id: string;
  personId: string;
  character: string | null;
  when: When;
  answer: string;
  createdAt: string;
  sentence: string;
}

export interface Verdict {
  outcome: Outcome;
  ruleId: string | null;
  phrase: string;
  advice: string[] | null;
  framesUnverified: boolean;
}

export interface AppState {
  tekkenId: string;
  filter: ButtonFilter;
  rules: FloorRule[];
  habits: Habit[];
  matches: Match[];
  video: VideoRead | null;
}

export interface JudgeInput {
  playerCharacter: string;
  opponentPlayerId: string | null;
  answer: string;
  priorInput: string | null;
  patch: string | null;
  situation: Situation;
}

export function emptySituation(): Situation {
  return {
    phase: null,
    opponent: null,
    vertex: null,
    distance: null,
    stance: null,
    frames: null,
    wall: null,
    counter: null,
    layerAlive: null,
    theirMove: null,
    gameIndex: null,
  };
}

export function emptyExchange(id: string, order: number): Exchange {
  return {
    id,
    order,
    round: null,
    situation: emptySituation(),
    answer: "",
    priorInput: null,
    hit: "unknown",
    damage: null,
    roundScore: null,
    patch: null,
    opponentPlayerId: null,
    deathClip: true,
    note: "",
  };
}
