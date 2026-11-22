import { describe, expect, test } from "vitest";
import { formatClock, sampleTimes, settleSides, type SideRead } from "./sides";

function read(time: number, left: string | null, right: string | null): SideRead {
  return { time, left, right };
}

describe("стороны по ролику", () => {
  test("одна и та же пара держится одним отрезком", () => {
    const settled = settleSides([
      read(1, "reina", "alisa"),
      read(2, "reina", null),
      read(3, "reina", "alisa"),
    ]);
    expect(settled.segments).toEqual([{ start: 1, end: 3, left: "reina", right: "alisa" }]);
  });

  test("смена сторон остаётся двумя отрезками", () => {
    const settled = settleSides([
      read(0.2, "reina", "alisa"),
      read(1, "reina", "alisa"),
      read(2.4, "alisa", "reina"),
      read(3.5, "alisa", "reina"),
    ]);
    expect(settled.segments.map((segment) => [segment.left, segment.right])).toEqual([
      ["reina", "alisa"],
      ["alisa", "reina"],
    ]);
  });

  test("один чужой кадр между одинаковыми не становится сменой", () => {
    const settled = settleSides([
      read(0, "reina", "alisa"),
      read(1, "reina", "alisa"),
      read(2, "kazuya", "jin"),
      read(3, "reina", "alisa"),
      read(4, "reina", "alisa"),
    ]);
    expect(settled.segments.every((segment) => segment.left === "reina" && segment.right === "alisa")).toBe(true);
  });

  test("единственный прочитанный кадр сохраняется", () => {
    const settled = settleSides([read(1.5, "jin", null), read(2, null, null)]);
    expect(settled.segments).toEqual([{ start: 1.5, end: 1.5, left: "jin", right: null }]);
  });

  test("пустой ролик никого не называет", () => {
    expect(settleSides([read(0, null, null)]).segments).toEqual([]);
  });
});

describe("кадры и часы", () => {
  test("времена лежат внутри ролика и идут по порядку", () => {
    const times = sampleTimes(60);
    expect(times.length).toBeGreaterThanOrEqual(4);
    expect(times.length).toBeLessThanOrEqual(12);
    expect(times[0]).toBeGreaterThan(0);
    expect(times[times.length - 1]).toBeLessThan(60);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  test("пустая длина даёт один кадр", () => {
    expect(sampleTimes(Number.NaN)).toEqual([0]);
    expect(formatClock(65)).toBe("1:05");
  });
});
