import { luminance, pixel, type Rect, type RgbaFrame } from "./frame";

interface Bar {
  x0: number;
  x1: number;
  y1: number;
}

function stripLetterbox(frame: RgbaFrame): Rect {
  const { width: w, height: h } = frame;
  const rowBlack = (y: number) => {
    let sum = 0;
    let max = 0;
    let n = 0;
    for (let x = 0; x < w; x += 4) {
      const [r, g, b] = pixel(frame, x, y);
      const lum = r + g + b;
      sum += lum;
      if (lum > max) max = lum;
      n += 1;
    }
    return sum / n < 18 && max < 40;
  };
  const colBlack = (x: number) => {
    let sum = 0;
    let max = 0;
    let n = 0;
    for (let y = 0; y < h; y += 4) {
      const [r, g, b] = pixel(frame, x, y);
      const lum = r + g + b;
      sum += lum;
      if (lum > max) max = lum;
      n += 1;
    }
    return sum / n < 18 && max < 40;
  };
  let top = 0;
  while (top < h * 0.3 && rowBlack(top)) top += 1;
  let bottom = h - 1;
  while (bottom > h * 0.7 && rowBlack(bottom)) bottom -= 1;
  let left = 0;
  while (left < w * 0.3 && colBlack(left)) left += 1;
  let right = w - 1;
  while (right > w * 0.7 && colBlack(right)) right -= 1;
  return { x: left, y: top, width: right + 1 - left, height: bottom + 1 - top };
}

function warm(r: number, g: number, b: number): boolean {
  return r > 160 && g > 45 && g < 220 && b < 115 && r > g + 25 && r > b + 60;
}

function longestRun(ys: number[]): [number, number] | null {
  if (ys.length === 0) return null;
  let bestS = ys[0];
  let bestE = ys[0];
  let start = ys[0];
  let prev = ys[0];
  for (const y of [...ys.slice(1), null]) {
    if (y != null && y - prev <= 2) {
      prev = y;
      continue;
    }
    if (prev - start >= bestE - bestS) {
      bestS = start;
      bestE = prev;
    }
    if (y == null) break;
    start = y;
    prev = y;
  }
  return [bestS, bestE];
}

function findBars(frame: RgbaFrame, content: Rect): { left: Bar; right: Bar } | null {
  const cx0 = content.x;
  const cy0 = content.y;
  const cx1 = content.x + content.width;
  const cy1 = content.y + content.height;
  const cw = content.width;
  const ch = content.height;
  const sy0 = cy0 + Math.floor(ch * 0.015);
  const sy1 = Math.min(cy1, cy0 + Math.floor(ch * 0.22));
  if (sy1 - sy0 < 4) return null;
  const hist = new Array<number>(frame.width).fill(0);
  for (let y = sy0; y < sy1; y++) {
    for (let x = cx0; x < cx1; x++) {
      const [r, g, b] = pixel(frame, x, y);
      if (warm(r, g, b)) hist[x] += 1;
    }
  }
  const band = Math.max(1, sy1 - sy0);
  const thresh = Math.max(4, Math.floor(band * 0.08));
  const cols: number[] = [];
  for (let x = 0; x < hist.length; x++) if (hist[x] >= thresh) cols.push(x);
  const groups: Array<[number, number]> = [];
  if (cols.length) {
    let start = cols[0];
    let prev = cols[0];
    const gap = Math.max(6, Math.floor(cw * 0.01));
    for (const x of cols.slice(1)) {
      if (x - prev > gap) {
        groups.push([start, prev]);
        start = x;
      }
      prev = x;
    }
    groups.push([start, prev]);
  }
  const minw = Math.max(12, Math.floor(cw * 0.018));
  const bars: Bar[] = [];
  for (const [a, b] of groups) {
    if (b - a < minw) continue;
    const mid = (a + b) / 2;
    if (Math.abs(mid - (cx0 + cw / 2)) < cw * 0.08) continue;
    const ys: number[] = [];
    const rowThresh = Math.max(3, ((b - a) / 2) * 0.25);
    for (let y = sy0; y < sy1; y++) {
      let count = 0;
      for (let x = a; x <= b; x += 2) {
        const [r, g, bch] = pixel(frame, x, y);
        if (warm(r, g, bch)) count += 1;
      }
      if (count >= rowThresh) ys.push(y);
    }
    const run = longestRun(ys);
    if (!run || ys.length < 3) continue;
    bars.push({ x0: a, x1: b, y1: run[1] });
  }
  const lefts = bars.filter((bar) => bar.x1 < cx0 + cw * 0.55);
  const rights = bars.filter((bar) => bar.x0 > cx0 + cw * 0.45);
  if (lefts.length === 0 || rights.length === 0) return null;
  const left = lefts.reduce((best, bar) => (bar.x1 - bar.x0 > best.x1 - best.x0 ? bar : best));
  const right = rights.reduce((best, bar) => (bar.x1 - bar.x0 > best.x1 - best.x0 ? bar : best));
  if (right.x0 <= left.x1) return null;
  return { left, right };
}

