import { describe, expect, test } from "vitest";
import { commandLabel } from "./notation";
import { parseCommand, patternsFor } from "./poseBook";
import { normalizeBody, poseStrikes, type BodyPose, type PoseSample, type RawBody } from "./pose";
import { strikeCatalog } from "../server/strikeCatalog";
import { strikeCommands } from "../server/strikeCatalogData";
import type { StrikeCatalog } from "./strikes";

function rest(): BodyPose {
  return {
    leftShoulder: { x: 0, y: 1 },
    rightShoulder: { x: -0.2, y: 1 },
    leftElbow: { x: 0.15, y: 0.6 },
    rightElbow: { x: -0.1, y: 0.6 },
    leftWrist: { x: 0.25, y: 0.35 },
    rightWrist: { x: -0.05, y: 0.35 },
    leftHip: { x: 0.05, y: 0 },
    rightHip: { x: -0.05, y: 0 },
    leftKnee: { x: 0.08, y: -0.55 },
    rightKnee: { x: -0.02, y: -0.55 },
    leftAnkle: { x: 0.1, y: -1.05 },
    rightAnkle: { x: 0, y: -1.05 },
  };
}

function at(time: number, pose: BodyPose, side: "left" | "right" = "left"): PoseSample {
  return { time, side, pose };
}

function book(): StrikeCatalog {
  return new Map([
    ["reina", new Set(["1", "2", "df+1", "df+2", "hopkick", "f,n,d,df:2", "hellsweep"])],
    ["alisa", new Set(["1", "2", "df+1", "df+2", "hopkick"])],
    ["bob", new Set(["1"])],
  ]);
}

