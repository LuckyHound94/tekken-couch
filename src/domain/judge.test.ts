import { describe, expect, test } from "vitest";
import { buildDraft } from "./draft";
import { buildHabit, draftRule, finishRule, narrowWhen, previewFlips, resolveScope } from "./edit";
import { SEED_RULES } from "./floor";
import { inputFrom, judge } from "./judge";
import { sampleState } from "./sample";
import { mergeExchange, mergeImport } from "./storage";
import { emptyExchange, emptySituation, type AppState, type Exchange, type Situation } from "./types";

function situation(partial: Partial<Situation>): Situation {
  return { ...emptySituation(), ...partial };
}

function exchange(partial: Partial<Exchange> & Pick<Exchange, "answer">): Exchange {
  return {
    ...emptyExchange("x", 1),
    deathClip: true,
    ...partial,
    situation: partial.situation ?? emptySituation(),
  };
}

const reina = {
  playerCharacter: "Reina",
  opponentPlayerId: "AngryByakko",
  priorInput: null as string | null,
  patch: null as string | null,
};

describe("тройка проверки", () => {
  test("hellsweep при счётчике нуль не совпал, даже если попал", () => {
    const hit = judge(
      {
        ...reina,
        answer: "hellsweep",
        situation: situation({
          phase: "my-plus",
          distance: "their-face",
          counter: 0,
          opponent: "Alisa",
          vertex: "Press",
        }),
      },
      SEED_RULES,
    );
    const blocked = judge(
      {
        ...reina,
        answer: "hellsweep",
        situation: situation({
          phase: "my-plus",
          distance: "their-face",
          counter: 0,
          opponent: "Alisa",
        }),
      },
      SEED_RULES,
    );
    expect(hit.outcome).toBe("mismatch");
    expect(hit.ruleId).toBe("plus-layer-0");
    expect(hit.advice).not.toContain("hellsweep");
    expect(hit.phrase.startsWith("Не совпало.")).toBe(true);
    expect(hit.phrase).not.toContain("38");
    expect(blocked.outcome).toBe(hit.outcome);
    expect(blocked.ruleId).toBe(hit.ruleId);
    expect(blocked.advice).toEqual(hit.advice);
  });

  test("заблокированный df+1 в красной зоне совпал", () => {
    const blocked = judge(
      {
        ...reina,
        answer: "df+1",
        situation: situation({
          phase: "red-zone",
          distance: "their-face",
          layerAlive: true,
          opponent: "Alisa",
          vertex: "Press",
        }),
      },
      SEED_RULES,
    );
    const struck = judge(
      {
        ...reina,
        answer: "DF+1",
        situation: situation({
          phase: "red-zone",
          distance: "their-face",
          layerAlive: null,
          opponent: "Alisa",
        }),
      },
      SEED_RULES,
    );
    expect(blocked.outcome).toBe("match");
    expect(blocked.ruleId).toBe("red-zone-layer-1");
    expect(blocked.advice).toBeNull();
    expect(struck.outcome).toBe("match");
    expect(struck.ruleId).toBe(blocked.ruleId);
  });

  test("пустая дистанция не разобрана и без совета", () => {
    const verdict = judge(
      {
        ...reina,
        answer: "df+1",
        situation: situation({
          phase: "red-zone",
          distance: null,
          layerAlive: true,
          opponent: "Alisa",
        }),
      },
      SEED_RULES,
    );
    expect(verdict.outcome).toBe("unresolved");
    expect(verdict.advice).toBeNull();
    expect(verdict.ruleId).toBeNull();
    expect(verdict.phrase).toContain("Дистанция пустая");
    expect(verdict.phrase).not.toContain("джеб");
  });
});

