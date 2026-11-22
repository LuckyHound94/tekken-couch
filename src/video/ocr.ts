import { createWorker, PSM } from "tesseract.js";
import type { RgbaFrame } from "../domain/frame";

let pending: Promise<Tesseract.Worker> | null = null;

async function worker(): Promise<Tesseract.Worker> {
  if (!pending) {
    const created = createWorker("eng", 1);
    pending = created.then(async (instance) => {
      await instance.setParameters({
        tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
        tessedit_pageseg_mode: PSM.SINGLE_LINE,
      });
      return instance;
    });
    pending.catch(() => {
      pending = null;
    });
  }
  return pending;
}

function canvasFrom(frame: RgbaFrame): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = frame.width;
  canvas.height = frame.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  const copy = new Uint8ClampedArray(frame.data);
  ctx.putImageData(new ImageData(copy, frame.width, frame.height), 0, 0);
  return canvas;
}

export async function readPlate(frame: RgbaFrame): Promise<string> {
  const instance = await worker();
  const result = await instance.recognize(canvasFrom(frame));
  return result.data.text ?? "";
}
