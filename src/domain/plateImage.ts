import { cropFrame, luminance, type Rect, type RgbaFrame } from "./frame";
import { isolatePlate } from "./hud";

function gray(frame: RgbaFrame): RgbaFrame {
  const data = new Uint8ClampedArray(frame.data.length);
  for (let i = 0; i < frame.data.length; i += 4) {
    const v = Math.round(luminance(frame.data[i], frame.data[i + 1], frame.data[i + 2]));
    data[i] = data[i + 1] = data[i + 2] = v;
    data[i + 3] = 255;
  }
  return { width: frame.width, height: frame.height, data };
}

function lanczos(x: number, radius: number): number {
  const ax = Math.abs(x);
  if (ax >= radius) return 0;
  if (ax < 1e-6) return 1;
  const pix = Math.PI * x;
  return (radius * Math.sin(pix) * Math.sin(pix / radius)) / (pix * pix);
}

function scaleGray(frame: RgbaFrame, scale: number): RgbaFrame {
  const radius = 3;
  const width = Math.max(1, frame.width * scale);
  const height = Math.max(1, frame.height * scale);
  const data = new Uint8ClampedArray(width * height * 4);
  const sw = frame.width;
  const sh = frame.height;
  for (let y = 0; y < height; y++) {
    const fy = (y + 0.5) / scale - 0.5;
    const yStart = Math.floor(fy) - radius + 1;
    const yEnd = Math.floor(fy) + radius;
    for (let x = 0; x < width; x++) {
      const fx = (x + 0.5) / scale - 0.5;
      const xStart = Math.floor(fx) - radius + 1;
      const xEnd = Math.floor(fx) + radius;
      let acc = 0;
      let norm = 0;
      for (let sy = yStart; sy <= yEnd; sy++) {
        const wy = lanczos(fy - sy, radius);
        if (wy === 0) continue;
        const cy = Math.min(sh - 1, Math.max(0, sy));
        for (let sx = xStart; sx <= xEnd; sx++) {
          const wx = lanczos(fx - sx, radius);
          if (wx === 0) continue;
          const cx = Math.min(sw - 1, Math.max(0, sx));
          const weight = wx * wy;
          acc += frame.data[(cy * sw + cx) * 4] * weight;
          norm += weight;
        }
      }
      const g = Math.max(0, Math.min(255, Math.round(norm === 0 ? 0 : acc / norm)));
      const o = (y * width + x) * 4;
      data[o] = data[o + 1] = data[o + 2] = g;
      data[o + 3] = 255;
    }
  }
  return { width, height, data };
}

function thresholdPad(frame: RgbaFrame, threshold: number, pad: number): RgbaFrame {
  const width = frame.width + pad * 2;
  const height = frame.height + pad * 2;
  const data = new Uint8ClampedArray(width * height * 4);
  data.fill(255);
  for (let y = 0; y < frame.height; y++) {
    for (let x = 0; x < frame.width; x++) {
      const v = frame.data[(y * frame.width + x) * 4];
      const ink = v > threshold ? 0 : 255;
      const o = ((y + pad) * width + (x + pad)) * 4;
      data[o] = data[o + 1] = data[o + 2] = ink;
      data[o + 3] = 255;
    }
  }
  return { width, height, data };
}

export function scaledCrop(frame: RgbaFrame, slot: Rect): RgbaFrame {
  const crop = gray(cropFrame(frame, slot));
  if (crop.width < 2 || crop.height < 2) return crop;
  return scaleGray(crop, 5);
}

export function scaledPlate(frame: RgbaFrame, slot: Rect): RgbaFrame {
  const crop = gray(cropFrame(frame, slot));
  if (crop.width < 2 || crop.height < 2) return crop;
  const plate = isolatePlate(crop);
  return scaleGray(cropFrame(crop, plate), 5);
}

export function inkPlate(scaled: RgbaFrame, threshold: number): RgbaFrame {
  return thresholdPad(scaled, threshold, 32);
}
