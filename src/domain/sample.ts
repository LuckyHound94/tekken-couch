import { SEED_RULES } from "./floor";
import { emptySituation } from "./types";
import type { AppState, Exchange, Match, Situation } from "./types";

export const DEFAULT_TEKKEN_ID = "25M2-hH4y-YbQa";
export const LAST_PATCH = { id: "3.03.01", on: "2026-11-12" };

function situation(partial: Partial<Situation>): Situation {
  return { ...emptySituation(), ...partial };
}

function exchange(partial: Partial<Exchange> & Pick<Exchange, "id" | "order" | "answer">): Exchange {
  return {
    round: null,
    situation: emptySituation(),
    priorInput: null,
    hit: "unknown",
    damage: null,
    roundScore: null,
    patch: null,
    opponentPlayerId: null,
    deathClip: true,
    note: "",
    ...partial,
  };
}

const header: Match = {
  id: "header-2026-10-11",
  playedAt: "2026-10-11T13:51:00",
  playerCharacter: "Reina",
  opponentCharacter: "Alisa",
  opponentPlayerId: "AngryByakko",
  rounds: "3–2",
  rating: 2098,
  ratingDelta: 6,
  patch: null,
  file: "dead",
  fixture: false,
  blurb:
    "Шапка со страницы Wavu на 22 ноября 2026. Файл боя старше патча 3.03.01, на сервере его уже нет. Карточка открывается пустой.",
  exchanges: [],
};

const tutorial: Match = {
  id: "tutorial",
  playedAt: "2026-11-22T12:00:00",
  playerCharacter: "Reina",
  opponentCharacter: "разные",
  opponentPlayerId: "",
  rounds: "—",
  rating: null,
  ratingDelta: null,
  patch: null,
  file: "manual",
  fixture: true,
  blurb: "Учебные обмены, размеченные руками. На них проверяется судья. Это не строка Wavu.",
  exchanges: [
    exchange({
      id: "t-hellsweep",
      order: 1,
      answer: "hellsweep",
      hit: "hit",
      damage: 38,
      roundScore: "2–1",
      opponentPlayerId: "AngryByakko",
      note: "Попавший hellsweep с плюса. Урон и счёт раунда исход не двигают.",
      situation: situation({
        phase: "my-plus",
        opponent: "Alisa",
        vertex: "Press",
        distance: "their-face",
        counter: 0,
        layerAlive: true,
      }),
    }),
    exchange({
      id: "t-df1",
      order: 2,
      answer: "df+1",
      hit: "block",
      damage: 0,
      roundScore: "0–2",
      opponentPlayerId: "AngryByakko",
      note: "Заблокированный df+1, пока красную зону не контрят.",
      situation: situation({
        phase: "red-zone",
        opponent: "Alisa",
        vertex: "Press",
        distance: "their-face",
        counter: 0,
        layerAlive: true,
      }),
    }),
    exchange({
      id: "t-empty",
      order: 3,
      answer: "df+1",
      hit: "block",
      note: "Дистанция не снята. Советом это не закрывается.",
      situation: situation({
        phase: "red-zone",
        opponent: "Alisa",
        vertex: "Press",
        layerAlive: true,
      }),
    }),
    exchange({
      id: "t-law",
      order: 4,
      answer: "SEN.3",
      hit: "hit",
      damage: 24,
      opponentPlayerId: "leonsluv",
      note: "Против Law с первой игры строка матчапа, не красная зона.",
      situation: situation({
        phase: "red-zone",
        opponent: "Law",
        vertex: "Press",
        distance: "their-face",
        stance: "SEN",
        layerAlive: true,
        gameIndex: 1,
      }),
    }),
    exchange({
      id: "t-route",
      order: 5,
      answer: "df+1",
      priorInput: "ws3,4",
      note: "Глубокий дэш после ws3,4. Дистанции для этого роута не нужно.",
      situation: situation({ opponent: "Alisa" }),
    }),
    exchange({
      id: "t-unseen",
      order: 6,
      answer: "hellsweep",
      hit: "hit",
      opponentPlayerId: "AngryByakko",
      note: "С плюса, а число закрытых лоу на клипе не видно.",
      situation: situation({
        phase: "my-plus",
        opponent: "Alisa",
        distance: "their-face",
        vertex: "Press",
      }),
    }),
    exchange({
      id: "t-step",
      order: 7,
      answer: "степ",
      situation: situation({
        distance: "open-neutral",
        opponent: "Alisa",
        vertex: "Move",
      }),
    }),
    exchange({
      id: "t-dash",
      order: 8,
      answer: "дашблок",
      situation: situation({
        distance: "open-neutral",
        opponent: "Alisa",
        vertex: "Move",
      }),
    }),
    exchange({
      id: "t-wgf",
      order: 9,
      answer: "WGF",
      hit: "block",
      situation: situation({
        vertex: "Wait",
        distance: "mishima",
        opponent: "Alisa",
        phase: "red-zone",
      }),
    }),
    exchange({
      id: "t-patch",
      order: 10,
      answer: "df+1",
      hit: "block",
      patch: "3.03.01",
      note: "Решение то же, кадры этого патча со срезом не сверены.",
      situation: situation({
        phase: "red-zone",
        opponent: "Alisa",
        distance: "their-face",
        layerAlive: true,
        vertex: "Press",
      }),
    }),
  ],
};

const heihachi: Match = {
  id: "fixture-heihachi",
  playedAt: "2026-10-11T12:10:00",
  playerCharacter: "Heihachi",
  opponentCharacter: "King",
  opponentPlayerId: "",
  rounds: "—",
  rating: null,
  ratingDelta: null,
  patch: null,
  file: "manual",
  fixture: true,
  blurb: "Пример строки чужого персонажа. В списке она видна. В судью Heihachi не входит.",
  exchanges: [
    exchange({
      id: "h-1",
      order: 1,
      answer: "df+1",
      situation: situation({
        phase: "red-zone",
        opponent: "King",
        distance: "their-face",
        layerAlive: true,
      }),
    }),
  ],
};

export function sampleState(): AppState {
  return {
    tekkenId: DEFAULT_TEKKEN_ID,
    filter: "korean",
    rules: SEED_RULES.map((rule) => ({ ...rule, when: { ...rule.when } })),
    habits: [],
    matches: [header, tutorial, heihachi].map((match) => ({
      ...match,
      exchanges: match.exchanges.map((item) => ({ ...item, situation: { ...item.situation } })),
    })),
  };
}
