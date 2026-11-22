import { normalizeMove } from "../domain/notation";
import type { StrikeCatalog } from "../domain/strikes";
import { strikeCommands } from "./strikeCatalogData";

let cached: StrikeCatalog | null = null;

export function strikeCatalog(): StrikeCatalog {
  if (cached) return cached;
  const map = new Map<string, Set<string>>();
  for (const [id, commands] of Object.entries(strikeCommands)) {
    const book = new Set<string>();
    for (const command of commands) {
      const move = normalizeMove(command);
      if (move) book.add(move);
    }
    map.set(id, book);
  }
  cached = map;
  return map;
}