function nameSlot(bar: Bar, side: "left" | "right", content: Rect, frame: RgbaFrame): Rect | null {
  const cw = content.width;
  const ch = content.height;
  const padOut = Math.floor(cw * 0.16);
  const padIn = Math.floor(cw * 0.06);
  const top = bar.y1 - Math.floor(ch * 0.01);
  const bottom = bar.y1 + Math.floor(ch * 0.07);
  const x0 = side === "left" ? Math.max(content.x, bar.x0 - padOut) : Math.max(content.x, bar.x1 - padIn);
  const x1 = side === "left" ? Math.min(content.x + content.width, bar.x0 + padIn) : Math.min(content.x + content.width, bar.x1 + padOut);
  const y0 = Math.max(0, top);
  const y1 = Math.min(frame.height, bottom);
  if (x1 - x0 < 8 || y1 - y0 < 8) return null;
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

export function findNameSlots(frame: RgbaFrame): { left: Rect; right: Rect } | null {
  if (frame.width < 64 || frame.height < 64) return null;
  const content = stripLetterbox(frame);
  if (content.width < 64 || content.height < 64) return null;
  const bars = findBars(frame, content);
  if (!bars) return null;
  const left = nameSlot(bars.left, "left", content, frame);
  const right = nameSlot(bars.right, "right", content, frame);
  if (!left || !right) return null;
  return { left, right };
}

export function cornerNameSlots(frame: RgbaFrame): { left: Rect; right: Rect } {
  const { width: w, height: h } = frame;
  const leftWidth = Math.round(w * 0.083);
  const left = {
    x: Math.round(w * 0.019),
    y: Math.round(h * 0.069),
    width: leftWidth,
    height: Math.round(h * 0.05),
  };
  const rightWidth = Math.round(w * 0.1);
  const right = {
    x: w - Math.round(w * 0.019) - rightWidth,
    y: Math.round(h * 0.072),
    width: rightWidth,
    height: Math.round(h * 0.045),
  };
  return { left, right };
}

export function isolatePlate(crop: RgbaFrame): Rect {
  const { width: w, height: h } = crop;
  if (w === 0 || h === 0) return { x: 0, y: 0, width: w, height: h };
  const rows: number[] = [];
  for (let y = 0; y < h; y++) {
    let dark = 0;
    for (let x = 0; x < w; x++) {
      const [r, g, b] = pixel(crop, x, y);
      if (luminance(r, g, b) < 55) dark += 1;
    }
    if (dark >= w * 0.22) rows.push(y);
  }
  const run = longestRun(rows);
  if (!run || rows.length < 3) return { x: 0, y: 0, width: w, height: h };
  const [y0, y1] = run;
  const band = y1 - y0 + 1;
  const cols: number[] = [];
  for (let x = 0; x < w; x++) {
    let dark = 0;
    for (let y = y0; y <= y1; y++) {
      const [r, g, b] = pixel(crop, x, y);
      if (luminance(r, g, b) < 60) dark += 1;
    }
    if (dark > band * 0.28) cols.push(x);
  }
  if (cols.length < 8) return { x: 0, y: 0, width: w, height: h };
  const x0 = Math.max(0, cols[0] - 2);
  const x1 = Math.min(w - 1, cols[cols.length - 1] + 2);
  const yy0 = Math.max(0, y0 - 2);
  const yy1 = Math.min(h - 1, y1 + 3);
  return { x: x0, y: yy0, width: x1 - x0 + 1, height: yy1 - yy0 + 1 };
}
