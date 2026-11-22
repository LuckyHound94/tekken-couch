import { describe, expect, test } from "vitest";
import { cropFrame, type RgbaFrame } from "./frame";
import { findNameSlots, isolatePlate } from "./hud";

function frame(width: number, height: number, color: [number, number, number]): RgbaFrame {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = color[0];
    data[i + 1] = color[1];
    data[i + 2] = color[2];
    data[i + 3] = 255;
  }
  return { width, height, data };
}

function fill(image: RgbaFrame, x: number, y: number, w: number, h: number, color: [number, number, number]) {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(image.width, x + w);
  const y1 = Math.min(image.height, y + h);
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const i = (yy * image.width + xx) * 4;
      image.data[i] = color[0];
      image.data[i + 1] = color[1];
      image.data[i + 2] = color[2];
      image.data[i + 3] = 255;
    }
  }
}

const stage: [number, number, number] = [36, 58, 72];
const orange: [number, number, number] = [230, 130, 36];

function matchFrame(): RgbaFrame {
  const image = frame(960, 540, stage);
  fill(image, 114, 41, 316, 12, orange);
  fill(image, 530, 41, 316, 12, orange);
  return image;
}

describe("слоты имён", () => {
  test("имя слева лежит снаружи левой полоски, имя справа — снаружи правой", () => {
    const slots = findNameSlots(matchFrame());
    expect(slots).not.toBeNull();
    if (!slots) return;
    expect(slots.left.x + slots.left.width).toBeGreaterThan(114);
    expect(slots.left.x).toBeLessThan(114);
    expect(slots.left.y).toBeGreaterThan(40);
    expect(slots.right.x).toBeLessThan(846);
    expect(slots.right.x + slots.right.width).toBeGreaterThan(846);
    expect(slots.left.x + slots.left.width).toBeLessThan(slots.right.x);
  });

  test("кадр без полосок здоровья не называет стороны", () => {
    expect(findNameSlots(frame(960, 540, stage))).toBeNull();
  });

  test("короткая полоска у края всё ещё держит внешний край", () => {
    const image = frame(960, 540, stage);
    fill(image, 114, 41, 40, 12, orange);
    fill(image, 780, 41, 66, 12, orange);
    const slots = findNameSlots(image);
    expect(slots).not.toBeNull();
    if (!slots) return;
    expect(slots.left.x).toBeLessThan(114);
    expect(slots.right.x + slots.right.width).toBeGreaterThan(846);
  });

  test("чёрные поля по краям не съедают имя", () => {
    const inner = matchFrame();
    const image = frame(1120, 640, [0, 0, 0]);
    for (let y = 0; y < inner.height; y++) {
      const src = y * inner.width * 4;
      const dest = ((y + 50) * image.width + 80) * 4;
      image.data.set(inner.data.subarray(src, src + inner.width * 4), dest);
    }
    const slots = findNameSlots(image);
    expect(slots).not.toBeNull();
    if (!slots) return;
    expect(slots.left.x).toBeGreaterThanOrEqual(80);
    expect(slots.right.x + slots.right.width).toBeLessThanOrEqual(80 + inner.width);
  });
});

describe("плашка имени", () => {
  test("тёмная плашка отделяется от светлого фона", () => {
    const image = frame(120, 48, [180, 190, 200]);
    fill(image, 16, 20, 80, 16, [8, 10, 12]);
    fill(image, 30, 24, 8, 8, [230, 230, 230]);
    const plate = isolatePlate(image);
    expect(plate.y).toBeGreaterThan(8);
    expect(plate.y + plate.height).toBeLessThan(48);
    expect(plate.x).toBeGreaterThan(4);
    const tight = cropFrame(image, plate);
    expect(tight.width).toBeLessThan(120);
  });
});
