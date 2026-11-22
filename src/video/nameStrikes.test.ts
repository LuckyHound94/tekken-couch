import { describe, expect, test } from "vitest";
import { nameStrikes } from "./nameStrikes";

describe("имя удара без ответа каталога", () => {
  test("строка сверяется тем же списком, отказ не всплывает", async () => {
    const strikes = await nameStrikes(
      [
        {
          time: 0.2,
          leftCharacter: "reina",
          rightCharacter: "alisa",
          leftLines: ["DF + 1", "KBD"],
          rightLines: ["1"],
        },
      ],
      new AbortController().signal,
    );
    expect(strikes).toEqual([
      { time: 0.2, side: "left", characterId: "reina", move: "df+1" },
      { time: 0.2, side: "right", characterId: "alisa", move: "1" },
    ]);
  });
});
