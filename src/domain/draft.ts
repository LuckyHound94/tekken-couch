import { judge } from "./judge";
import { DISTANCE_LABEL, PHASE_LABEL } from "./labels";
import { displayMove, normalizeMove } from "./notation";
import type { AppState, FloorRule, Outcome, Situation, Vertex } from "./types";

export interface VoteRow {
  matchId: string;
  exchangeId: string;
  key: string;
  label: string;
  answer: string;
  outcome: Outcome;
  vertex: Vertex | null;
  order: number;
}

export interface DraftReport {
  counters: Array<{ matchId: string; key: string; label: string; count: number; answers: string[] }>;
  taxes: Array<{ key: string; label: string; answer: string; count: number; matchIds: string[] }>;
  lines: Array<{ key: string; label: string; answer: string; count: number; matchIds: string[] }>;
  longestSeries: { matchId: string; vertex: Vertex; length: number } | null;
  expensiveWithoutCounter: number;
  resolved: number;
}

export function situationKey(situation: Situation): string {
  const sign = situation.frames == null ? "" : situation.frames > 0 ? "+" : situation.frames < 0 ? "-" : "0";
  return [
    situation.phase ?? "",
    (situation.opponent ?? "").trim().toLowerCase(),
    situation.vertex ?? "",
    situation.distance ?? "",
    situation.stance ?? "",
    situation.wall ?? "",
    sign,
    situation.layerAlive == null ? "" : situation.layerAlive ? "alive" : "dead",
  ].join("|");
}

export function situationLabel(situation: Situation): string {
  const parts: string[] = [];
  if (situation.phase) parts.push(PHASE_LABEL[situation.phase]);
  if (situation.opponent) parts.push(situation.opponent);
  if (situation.vertex) parts.push(situation.vertex);
  if (situation.distance) parts.push(DISTANCE_LABEL[situation.distance]);
  if (parts.length === 0) return "поля не собраны";
  return parts.join(", ");
}

export function voteRows(state: Pick<AppState, "matches" | "rules">, rules: FloorRule[] = state.rules): VoteRow[] {
  const rows: VoteRow[] = [];
  for (const match of state.matches) {
    for (const exchange of match.exchanges) {
      const situation = {
        ...exchange.situation,
        opponent: exchange.situation.opponent ?? (match.opponentCharacter === "разные" ? null : match.opponentCharacter),
      };
      const verdict = judge(
        {
          playerCharacter: match.playerCharacter,
          opponentPlayerId: exchange.opponentPlayerId,
          answer: exchange.answer,
          priorInput: exchange.priorInput,
          patch: exchange.patch ?? match.patch,
          situation,
        },
        rules,
      );
      if (verdict.outcome !== "match" && verdict.outcome !== "mismatch") continue;
      rows.push({
        matchId: match.id,
        exchangeId: exchange.id,
        key: situationKey(situation),
        label: situationLabel(situation),
        answer: normalizeMove(exchange.answer),
        outcome: verdict.outcome,
        vertex: situation.vertex,
        order: exchange.order,
      });
    }
  }
  return rows;
}

export function buildDraft(state: Pick<AppState, "matches" | "rules">): DraftReport {
  const rows = voteRows(state);
  const counters: DraftReport["counters"] = [];
  const byMatch = new Map<string, VoteRow[]>();
  for (const row of rows) {
    const list = byMatch.get(row.matchId) ?? [];
    list.push(row);
    byMatch.set(row.matchId, list);
  }
  const counterIds = new Set<string>();
  for (const [matchId, list] of byMatch) {
    const byKey = new Map<string, VoteRow[]>();
    for (const row of list) {
      const group = byKey.get(row.key) ?? [];
      group.push(row);
      byKey.set(row.key, group);
    }
    for (const [key, group] of byKey) {
      if (group.length < 3) continue;
      counterIds.add(`${matchId}|${key}`);
      counters.push({
        matchId,
        key,
        label: group[0].label,
        count: group.length,
        answers: [...new Set(group.map((row) => row.answer))],
      });
    }
  }

  const bySituation = new Map<string, VoteRow[]>();
  for (const row of rows) {
    const group = bySituation.get(row.key) ?? [];
    group.push(row);
    bySituation.set(row.key, group);
  }

  const taxes: DraftReport["taxes"] = [];
  const lines: DraftReport["lines"] = [];
  for (const [key, group] of bySituation) {
    const counts = new Map<string, { count: number; matchIds: Set<string>; cheap: number }>();
    for (const row of group) {
      const bucket = counts.get(row.answer) ?? { count: 0, matchIds: new Set<string>(), cheap: 0 };
      bucket.count += 1;
      bucket.matchIds.add(row.matchId);
      if (row.outcome === "match") bucket.cheap += 1;
      counts.set(row.answer, bucket);
    }
    for (const [answer, bucket] of counts) {
      if (bucket.cheap === bucket.count) continue;
      taxes.push({
        key,
        label: group[0].label,
        answer,
        count: bucket.count - bucket.cheap,
        matchIds: [...bucket.matchIds],
      });
    }
    const ranked = [...counts.entries()].sort((a, b) => b[1].count - a[1].count);
    const [top, second] = ranked;
    if (!top || (second && second[1].count === top[1].count)) continue;
    if (top[1].cheap !== top[1].count) continue;
    if (top[1].matchIds.size < 2) continue;
    lines.push({
      key,
      label: group[0].label,
      answer: top[0],
      count: top[1].count,
      matchIds: [...top[1].matchIds],
    });
  }

  let longestSeries: DraftReport["longestSeries"] = null;
  for (const match of state.matches) {
    let runVertex: Vertex | null = null;
    let run = 0;
    const ordered = [...match.exchanges].sort((a, b) => a.order - b.order);
    for (const exchange of ordered) {
      const vertex = exchange.situation.vertex;
      if (!vertex || vertex !== runVertex) {
        runVertex = vertex;
        run = vertex ? 1 : 0;
      } else {
        run += 1;
      }
      if (runVertex && run > (longestSeries?.length ?? 0)) {
        longestSeries = { matchId: match.id, vertex: runVertex, length: run };
      }
    }
  }

  const expensiveWithoutCounter = rows.filter(
    (row) => row.outcome === "mismatch" && !counterIds.has(`${row.matchId}|${row.key}`),
  ).length;

  return {
    counters,
    taxes,
    lines,
    longestSeries,
    expensiveWithoutCounter,
    resolved: rows.length,
  };
}

export function answerLabel(answer: string): string {
  return displayMove(answer);
}
