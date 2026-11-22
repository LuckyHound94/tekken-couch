import { normalizeMove } from "./notation";
import { strikeCommands } from "../server/strikeCatalogData";

export interface HitSpec {
  limb: string;
  low: boolean;
  high: boolean;
  back: boolean;
  forward: boolean;
}

export interface MovePattern {
  move: string;
  hits: HitSpec[];
  rising: boolean;
  crouched: boolean;
  dash: boolean;
  crouchDash: boolean;
  stance: boolean;
}

const PREFIXES = [
  "CLK(Twospins).",
  "H.WRA.",
  "DES.BT.",
  "SSH.CH.",
  "SSH.",
  "SEN.",
  "WGS.",
  "WRA.",
  "DES.",
  "DBT.",
  "BKP.",
  "SBT.",
  "UNS.",
  "WDS.",
  "hFC.",
  "FUFT.",
  "FC.",
  "OTG.",
  "CLK.",
  "BT.",
  "SS.",
  "CH.",
  "H.",
  "R.",
].sort((a, b) => b.length - a.length);

function blank(move: string): MovePattern {
  return { move, hits: [], rising: false, crouched: false, dash: false, crouchDash: false, stance: false };
}

function parsePart(part: string): HitSpec | null {
  const matched = /^(ub|uf|db|df|u|d|b|f)?\+?([1-4](?:\+[1-4]){0,3})?$/i.exec(part);
  if (!matched || (!matched[1] && !matched[2])) return null;
  const dir = (matched[1] ?? "").toLowerCase();
  const limb = matched[2] ? matched[2].split("+").sort().join("+") : "body";
  return {
    limb,
    low: dir === "d" || dir === "db",
    high: dir === "u" || dir === "uf" || dir === "ub",
    back: dir === "b" || dir === "db" || dir === "ub",
    forward: dir === "f" || dir === "df",
  };
}

export function parseCommand(raw: string): MovePattern | null {
  const move = normalizeMove(raw);
  if (!move) return null;
  if (/throw/i.test(raw)) {
    const pattern = blank(move);
    const left = /left/i.test(raw);
    const right = /right/i.test(raw);
    pattern.hits.push({
      limb: left ? "1+3" : right ? "2+4" : "1+3",
      low: false,
      high: false,
      back: /back/i.test(raw),
      forward: false,
    });
    pattern.stance = /back/i.test(raw);
    return pattern;
  }
  let body = raw.trim().replace(/\s+/g, "").replace(/\*/g, "");
  while (/(\d)\.(\d)/.test(body)) body = body.replace(/(\d)\.(\d)/g, "$1,$2");
  const pattern = blank(move);
  for (let guard = 0; guard < 4; guard++) {
    const prefix = PREFIXES.find((item) => body.toLowerCase().startsWith(item.toLowerCase()));
    if (!prefix) break;
    const name = prefix.toLowerCase();
    if (name.startsWith("hfc") || name.startsWith("fc")) pattern.crouched = true;
    else if (name.includes("wgs")) pattern.crouchDash = true;
    else pattern.stance = true;
    if (name.includes("wra")) pattern.dash = true;
    body = body.slice(prefix.length);
  }
  if (/^ws/i.test(body)) {
    pattern.rising = true;
    body = body.slice(2).replace(/^\./, "");
  }
  body = body.replace(/,p$/i, "");
  if (/^f,n,d,df:/i.test(body)) {
    pattern.crouchDash = true;
    body = body.replace(/^f,n,d,df:/i, "");
  } else if (/^f,f,f\+/i.test(body)) {
    pattern.dash = true;
    body = body.replace(/^f,f,f\+/i, "");
  } else if (/^f,f\+/i.test(body)) {
    pattern.dash = true;
    body = body.replace(/^f,f\+/i, "");
  } else if (/^d,db,b,f\+/i.test(body)) {
    pattern.crouchDash = true;
    body = body.replace(/^d,db,b,f\+/i, "");
  } else if (/^b,b\+/i.test(body)) {
    body = body.replace(/^b,b\+/i, "b+");
  } else if (/^b,b,/i.test(body)) {
    pattern.stance = true;
    body = body.replace(/^b,b,/i, "");
  }
  body = body.replace(/~/g, ",");
  if (!body) return null;
  const parts = body.split(",").filter(Boolean);
  for (const part of parts) {
    const hit = parsePart(part);
    if (!hit) return null;
    if (pattern.crouchDash && /[34]/.test(hit.limb) && (hit.forward || hit.low)) hit.low = true;
    pattern.hits.push(hit);
  }
  return pattern.hits.length ? pattern : null;
}

const BOOKS = new Map<string, MovePattern[]>();

export function patternsFor(characterId: string): MovePattern[] {
  const cached = BOOKS.get(characterId);
  if (cached) return cached;
  const patterns: MovePattern[] = [];
  for (const command of strikeCommands[characterId] ?? []) {
    const pattern = parseCommand(command);
    if (pattern) patterns.push(pattern);
  }
  BOOKS.set(characterId, patterns);
  return patterns;
}
