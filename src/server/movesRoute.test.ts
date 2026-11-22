import { describe, expect, test } from "vitest";
import { movesResponse } from "./movesRoute";

function post(body: unknown): Request {
  return new Request("http://127.0.0.1/api/moves", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("каталог ударов", () => {
  test("строка называется по персонажу кадра, движение и чужая строка нет", async () => {
    const response = await movesResponse(
      post({
        reads: [
          {
            time: 0.2,
            leftCharacter: "reina",
            rightCharacter: "alisa",
            leftLines: ["KBD", "DF + 1"],
            rightLines: ["1", "ZZZ"],
          },
          {
            time: 1.4,
            leftCharacter: "reina",
            rightCharacter: "alisa",
            leftLines: ["KBD", "DF + 1"],
            rightLines: ["1", "ZZZ"],
          },
          {
            time: 2.6,
            leftCharacter: "alisa",
            rightCharacter: "reina",
            leftLines: ["2", "1"],
            rightLines: ["DF + 2"],
          },
        ],
      }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { strikes: Array<{ move: string; characterId: string; side: string }> };
    expect(body.strikes).toEqual([
      { time: 0.2, side: "left", characterId: "reina", move: "df+1" },
      { time: 0.2, side: "right", characterId: "alisa", move: "1" },
      { time: 2.6, side: "left", characterId: "alisa", move: "1" },
      { time: 2.6, side: "left", characterId: "alisa", move: "2" },
      { time: 2.6, side: "right", characterId: "reina", move: "df+2" },
    ]);
  });

  test("лишние и битые строки кадра не срывают сверку", async () => {
    const noise = ["QQQ", "XXXX", "YYYY", "ZZZZ", "AAAA", "BBBB", "CCCC", "DDDD", "EEEE"];
    const response = await movesResponse(
      post({
        reads: [
          {
            time: 0.4,
            leftCharacter: "reina",
            rightCharacter: "alisa",
            leftLines: ["DF + 1", ...noise, "x".repeat(80), 7],
            rightLines: ["1"],
          },
        ],
      }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { strikes: Array<{ move: string; characterId: string }> };
    expect(body.strikes).toEqual([
      { time: 0.4, side: "left", characterId: "reina", move: "df+1" },
      { time: 0.4, side: "right", characterId: "alisa", move: "1" },
    ]);
  });

  test("чужое тело не принимается", async () => {
    const response = await movesResponse(post({ reads: [{ time: "сейчас" }] }));
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("Каталог");
  });
});
