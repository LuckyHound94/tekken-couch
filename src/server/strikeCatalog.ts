import { normalizeMove } from "../domain/notation";
import type { StrikeCatalog } from "../domain/strikes";
import raw from "./strikeCatalog.json";

// Команды ударов Tekken 8. Свойства кадра сюда не входят: их подгружает следующий шаг.
// Срез команд: tekkendocs.com

let cached: StrikeCatalog | null = null;

function catalogTable(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.alisa) || Array.isArray(record.reina)) return record;
  const nested = record.default;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) return nested as Record<string, unknown>;
  return record;
}

export function strikeCatalog(): StrikeCatalog {
  if (cached) return cached;
  const map = new Map<string, Set<string>>();
  for (const [id, commands] of Object.entries(catalogTable(raw))) {
    if (!Array.isArray(commands)) continue;
    const book = new Set<string>();
    for (const command of commands) {
      if (typeof command !== "string") continue;
      const move = normalizeMove(command);
      if (move) book.add(move);
    }
    map.set(id, book);
  }
  cached = map;
  return map;
}
