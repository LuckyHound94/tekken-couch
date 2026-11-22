import { youtubeVideoId } from "../domain/youtube";
import { loadYoutubeVideo, type YoutubeFailure, type YoutubeFile } from "./youtubeVideo";

const BAD_LINK = "Нужна ссылка на ролик YouTube.";

export type YoutubeLoader = (id: string, signal: AbortSignal) => Promise<YoutubeFile | YoutubeFailure>;

function jsonError(status: number, error: string): Response {
  return Response.json({ error }, { status, headers: { "cache-control": "no-store" } });
}

export async function youtubeResponse(request: Request, load: YoutubeLoader = loadYoutubeVideo): Promise<Response> {
  if (request.method !== "POST") return jsonError(405, BAD_LINK);
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > 2048) return jsonError(400, BAD_LINK);
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError(400, BAD_LINK);
  }
  const raw = typeof payload === "object" && payload && "url" in payload ? payload.url : "";
  const id = typeof raw === "string" ? youtubeVideoId(raw) : null;
  if (!id) return jsonError(400, BAD_LINK);
  try {
    const video = await load(id, request.signal);
    if ("error" in video) return jsonError(video.status, video.error);
    const copy = new ArrayBuffer(video.bytes.byteLength);
    new Uint8Array(copy).set(video.bytes);
    return new Response(copy, {
      status: 200,
      headers: {
        "content-type": video.mime,
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return jsonError(502, "Ссылка не открылась. Ролик может быть закрыт или недоступен.");
  }
}

export function POST(request: Request): Promise<Response> {
  return youtubeResponse(request);
}
