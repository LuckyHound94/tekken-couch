import { settleStrikes, type MoveRead, type Strike } from "../domain/strikes";
import { strikeCatalog } from "../server/strikeCatalog";

function namedLocally(reads: MoveRead[]): Strike[] {
  return settleStrikes(reads, strikeCatalog());
}

export async function nameStrikes(reads: MoveRead[], signal: AbortSignal): Promise<Strike[]> {
  try {
    const response = await fetch("/api/moves", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reads }),
      signal,
    });
    if (response.ok) {
      const body = (await response.json()) as { strikes?: unknown };
      if (Array.isArray(body.strikes)) return body.strikes as Strike[];
    }
  } catch (error) {
    if (signal.aborted) throw error;
  }
  return namedLocally(reads);
}
