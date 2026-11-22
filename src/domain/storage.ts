import { SEED_RULES } from "./floor";
import { DEFAULT_TEKKEN_ID, sampleState } from "./sample";
import { parseVideoRead, type VideoRead } from "./strikes";
import type { AppState, ButtonFilter, Exchange, FloorRule, Habit, Match, Situation } from "./types";

const STORAGE_KEY = "tekken-couch.v1";

interface Stored {
  tekkenId?: string;
  filter?: ButtonFilter;
  habits?: Habit[];
  matches?: Match[];
  edits?: FloorRule[];
  video?: VideoRead | null;
}

const FILTERS: ButtonFilter[] = ["korean", "european", "pakistani", "american"];

function isFilter(value: unknown): value is ButtonFilter {
  return typeof value === "string" && FILTERS.includes(value as ButtonFilter);
}

export function freshRules(edits: FloorRule[]): FloorRule[] {
  const safe = edits.filter((rule) => rule.origin === "edit" && rule.scope === "edit");
  return [...SEED_RULES.map((rule) => ({ ...rule, when: { ...rule.when } })), ...safe];
}

export function exportPayload(state: AppState): Stored {
  return {
    tekkenId: state.tekkenId,
    filter: state.filter,
    habits: state.habits,
    matches: state.matches,
    edits: state.rules.filter((rule) => rule.origin === "edit"),
    video: state.video,
  };
}

function mergeSituation(local: Situation, incoming: Situation): Situation {
  const next: Situation = { ...incoming };
  (Object.keys(local) as (keyof Situation)[]).forEach((key) => {
    const value = local[key];
    if (value != null) {
      (next[key] as Situation[keyof Situation]) = value;
    }
  });
  return next;
}

function preferText(local: string | null | undefined, incoming: string | null | undefined): string | null {
  if (local && local.trim()) return local;
  return incoming ?? null;
}

export function mergeExchange(local: Exchange, incoming: Exchange): Exchange {
  return {
    ...local,
    answer: local.answer.trim() ? local.answer : incoming.answer,
    priorInput: preferText(local.priorInput, incoming.priorInput),
    note: local.note.trim() ? local.note : incoming.note,
    patch: local.patch ?? incoming.patch,
    situation: mergeSituation(local.situation, incoming.situation),
  };
}

export function mergeMatches(local: Match[], incoming: Match[]): Match[] {
  const byId = new Map(local.map((match) => [match.id, match]));
  const seen = new Set<string>();
  const merged: Match[] = [];
  for (const match of local) {
    seen.add(match.id);
    const next = incoming.find((item) => item.id === match.id);
    if (!next) {
      merged.push(match);
      continue;
    }
    const exchanges = mergeExchangeList(match.exchanges, next.exchanges);
    merged.push({ ...match, exchanges });
  }
  for (const match of incoming) {
    if (seen.has(match.id) || byId.has(match.id)) continue;
    merged.push(match);
  }
  return merged;
}

function mergeExchangeList(local: Exchange[], incoming: Exchange[]): Exchange[] {
  const incomingById = new Map(incoming.map((item) => [item.id, item]));
  const used = new Set<string>();
  const merged = local.map((item) => {
    const next = incomingById.get(item.id);
    if (!next) return item;
    used.add(item.id);
    return mergeExchange(item, next);
  });
  for (const item of incoming) {
    if (!used.has(item.id) && !local.some((row) => row.id === item.id)) merged.push(item);
  }
  return merged;
}

export function hydrate(stored: Stored): AppState {
  const base = sampleState();
  return {
    tekkenId: stored.tekkenId?.trim() || base.tekkenId,
    filter: isFilter(stored.filter) ? stored.filter : base.filter,
    habits: stored.habits ?? [],
    matches: stored.matches ?? base.matches,
    rules: freshRules(stored.edits ?? []),
    video: parseVideoRead(stored.video),
  };
}

export function mergeImport(current: AppState, stored: Stored): AppState {
  const edits = current.rules.filter((rule) => rule.origin === "edit");
  for (const rule of stored.edits ?? []) {
    if (rule.origin !== "edit") continue;
    if (edits.some((item) => item.id === rule.id)) continue;
    edits.push(rule);
  }
  const habits = [...current.habits];
  for (const habit of stored.habits ?? []) {
    if (habits.some((item) => item.id === habit.id)) continue;
    habits.push(habit);
  }
  return {
    tekkenId: current.tekkenId || stored.tekkenId || DEFAULT_TEKKEN_ID,
    filter: current.filter,
    habits,
    matches: mergeMatches(current.matches, stored.matches ?? []),
    rules: freshRules(edits),
    video: current.video,
  };
}

export function loadState(): AppState {
  if (typeof localStorage === "undefined") return sampleState();
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return sampleState();
  try {
    return hydrate(JSON.parse(raw) as Stored);
  } catch {
    return sampleState();
  }
}

export function saveState(state: AppState): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(exportPayload(state)));
}