describe("поза называется командой каталога", () => {
  test("джеб, прямая, электрик и хопкик расходятся по разным командам", () => {
    const jab = rest();
    jab.leftElbow = { x: 0.55, y: 0.55 };
    jab.leftWrist = { x: 0.95, y: 0.4 };
    const straight = rest();
    straight.rightElbow = { x: 0.4, y: 0.6 };
    straight.rightWrist = { x: 0.85, y: 0.4 };
    const crouch = rest();
    crouch.leftKnee = { x: 0.1, y: -0.15 };
    crouch.rightKnee = { x: 0, y: -0.15 };
    const electric = rest();
    electric.rightElbow = { x: 0.25, y: 1.35 };
    electric.rightWrist = { x: 0.45, y: 1.75 };
    const hop = rest();
    hop.rightKnee = { x: 0.35, y: 0.7 };
    hop.rightAnkle = { x: 0.45, y: 0.15 };
    const segments = [{ start: 0, end: 3, left: "reina", right: null }];
    const strikes = poseStrikes(
      [at(0, rest()), at(0.1, jab), at(0.7, rest()), at(0.8, straight), at(1.3, rest()), at(1.4, crouch), at(1.5, electric), at(2.1, rest()), at(2.2, hop)],
      segments,
      book(),
    );
    expect(strikes.map((item) => item.move)).toEqual(["1", "2", "f,n,d,df:2", "hopkick"]);
    expect(strikes.map((item) => commandLabel(item.move))).toEqual(["1", "2", "f,n,d,df+2", "uf+4"]);
  });

  test("электрик Алисы не берётся из каталога Рейны, Боб по позе не называется", () => {
    const crouch = rest();
    crouch.leftKnee = { x: 0.1, y: -0.15 };
    crouch.rightKnee = { x: 0, y: -0.15 };
    const electric = rest();
    electric.rightWrist = { x: 0.45, y: 1.75 };
    const jab = rest();
    jab.leftWrist = { x: 0.95, y: 0.4 };
    const live = strikeCatalog();
    const strikes = poseStrikes(
      [at(0, rest(), "right"), at(0.1, crouch, "right"), at(0.2, electric, "right"), at(0.8, rest()), at(0.9, jab)],
      [{ start: 0, end: 2, left: "bob", right: "alisa" }],
      live,
    );
    expect(strikes.every((item) => item.side === "right" && item.characterId === "alisa")).toBe(true);
    expect(strikes.some((item) => item.move === "f,n,d,df:2")).toBe(false);
    expect(live.get("alisa")?.has(strikes[0]?.move ?? "")).toBe(true);
  });

  test("серия, низкий удар и наклон берутся из полного списка", () => {
    const jab = rest();
    jab.leftWrist = { x: 0.95, y: 0.4 };
    const again = rest();
    again.leftWrist = { x: 0.95, y: 0.4 };
    const low = rest();
    low.rightKnee = { x: 0.45, y: -0.5 };
    low.rightAnkle = { x: 0.85, y: -0.9 };
    const mid = rest();
    mid.leftShoulder = { x: 0.35, y: 1 };
    mid.rightShoulder = { x: 0.15, y: 1 };
    mid.leftWrist = { x: 1.15, y: 0.4 };
    const live = strikeCatalog();
    const segments = [{ start: 0, end: 4, left: "reina", right: "alisa" }];
    expect(poseStrikes([at(0, rest()), at(0.1, jab), at(0.25, rest()), at(0.4, again)], segments, live).map((item) => item.move)).toEqual(["1,1"]);
    expect(poseStrikes([at(0, rest()), at(0.1, low)], segments, live).map((item) => item.move)).toEqual(["db+4"]);
    expect(poseStrikes([at(0, rest()), at(0.1, mid)], segments, live).map((item) => item.move)).toEqual(["df+1"]);
    const crouch = rest();
    crouch.leftKnee = { x: 0.1, y: -0.15 };
    crouch.rightKnee = { x: 0, y: -0.15 };
    const sweep = rest();
    sweep.rightKnee = { x: 0.45, y: -0.5 };
    sweep.rightAnkle = { x: 0.9, y: -0.85 };
    expect(poseStrikes([at(0, rest()), at(0.1, crouch), at(0.2, sweep)], segments, live).map((item) => commandLabel(item.move))).toEqual(["WGS.DF+4"]);
  });

  test("короткий джеб и удар ногой читаются у обоих, серия не схлопывается", () => {
    const jab = rest();
    jab.leftWrist = { x: 0.4, y: 0.12 };
    const kick = rest();
    kick.rightAnkle = { x: 0.3, y: -0.7 };
    const live = strikeCatalog();
    const segments = [{ start: 0, end: 2, left: "reina", right: "alisa" }];
    const again = rest();
    again.leftWrist = { x: 0.95, y: 0.4 };
    const straight = rest();
    straight.leftWrist = { x: 0.95, y: 0.4 };
    expect(poseStrikes([at(0, rest()), at(0.12, jab)], segments, live).map((item) => item.move)).toEqual(["1"]);
    expect(
      poseStrikes([at(0, rest(), "right"), at(0.12, kick, "right")], segments, live).map((item) => item.move),
    ).toEqual(["4"]);
    expect(
      poseStrikes([at(0, rest()), at(0.1, straight), at(0.2, rest()), at(0.32, again)], segments, live).map((item) => item.move),
    ).toEqual(["1,1"]);
  });

  test("каждая команда Рейны и Алисы разбирается в схему", () => {
    const live = strikeCatalog();
    for (const id of ["reina", "alisa"] as const) {
      const missed = strikeCommands[id].filter((command) => parseCommand(command) == null);
      expect(missed).toEqual([]);
      const patterns = patternsFor(id);
      expect(patterns).toHaveLength(strikeCommands[id].length);
      for (const pattern of patterns) expect(live.get(id)?.has(pattern.move)).toBe(true);
    }
  });

  test("в каталоге Рейны и Алисы есть эти команды", () => {
    const live = strikeCatalog();
    for (const move of ["1", "2", "df+1", "df+2", "hopkick", "f,n,d,df:2", "hellsweep"]) {
      expect(live.get("reina")?.has(move)).toBe(true);
    }
    for (const move of ["1", "2", "df+1", "df+2", "hopkick"]) {
      expect(live.get("alisa")?.has(move)).toBe(true);
    }
    expect(live.get("alisa")?.has("f,n,d,df:2")).toBe(false);
  });

  test("нормализация смотрит вперёд и отбрасывает невидимый таз", () => {
    const raw = {} as RawBody;
    const pose = rest();
    for (const key of Object.keys(pose) as Array<keyof BodyPose>) {
      raw[key] = { x: 10 + pose[key].x * 4, y: 10 - pose[key].y * 4, visibility: 1 };
    }
    raw.leftHip = { x: 10.2, y: 10, visibility: 1 };
    raw.rightHip = { x: 9.8, y: 10, visibility: 1 };
    raw.leftShoulder = { x: 10, y: 6, visibility: 1 };
    raw.rightShoulder = { x: 9.2, y: 6, visibility: 1 };
    const body = normalizeBody(raw, 1);
    expect(body).not.toBeNull();
    expect(body?.leftWrist.x).toBeGreaterThan(0);
    raw.leftHip = { ...raw.leftHip, visibility: 0.1 };
    expect(normalizeBody(raw, 1)).toBeNull();
    const flipped = normalizeBody({ ...raw, leftHip: { x: 10.2, y: 10, visibility: 1 } }, -1);
    expect(flipped?.leftWrist.x).toBeLessThan(0);
  });
});
