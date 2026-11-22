export interface RgbaFrame {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export function pixel(frame: RgbaFrame, x: number, y: number): [number, number, number] {
  const i = (y * frame.width + x) * 4;
  return [frame.data[i], frame.data[i + 1], frame.data[i + 2]];
}

export function cropFrame(frame: RgbaFrame, rect: Rect): RgbaFrame {
  const x0 = Math.max(0, Math.min(frame.width, rect.x));
  const y0 = Math.max(0, Math.min(frame.height, rect.y));
  const x1 = Math.max(x0, Math.min(frame.width, rect.x + rect.width));
  const y1 = Math.max(y0, Math.min(frame.height, rect.y + rect.height));
  const width = x1 - x0;
  const height = y1 - y0;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const src = ((y0 + y) * frame.width + x0) * 4;
    data.set(frame.data.subarray(src, src + width * 4), y * width * 4);
  }
  return { width, height, data };
}
