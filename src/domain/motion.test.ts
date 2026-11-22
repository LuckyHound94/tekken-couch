import { describe, expect, test } from "vitest";
import { attachAnimatedStrikes, findAnimatedStrikes, type MotionFrame } from "./motion";

function gray(width: number, height: number, color: number): Uint8Array {
  return new Uint8Array(width * height).fill(color);
}

function fill(frame: MotionFrame, x: number, y: number, w: number, h: number, color: number) {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(frame.width, x + w);
  const y1 = Math.min(frame.height, y + h);
  for (let yy = y0; yy < y1; yy++) {
    frame.gray.fill(color, yy * frame.width + x0, yy * frame.width + x1);
  }
}

function frame(time: number, paint: (image: MotionFrame) => void): MotionFrame {
  const image = { time, width: 80, height: 45, gray: gray(80, 45, 30) };
  paint(image);
  return image;
}

function still(time: number, leftX: number): MotionFrame {
  return frame(time, (image) => {
    fill(image, leftX, 14, 14, 18, 210);
    fill(image, 58, 14, 14, 18, 160);
  });
}

describe("удар по анимации", () => {
  test("резкий выпад одной стороны становится ударом, шаг и общий скачок нет", () => {
    const lunge: MotionFrame[] = [];
    for (let i = 0; i < 5; i++) lunge.push(still(i * 0.1, 8));
    lunge.push(still(0.5, 22));
    for (let i = 6; i < 10; i++) lunge.push(still(i * 0.1, 22));
    expect(findAnimatedStrikes(lunge)).toEqual([{ time: 0.5, side: "left" }]);

    const walk: MotionFrame[] = [];
    for (let i = 0; i < 12; i++) walk.push(still(i * 0.1, 8 + i));
    expect(findAnimatedStrikes(walk)).toEqual([]);

    const cut = [still(0, 8), frame(0.1, (image) => fill(image, 0, 0, 80, 45, 200)), still(0.2, 8)];
    expect(findAnimatedStrikes(cut)).toEqual([]);

    const far = [still(0, 8), still(1, 22)];
    expect(findAnimatedStrikes(far)).toEqual([]);
  });

  test("видимый удар садится на названную сторону и не затирает команду", () => {
    const strikes = attachAnimatedStrikes(
      [{ time: 0.2, side: "left", characterId: "reina", move: "df+1" }],
      [
        { time: 0.3, side: "left" },
        { time: 1.2, side: "right" },
        { time: 1.4, side: "left" },
      ],
      [{ start: 0, end: 2, left: "reina", right: "alisa" }],
    );
    expect(strikes).toEqual([
      { time: 0.2, side: "left", characterId: "reina", move: "df+1" },
      { time: 1.2, side: "right", characterId: "alisa", move: "seen-strike" },
      { time: 1.4, side: "left", characterId: "reina", move: "seen-strike" },
    ]);
  });
});