describe("пол и матчап", () => {
  test("Law SEN.3 сверяется со строкой матчапа, не с красной зоной", () => {
    const verdict = judge(
      {
        ...reina,
        answer: "SEN.3",
        situation: situation({
          phase: "red-zone",
          distance: "their-face",
          stance: "SEN",
          opponent: "Law",
          layerAlive: true,
          vertex: "Press",
          gameIndex: 1,
        }),
      },
      SEED_RULES,
    );
    expect(verdict.outcome).toBe("mismatch");
    expect(verdict.ruleId).toBe("law-no-sen");
    expect(verdict.phrase).toContain("Law");
  });

  test("df+1 против Law вне SEN остаётся красной зоной", () => {
    const verdict = judge(
      {
        ...reina,
        answer: "df+1",
        situation: situation({
          phase: "red-zone",
          distance: "their-face",
          stance: "standing",
          opponent: "Law",
          layerAlive: true,
        }),
      },
      SEED_RULES,
    );
    expect(verdict.outcome).toBe("match");
    expect(verdict.ruleId).toBe("red-zone-layer-1");
  });

  test("их шаг закрывается хоумингом, не df+1", () => {
    const step = judge(
      {
        ...reina,
        answer: "df+1",
        situation: situation({
          phase: "red-zone",
          distance: "their-face",
          vertex: "Move",
          layerAlive: true,
          opponent: "Alisa",
        }),
      },
      SEED_RULES,
    );
    const homing = judge(
      {
        ...reina,
        answer: "b+2",
        situation: situation({
          phase: "red-zone",
          distance: "their-face",
          vertex: "Move",
          opponent: "Alisa",
        }),
      },
      SEED_RULES,
    );
    expect(step.outcome).toBe("mismatch");
    expect(step.ruleId).toBe("their-step-homing");
    expect(homing.outcome).toBe("match");
  });

  test("в открытом нейтрале степ не совпал, дашблок совпал", () => {
    const side = judge(
      { ...reina, answer: "степ", situation: situation({ distance: "open-neutral", opponent: "Alisa" }) },
      SEED_RULES,
    );
    const dash = judge(
      { ...reina, answer: "дашблок", situation: situation({ distance: "open-neutral", opponent: "Alisa" }) },
      SEED_RULES,
    );
    expect(side.outcome).toBe("mismatch");
    expect(side.ruleId).toBe("open-neutral");
    expect(dash.outcome).toBe("match");
  });

  test("счётчик не виден только когда число меняет слой", () => {
    const plus = judge(
      {
        ...reina,
        answer: "hellsweep",
        situation: situation({ phase: "my-plus", distance: "their-face", counter: null, opponent: "Alisa" }),
      },
      SEED_RULES,
    );
    const start = judge(
      {
        ...reina,
        answer: "hellsweep",
        situation: situation({ phase: "start", distance: "their-face", counter: null, opponent: "Alisa" }),
      },
      SEED_RULES,
    );
    const turtle = judge(
      {
        ...reina,
        answer: "hellsweep",
        situation: situation({ phase: "turtle", distance: "their-face", counter: null, opponent: "Alisa" }),
      },
      SEED_RULES,
    );
    const checked = judge(
      {
        ...reina,
        answer: "hellsweep",
        situation: situation({ phase: "my-plus", distance: "their-face", counter: 3, opponent: "Alisa" }),
      },
      SEED_RULES,
    );
    expect(plus.outcome).toBe("unresolved");
    expect(plus.advice).toBeNull();
    expect(plus.phrase).toContain("число закрытых лоу");
    expect(start.outcome).toBe("mismatch");
    expect(turtle.outcome).toBe("match");
    expect(checked.outcome).toBe("match");
    expect(checked.ruleId).toBe("plus-after-check");
  });

  test("после ws3,4 чужой ввод — исполнение, и дистанция не нужна", () => {
    const broken = judge(
      {
        ...reina,
        answer: "df+1",
        priorInput: "ws3,4",
        situation: situation({
          phase: "red-zone",
          distance: "their-face",
          layerAlive: true,
          opponent: "Alisa",
        }),
      },
      SEED_RULES,
    );
    const held = judge(
      {
        ...reina,
        answer: "f,F+2,F",
        priorInput: "ws34",
        situation: situation({ distance: null }),
      },
      SEED_RULES,
    );
    expect(broken.outcome).toBe("execution");
    expect(broken.ruleId).toBe("ws34-offline");
    expect(held.outcome).toBe("match");
  });

  test("WGF на месте electric — исполнение, блок электрика совпал", () => {
    const wgf = judge(
      {
        ...reina,
        answer: "WGF",
        situation: situation({ vertex: "Wait", distance: "mishima", phase: "red-zone", opponent: "Alisa" }),
      },
      SEED_RULES,
    );
    const electric = judge(
      {
        ...reina,
        answer: "electric",
        situation: situation({ vertex: "Wait", distance: "mishima", phase: "red-zone", opponent: "Alisa" }),
      },
      SEED_RULES,
    );
    expect(wgf.outcome).toBe("execution");
    expect(wgf.advice).toEqual(["EWGF"]);
    expect(electric.outcome).toBe("match");
  });

  test("чужой патч не становится уверенной ошибкой паниша", () => {
    const stale = judge(
      {
        ...reina,
        answer: "1",
        patch: "3.03.01",
        situation: situation({ opponent: "Law", theirMove: "d+2,3", distance: "mishima" }),
      },
      SEED_RULES,
    );
    const fresh = judge(
      {
        ...reina,
        answer: "1",
        patch: "3.02",
        situation: situation({ opponent: "Law", theirMove: "d+2,3", distance: "mishima" }),
      },
      SEED_RULES,
    );
    const punished = judge(
      {
        ...reina,
        answer: "EWGF",
        patch: "3.02",
        situation: situation({ opponent: "Law", theirMove: "d+2,3", distance: "mishima" }),
      },
      SEED_RULES,
    );
    expect(stale.outcome).toBe("unresolved");
    expect(stale.advice).toBeNull();
    expect(stale.framesUnverified).toBe(true);
    expect(stale.phrase).toContain("Кадры не сверены");
    expect(fresh.outcome).toBe("mismatch");
    expect(fresh.advice).toContain("df+2");
    expect(punished.outcome).toBe("match");
  });

  test("Heihachi в разбор не идёт", () => {
    const verdict = judge(
      {
        ...reina,
        playerCharacter: "Heihachi",
        answer: "df+1",
        situation: situation({ phase: "red-zone", distance: "their-face", layerAlive: true }),
      },
      SEED_RULES,
    );
    expect(verdict.outcome).toBe("skipped");
    expect(verdict.advice).toBeNull();
  });

  test("мёртвый слой красной зоны без имени следующего ответа — Wait", () => {
    const verdict = judge(
      {
        ...reina,
        answer: "df+1",
        situation: situation({
          phase: "red-zone",
          distance: "their-face",
          layerAlive: false,
          opponent: "Alisa",
        }),
      },
      SEED_RULES,
    );
    expect(verdict.outcome).toBe("mismatch");
    expect(verdict.ruleId).toBe("red-zone-countered");
    expect(verdict.advice).toEqual(["Wait"]);
  });
});

