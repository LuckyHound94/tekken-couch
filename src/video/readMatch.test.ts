import { describe, expect, test } from "vitest";
import { poseSampleCount } from "./readMatch";

describe("поза читается на всём матче", () => {
  test("десятиминутный ролик не обрывается на первой полутора минутах", () => {
    expect((poseSampleCount(10 * 60) - 1) * 0.1).toBeGreaterThanOrEqual(10 * 60 - 0.1);
    expect(poseSampleCount(25 * 60)).toBe(poseSampleCount(20 * 60));
  });
});
