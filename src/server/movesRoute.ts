import { settleStrikes, type MoveRead, type Strike } from "../domain/strikes";
import { strikeCatalog } from "./strikeCatalog";

const REFUSED = "Каталог не принял эту запись.";
const MAX_BODY = 96 * 1024;
const MAX_READS = 48;
const MAX_LINES = 16;
const MAX_LINE = 40;

function jsonError(status: number, error: string): Response {
  return Response.json({ error }, { status, headers: { "cache-control": "no-store" } });
}

function character(value: unknown): string | null | undefined {
  if (value == null) return null;
  if (typeof value !== "string" || !/^[a-z0-9-]{1,32}$/.test(value)) return undefined;
  return value;
}

function lines(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: string[] = [];
  for (const item of value) {
    if (out.length >= MAX_LINES) break;
    if (typeof item !== "string") continue;
    const text = item.trim();
    if (!text || text.length > MAX_LINE) continue;
    out.push(text);
  }
  return out;
}

function readsFrom(payload: unknown): MoveRead[] | null {
  if (!payload || typeof payload !== "object" || !("reads" in payload)) return null;
  const reads = payload.reads;
  if (!Array.isArray(reads) || reads.length > MAX_READS) return null;
  const out: MoveRead[] = [];
  for (const item of reads) {
    if (!item || typeof item !== "object") return null;
    const row = item as {
      time?: unknown;
      leftCharacter?: unknown;
      rightCharacter?: unknown;
      leftLines?: unknown;
      rightLines?: unknown;
    };
    if (typeof row.time !== "number" || !Number.isFinite(row.time) || row.time < 0 || row.time > 60 * 60) return null;
    const leftCharacter = character(row.leftCharacter);
    const rightCharacter = character(row.rightCharacter);
    const leftLines = lines(row.leftLines);
    const rightLines = lines(row.rightLines);
    if (leftCharacter === undefined || rightCharacter === undefined || !leftLines || !rightLines) return null;
    out.push({ time: row.time, leftCharacter, rightCharacter, leftLines, rightLines });
  }
  return out;
}

export function movesResponse(request: Request, body?: unknown): Response | Promise<Response> {
  if (request.method !== "POST") return jsonError(405, REFUSED);
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY) return jsonError(400, REFUSED);
  if (body !== undefined) return answer(body);
  return request
    .text()
    .then((text) => {
      if (text.length > MAX_BODY) return jsonError(400, REFUSED);
      try {
        return answer(JSON.parse(text) as unknown);
      } catch {
        return jsonError(400, REFUSED);
      }
    })
    .catch(() => jsonError(400, REFUSED));
}

function answer(payload: unknown): Response {
  const reads = readsFrom(payload);
  if (!reads) return jsonError(400, REFUSED);
  try {
    const strikes: Strike[] = settleStrikes(reads, strikeCatalog());
    return Response.json({ strikes }, { headers: { "cache-control": "no-store" } });
  } catch {
    return jsonError(500, REFUSED);
  }
}

export function POST(request: Request): Promise<Response> {
  return Promise.resolve(movesResponse(request));
}