describe("учебный набор", () => {
  test("три первые строки учебного матча держат проверку", () => {
    const state = sampleState();
    const match = state.matches.find((item) => item.id === "tutorial");
    expect(match).toBeTruthy();
    const [hell, poke, empty] = match!.exchanges;
    expect(judge(inputFrom(match!, hell), state.rules).outcome).toBe("mismatch");
    expect(judge(inputFrom(match!, poke), state.rules).outcome).toBe("match");
    const blank = judge(inputFrom(match!, empty), state.rules);
    expect(blank.outcome).toBe("unresolved");
    expect(blank.advice).toBeNull();
  });
});

describe("правка", () => {
  test("«так и надо» переворачивает старые строки и бьёт общий пол", () => {
    const state = sampleState();
    const match = state.matches.find((item) => item.id === "tutorial")!;
    const hell = match.exchanges.find((item) => item.id === "t-hellsweep")!;
    const input = inputFrom(match, hell);
    const when = narrowWhen(input.situation, ["phase", "distance", "counter"]);
    const rule = finishRule(draftRule(input, state.rules, when, null), "floor", null, "edit-hell", "2026-11-22");
    const flips = previewFlips(state, rule);
    const overturned = flips.filter((flip) => flip.before !== flip.after);
    expect(overturned.some((flip) => flip.exchangeId === "t-hellsweep" && flip.after === "match")).toBe(true);
    const next = judge(input, [...state.rules, rule]);
    expect(next.outcome).toBe("match");
    expect(next.ruleId).toBe("edit-hell");
    expect(rule.sentence).toContain("правка называет");
    expect(rule.destination).toBe("floor");
  });

  test("привычка одного игрока пол не переписывает", () => {
    const state = sampleState();
    const match = state.matches.find((item) => item.id === "tutorial")!;
    const hell = match.exchanges.find((item) => item.id === "t-hellsweep")!;
    const before = judge(inputFrom(match, hell), state.rules);
    const habit = buildHabit("AngryByakko", "Alisa", narrowWhen(hell.situation, ["phase"]), hell.answer, "habit-1");
    const after = judge(inputFrom(match, hell), state.rules);
    expect(after).toEqual(before);
    expect(habit.sentence).toContain("Общий пол");
    expect(resolveScope("auto", "Law")).toBe("matchup");
    expect(resolveScope("auto", "Alisa")).toBe("floor");
    expect(resolveScope("person", "Law")).toBe("person");
  });
});

