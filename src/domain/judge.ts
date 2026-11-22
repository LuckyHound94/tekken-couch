import { SEED_RULES } from "./floor";
import { displayMove, isReina, normalizeMove, sameName } from "./notation";
import { ROUTES } from "./routes";
import type { FloorRule, JudgeInput, Match, Situation, Verdict, When } from "./types";

const GATED = new Set(["hellsweep", "WRA.1+3"]);

export function framesSignOf(frames: number | null): "plus" | "minus" | "even" | null {
  if (frames == null || Number.isNaN(frames)) return null;
  if (frames > 0) return "plus";
  if (frames < 0) return "minus";
  return "even";
}

export function specificity(when: When): number {
  let count = 0;
  if (when.phase) count += 1;
  if (when.phaseNot?.length) count += 1;
  if (when.opponent) count += 1;
  if (when.vertex) count += 1;
  if (when.vertexNot?.length) count += 1;
  if (when.distance) count += 1;
  if (when.stance) count += 1;
  if (when.wall) count += 1;
  if (when.frames) count += 1;
  if (when.layerAlive != null) count += 1;
  if (when.counterBelow != null) count += 1;
  if (when.counterAtLeast != null) count += 1;
  if (when.theirMove) count += 1;
  return count;
}

export function whenMatches(when: When, situation: Situation): boolean {
  if (when.phase && situation.phase !== when.phase) return false;
  if (when.phaseNot?.length && situation.phase && when.phaseNot.includes(situation.phase)) return false;
  if (when.opponent && !sameName(situation.opponent, when.opponent)) return false;
  if (when.vertex && situation.vertex !== when.vertex) return false;
  if (when.vertexNot?.length && situation.vertex && when.vertexNot.includes(situation.vertex)) return false;
  if (when.distance && situation.distance !== when.distance) return false;
  if (when.stance && situation.stance !== when.stance) return false;
  if (when.wall && situation.wall !== when.wall) return false;
  if (when.frames) {
    const sign = framesSignOf(situation.frames);
    if (sign == null || sign !== when.frames) return false;
  }
  if (when.layerAlive === true && situation.layerAlive === false) return false;
  if (when.layerAlive === false && situation.layerAlive !== false) return false;
  if (when.counterBelow != null && situation.counter != null && situation.counter >= when.counterBelow) {
    return false;
  }
  if (when.counterAtLeast != null && (situation.counter == null || situation.counter < when.counterAtLeast)) {
    return false;
  }
  if (when.theirMove && normalizeMove(situation.theirMove) !== normalizeMove(when.theirMove)) return false;
  if (when.opponent && !situation.opponent) return false;
  if (when.phase && !situation.phase) return false;
  if (when.vertex && !situation.vertex) return false;
  if (when.distance && !situation.distance) return false;
  if (when.stance && !situation.stance) return false;
  if (when.wall && !situation.wall) return false;
  if (when.theirMove && !situation.theirMove) return false;
  return true;
}

function scopeRank(rule: FloorRule): number {
  if (rule.scope === "edit") return 3;
  if (rule.scope === "matchup") return 2;
  return 1;
}

export function ruleApplies(rule: FloorRule, input: JudgeInput): boolean {
  if (rule.personId) return !!input.opponentPlayerId && rule.personId === input.opponentPlayerId;
  return true;
}

export function selectRule(input: JudgeInput, rules: FloorRule[]): FloorRule | null {
  const matched = rules.filter((rule) => ruleApplies(rule, input) && whenMatches(rule.when, input.situation));
  if (matched.length === 0) return null;
  return [...matched].sort((a, b) => {
    const byScope = scopeRank(b) - scopeRank(a);
    if (byScope) return byScope;
    const bySpec = specificity(b.when) - specificity(a.when);
    if (bySpec) return bySpec;
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    return a.id < b.id ? -1 : 1;
  })[0];
}

function verdict(
  outcome: Verdict["outcome"],
  phrase: string,
  ruleId: string | null,
  advice: string[] | null,
  framesUnverified = false,
): Verdict {
  return { outcome, phrase, ruleId, advice, framesUnverified };
}

function framesNote(rule: FloorRule, patch: string | null): { suffix: string; unverified: boolean } {
  if (!patch || !rule.framesPatch || patch === rule.framesPatch) {
    return { suffix: "", unverified: false };
  }
  return {
    suffix: ` Кадры сверены ${rule.checked}, реплей патча ${patch} с этим срезом не сверялся.`,
    unverified: true,
  };
}

