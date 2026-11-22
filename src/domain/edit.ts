import { inputFrom, judge } from "./judge";
import { hasMatchupFile } from "./labels";
import { displayMove, normalizeMove } from "./notation";
import { describeWhen, habitSentence } from "./phrase";
import type { AppState, FloorRule, Habit, JudgeInput, Outcome, Situation, When } from "./types";

export type NarrowKey =
  | "phase"
  | "opponent"
  | "vertex"
  | "distance"
  | "stance"
  | "wall"
  | "frames"
  | "layerAlive"
  | "counter";

export type ScopeChoice = "auto" | "floor" | "matchup" | "person";

export interface Flip {
  matchId: string;
  exchangeId: string;
  answer: string;
  before: Outcome;
  after: Outcome;
}

export function narrowWhen(situation: Situation, keys: NarrowKey[]): When {
  const when: When = {};
  if (keys.includes("phase") && situation.phase) when.phase = situation.phase;
  if (keys.includes("opponent") && situation.opponent) when.opponent = situation.opponent;
  if (keys.includes("vertex") && situation.vertex) when.vertex = situation.vertex;
  if (keys.includes("distance") && situation.distance) when.distance = situation.distance;
  if (keys.includes("stance") && situation.stance) when.stance = situation.stance;
  if (keys.includes("wall") && situation.wall) when.wall = situation.wall;
  if (keys.includes("frames") && situation.frames != null) {
    when.frames = situation.frames > 0 ? "plus" : situation.frames < 0 ? "minus" : "even";
  }
  if (keys.includes("layerAlive") && situation.layerAlive != null) when.layerAlive = situation.layerAlive;
  if (keys.includes("counter") && situation.counter != null) {
    if (situation.counter >= 3) when.counterAtLeast = 3;
    else when.counterBelow = 3;
  }
  return when;
}

export function resolveScope(choice: ScopeChoice, opponent: string | null): "floor" | "matchup" | "person" {
  if (choice === "person") return "person";
  if (choice === "floor") return "floor";
  if (choice === "matchup") return "matchup";
  return hasMatchupFile(opponent) ? "matchup" : "floor";
}

function withDelta(input: JudgeInput, rules: FloorRule[], when: When, replacement: string | null): FloorRule {
  const current = judge(input, rules);
  const base = rules.find((rule) => rule.id === current.ruleId);
  const allow = new Set(base?.allow ?? []);
  const deny = new Set(base?.deny ?? []);
  const pressed = normalizeMove(input.answer);
  if (replacement == null) {
    allow.add(pressed);
    deny.delete(pressed);
  } else {
    const next = normalizeMove(replacement);
    allow.delete(pressed);
    deny.add(pressed);
    if (next) {
      allow.add(next);
      deny.delete(next);
    }
  }
  return {
    id: "",
    origin: "edit",
    scope: "edit",
    kind: "decision",
    title: "Правка ситуации",
    sentence: "",
    source: "правка",
    checked: "",
    when,
    allow: [...allow],
    deny: [...deny],
    createdAt: "",
  };
}

export function finishRule(
  draft: FloorRule,
  destination: "floor" | "matchup",
  opponent: string | null,
  id: string,
  checked: string,
): FloorRule {
  const when = { ...draft.when };
  if (destination === "matchup" && opponent) when.opponent = opponent;
  const rule: FloorRule = {
    ...draft,
    id,
    when,
    destination,
    scope: "edit",
    checked,
    createdAt: new Date().toISOString(),
    sentence: "",
  };
  const named = rule.allow.map(displayMove).join(", ") || "—";
  rule.sentence = `${describeWhen(rule.when)}: правка называет ${named}.`;
  return rule;
}

export function draftRule(input: JudgeInput, rules: FloorRule[], when: When, replacement: string | null): FloorRule {
  return withDelta(input, rules, when, replacement);
}

export function buildHabit(personId: string, character: string | null, when: When, answer: string, id: string): Habit {
  const canonical = normalizeMove(answer);
  return {
    id,
    personId,
    character,
    when,
    answer: canonical,
    createdAt: new Date().toISOString(),
    sentence: habitSentence(personId, when, canonical),
  };
}

export function previewFlips(state: AppState, rule: FloorRule): Flip[] {
  const flips: Flip[] = [];
  for (const match of state.matches) {
    for (const exchange of match.exchanges) {
      const input = inputFrom(match, exchange);
      const before = judge(input, state.rules);
      const after = judge(input, [...state.rules, rule]);
      if (before.outcome !== after.outcome || before.ruleId !== after.ruleId) {
        flips.push({
          matchId: match.id,
          exchangeId: exchange.id,
          answer: exchange.answer || "пустая кнопка",
          before: before.outcome,
          after: after.outcome,
        });
      }
    }
  }
  return flips;
}