describe("слияние загрузки", () => {
  test("ручное поле новая загрузка не затирает, пустое дописывает", () => {
    const local = exchange({
      id: "e1",
      answer: "hellsweep",
      priorInput: null,
      note: "рука",
      situation: situation({ counter: 0, distance: null, phase: "my-plus" }),
    });
    const incoming = exchange({
      id: "e1",
      answer: "df+1",
      priorInput: "ws3,4",
      note: "мод",
      patch: "3.02",
      situation: situation({ counter: null, distance: "their-face", phase: null, opponent: "Alisa" }),
    });
    const merged = mergeExchange(local, incoming);
    expect(merged.answer).toBe("hellsweep");
    expect(merged.note).toBe("рука");
    expect(merged.situation.counter).toBe(0);
    expect(merged.situation.distance).toBe("their-face");
    expect(merged.situation.phase).toBe("my-plus");
    expect(merged.situation.opponent).toBe("Alisa");
    expect(merged.priorInput).toBe("ws3,4");
    expect(merged.patch).toBe("3.02");
  });

  test("своя правка с тем же id из файла не затирается", () => {
    const state = sampleState();
    const rule = finishRule(
      draftRule(
        {
          ...reina,
          answer: "hellsweep",
          situation: situation({ phase: "my-plus", distance: "their-face", counter: 0, opponent: "Alisa" }),
        },
        state.rules,
        { phase: "my-plus" },
        null,
      ),
      "floor",
      null,
      "edit-1",
      "2026-11-22",
    );
    const current: AppState = { ...state, rules: [...state.rules, { ...rule, sentence: "своя" }] };
    const merged = mergeImport(current, {
      edits: [{ ...rule, sentence: "чужая" }],
    });
    expect(merged.rules.find((item) => item.id === "edit-1")?.sentence).toBe("своя");
  });
});

describe("черновик", () => {
  test("не разобранные не голосуют, налог не становится разрешением, строка просит два матча", () => {
    const red = situation({
      phase: "red-zone",
      distance: "their-face",
      layerAlive: true,
      opponent: "Alisa",
      vertex: "Press",
    });
    const plus = situation({
      phase: "my-plus",
      distance: "their-face",
      counter: 0,
      opponent: "Alisa",
    });
    const blank = situation({ phase: "red-zone", opponent: "Alisa", layerAlive: true });
    const state: AppState = {
      ...sampleState(),
      matches: [
        {
          id: "a",
          playedAt: "2026-11-01T00:00:00",
          playerCharacter: "Reina",
          opponentCharacter: "Alisa",
          opponentPlayerId: "A",
          rounds: "2–1",
          rating: null,
          ratingDelta: null,
          patch: null,
          file: "manual",
          fixture: true,
          blurb: "",
          exchanges: [
            exchange({ id: "a1", order: 1, answer: "df+1", situation: red }),
            exchange({ id: "a2", order: 2, answer: "df+1", situation: blank }),
            exchange({ id: "a3", order: 3, answer: "hellsweep", situation: plus }),
            exchange({ id: "a4", order: 4, answer: "hellsweep", situation: plus }),
            exchange({ id: "a5", order: 5, answer: "hellsweep", situation: plus }),
          ],
        },
        {
          id: "b",
          playedAt: "2026-11-02T00:00:00",
          playerCharacter: "Reina",
          opponentCharacter: "Alisa",
          opponentPlayerId: "B",
          rounds: "2–0",
          rating: null,
          ratingDelta: null,
          patch: null,
          file: "manual",
          fixture: true,
          blurb: "",
          exchanges: [exchange({ id: "b1", order: 1, answer: "df+1", situation: red })],
        },
      ],
    };
    const report = buildDraft(state);
    expect(report.lines).toEqual([
      expect.objectContaining({ answer: "df+1", count: 2, matchIds: expect.arrayContaining(["a", "b"]) }),
    ]);
    expect(report.lines.some((line) => line.answer === "hellsweep")).toBe(false);
    expect(report.taxes.some((tax) => tax.answer === "hellsweep")).toBe(true);
    expect(report.counters).toHaveLength(1);
    expect(report.counters[0].count).toBe(3);
    expect(report.resolved).toBe(5);
  });
});
