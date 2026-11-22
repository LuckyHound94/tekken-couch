import type { MoveRead, Strike } from "../domain/strikes";

export async function nameStrikes(reads: MoveRead[], signal: AbortSignal): Promise<Strike[]> {
  const response = await fetch("/api/moves", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ reads }),
    signal,
  });
  if (!response.ok) throw new Error("catalog");
  const body = (await response.json()) as { strikes?: unknown };
  if (!Array.isArray(body.strikes)) throw new Error("catalog");
  return body.strikes as Strike[];
}