function punishTrusted(rule: FloorRule, patch: string | null): boolean {
  if (rule.kind !== "punish") return true;
  return !!patch && !!rule.framesPatch && patch === rule.framesPatch;
}

function fromRule(rule: FloorRule, outcome: "match" | "mismatch" | "execution", patch: string | null, advice: string[] | null, lead: string): Verdict {
  const frames = framesNote(rule, patch);
  const prefix = outcome === "match" ? "Совпало. " : outcome === "mismatch" ? "Не совпало. " : "Исполнение. ";
  return verdict(outcome, `${prefix}${lead}${frames.suffix}`, rule.id, advice, frames.unverified);
}

export function judge(input: JudgeInput, rules: FloorRule[] = SEED_RULES, skipCounterGate = false): Verdict {
  if (!isReina(input.playerCharacter)) {
    return verdict(
      "skipped",
      "В судью входит Reina. Строка этого персонажа в списке видна и в разбор не идёт.",
      null,
      null,
    );
  }

  const answer = normalizeMove(input.answer);
  if (!answer) {
    return verdict("unresolved", "Не разобрано. Кнопка не названа, и сверять нечего.", null, null);
  }

  const prior = normalizeMove(input.priorInput);
  const route = ROUTES.find((item) => item.after === prior);
  if (route) {
    if (route.expect.includes(answer)) {
      return verdict("match", `Совпало. ${route.sentenceOk}`, route.id, null);
    }
    return verdict("execution", `Исполнение. ${route.sentenceBroken}`, route.id, route.expect);
  }

  if (!input.situation.distance) {
    return verdict(
      "unresolved",
      "Не разобрано. Дистанция пустая, строку не к чему приложить.",
      null,
      null,
    );
  }

  if (!skipCounterGate && GATED.has(answer) && input.situation.counter == null) {
    const low = judge({ ...input, situation: { ...input.situation, counter: 0 } }, rules, true);
    const high = judge({ ...input, situation: { ...input.situation, counter: 3 } }, rules, true);
    if (low.outcome !== high.outcome || low.ruleId !== high.ruleId) {
      return verdict(
        "unresolved",
        `Не разобрано. Для ${displayMove(answer)} число закрытых лоу меняет слой, а на записи его не видно. Поставь число.`,
        null,
        null,
      );
    }
    return low;
  }

  const rule = selectRule(input, rules);
  if (!rule) {
    return verdict("unresolved", "Не разобрано. Пол эти поля не назвал.", null, null);
  }

  if (!punishTrusted(rule, input.patch)) {
    const patchBit = input.patch ? `, реплей патча ${input.patch}` : ", патч реплея не указан";
    return verdict(
      "unresolved",
      `Кадры не сверены. ${rule.sentence} Срез правила — ${rule.checked}, патч ${rule.framesPatch ?? "не указан"}${patchBit}. В уверенную ошибку паниша это не идёт.`,
      rule.id,
      null,
      true,
    );
  }

  if (answer === "WGF" && rule.allow.includes("EWGF")) {
    return fromRule(
      rule,
      "execution",
      input.patch,
      ["EWGF"],
      "На месте electric вышел WGF. Роут выбран, джаст-фрейм сорвался.",
    );
  }

  if (rule.deny.includes(answer) || !rule.allow.includes(answer)) {
    return fromRule(rule, "mismatch", input.patch, rule.allow.length ? rule.allow : null, rule.sentence);
  }

  return fromRule(rule, "match", input.patch, null, rule.sentence);
}

export function inputFrom(
  match: Pick<Match, "playerCharacter" | "opponentCharacter" | "patch">,
  exchange: {
    answer: string;
    priorInput: string | null;
    patch: string | null;
    opponentPlayerId: string | null;
    situation: Situation;
  },
): JudgeInput {
  const opponent = exchange.situation.opponent ?? usableOpponent(match.opponentCharacter);
  return {
    playerCharacter: match.playerCharacter,
    opponentPlayerId: exchange.opponentPlayerId,
    answer: exchange.answer,
    priorInput: exchange.priorInput,
    patch: exchange.patch ?? match.patch,
    situation: { ...exchange.situation, opponent },
  };
}

export function judgeExchange(
  match: Pick<Match, "playerCharacter" | "opponentCharacter" | "patch">,
  exchange: {
    answer: string;
    priorInput: string | null;
    patch: string | null;
    opponentPlayerId: string | null;
    situation: Situation;
  },
  rules: FloorRule[],
): Verdict {
  return judge(inputFrom(match, exchange), rules);
}

function usableOpponent(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed || trimmed === "разные" || trimmed === "—") return null;
  return trimmed;
}
