import { describe, expect, test } from "vitest";
import { sampleState } from "./sample";
import { exportPayload, hydrate } from "./storage";
import { nameStrike, parseVideoRead, settleStrikes, type MoveRead, type StrikeCatalog } from "./strikes";
import { strikeCatalog } from "../server/strikeCatalog";

const book: StrikeCatalog = new Map([
  ["reina", new Set(["df+1", "1", "hellsweep"])],
  ["alisa", new Set(["1", "2"])],
]);

function read(
  time: number,
  leftCharacter: string | null,
  rightCharacter: string | null,
  leftLines: string[],
  rightLines: string[],
): MoveRead {
  return { time, leftCharacter, rightCharacter, leftLines, rightLines };
}

describe("имя удара", () => {
  test("команда называется, только если она есть у этого персонажа", () => {
    const catalog = strikeCatalog();
    expect(nameStrike("reina", "DF + 1", catalog)).toBe("df+1");
    expect(nameStrike("reina", "WGS.DF+4", catalog)).toBe("hellsweep");
    expect(nameStrike("reina", "hellsweep", catalog)).toBe("hellsweep");
    expect(nameStrike("alisa", "hellsweep", catalog)).toBeNull();
    expect(nameStrike("alisa", "1", catalog)).toBe("1");
    expect(nameStrike("reina", "KBD", catalog)).toBeNull();
    expect(nameStrike("reina", "df+1!", catalog)).toBeNull();
    expect(nameStrike(null, "df+1", catalog)).toBeNull();
    expect(nameStrike("нет-такого", "df+1", catalog)).toBeNull();
  });
});

describe("удары по кадрам", () => {
  test("та же колонка не повторяется, новая строка добавляется, смена персонажа не склеивается", () => {
    const strikes = settleStrikes(
      [
        read(0.2, "reina", "alisa", ["KBD", "DF + 1"], ["1", "ZZZ"]),
        read(1.4, "reina", "alisa", ["KBD", "DF + 1"], ["1", "ZZZ"]),
        read(2.6, "alisa", "reina", ["2", "1"], ["DF + 2"]),
      ],
      book,
    );
    expect(strikes).toEqual([
      { time: 0.2, side: "left", characterId: "reina", move: "df+1" },
      { time: 0.2, side: "right", characterId: "alisa", move: "1" },
      { time: 2.6, side: "left", characterId: "alisa", move: "1" },
      { time: 2.6, side: "left", characterId: "alisa", move: "2" },
    ]);
  });

  test("пустой кадр не стирает уже прочитанный удар и не достраивает дыру", () => {
    const strikes = settleStrikes(
      [
        read(0, "reina", null, ["df+1"], []),
        read(1, "reina", null, [], []),
        read(2, "reina", null, ["1", "df+1"], []),
      ],
      book,
    );
    expect(strikes.map((item) => item.move)).toEqual(["df+1", "1"]);
  });
});

describe("запись ролика", () => {
  test("целая запись возвращается, битая отбрасывается", () => {
    const video = {
      segments: [{ start: 1, end: 2, left: "reina" as const, right: null }],
      strikes: [{ time: 1, side: "left" as const, characterId: "reina", move: "df+1" }],
    };
    expect(parseVideoRead(video)).toEqual(video);
    expect(parseVideoRead({ segments: [], strikes: [{ time: 1, side: "up", characterId: "reina", move: "df+1" }] })).toBeNull();
    const next = hydrate(exportPayload({ ...sampleState(), video }));
    expect(next.video).toEqual(video);
    expect(hydrate(exportPayload(sampleState())).video).toBeNull();
  });
});
