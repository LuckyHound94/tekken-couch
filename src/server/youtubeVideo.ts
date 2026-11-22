import { Innertube, UniversalCache } from "youtubei.js";
import { allowedVideoHost } from "../domain/youtube";

type VideoFormat = {
  has_video: boolean;
  has_audio: boolean;
  is_type_otf: boolean;
  mime_type: string;
  drm_families?: string[];
  content_length?: number;
  height?: number;
  decipher(player?: unknown): Promise<string>;
};
export const MAX_SECONDS = 20 * 60;
export const MAX_BYTES = 80 * 1024 * 1024;

export const YOUTUBE_REFUSED = "YouTube не отдал этот ролик. Загрузите файл.";
export const YOUTUBE_CLOSED = "Ссылка не открылась. Ролик может быть закрыт или недоступен.";
export const YOUTUBE_TOO_LONG = "Этот ролик длиннее двадцати минут. Загрузите файл.";
export const YOUTUBE_TOO_BIG = "Ролик слишком тяжёлый для ссылки. Загрузите файл.";
export const YOUTUBE_LIVE = "Прямой эфир по ссылке не читается. Загрузите файл.";

export type YoutubeFailure = { error: string; status: number };
export type YoutubeFile = { bytes: Uint8Array; mime: string };

let session: Promise<Innertube> | null = null;

function tube(): Promise<Innertube> {
  if (!session) {
    const created = Innertube.create({ cache: new UniversalCache(false) });
    session = created;
    created.catch(() => {
      session = null;
    });
  }
  return session;
}

function failure(status: number, error: string): YoutubeFailure {
  return { error, status };
}

function pickFormat(formats: VideoFormat[]): VideoFormat | null {
  const videos = formats.filter(
    (format) =>
      format.has_video &&
      !format.is_type_otf &&
      format.mime_type.startsWith("video/mp4") &&
      !(format.drm_families && format.drm_families.length > 0),
  );
  const usable = videos.filter((format) => !format.content_length || format.content_length <= MAX_BYTES);
  const pool = usable.length > 0 ? usable : videos;
  const ranked = [...pool].sort((a, b) => {
    const audio = Number(b.has_audio) - Number(a.has_audio);
    if (audio !== 0) return audio;
    return (b.height ?? 0) - (a.height ?? 0);
  });
  const readable = ranked.find((format) => (format.height ?? 0) >= 480 && (format.height ?? 0) <= 720);
  return readable ?? ranked[0] ?? null;
}

async function fetchMedia(start: string, signal: AbortSignal): Promise<Response> {
  let current = start;
  for (let hop = 0; hop < 4; hop++) {
    const url = new URL(current);
    if (url.protocol !== "https:" || !allowedVideoHost(url.hostname)) throw new Error("host");
    const response = await fetch(url, {
      redirect: "manual",
      signal,
      headers: { "user-agent": "Mozilla/5.0" },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("redirect");
      current = new URL(location, url).toString();
      continue;
    }
    return response;
  }
  throw new Error("redirect");
}

async function readCapped(response: Response): Promise<Uint8Array | YoutubeFailure> {
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (declared > MAX_BYTES) return failure(413, YOUTUBE_TOO_BIG);
  const reader = response.body?.getReader();
  if (!reader) return failure(502, YOUTUBE_CLOSED);
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const step = await reader.read();
    if (step.done) break;
    total += step.value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      return failure(413, YOUTUBE_TOO_BIG);
    }
    chunks.push(step.value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  if (bytes.byteLength < 1024) return failure(502, YOUTUBE_CLOSED);
  return bytes;
}

export async function loadYoutubeVideo(id: string, signal: AbortSignal): Promise<YoutubeFile | YoutubeFailure> {
  const yt = await tube();
  if (signal.aborted) return failure(499, YOUTUBE_CLOSED);
  let info;
  try {
    info = await yt.getInfo(id);
  } catch {
    return failure(502, YOUTUBE_CLOSED);
  }
  if (info.basic_info.is_live || info.basic_info.is_live_content) return failure(422, YOUTUBE_LIVE);
  const duration = info.basic_info.duration;
  if (duration != null && duration > MAX_SECONDS) return failure(422, YOUTUBE_TOO_LONG);
  if (info.playability_status?.status && info.playability_status.status !== "OK") return failure(502, YOUTUBE_REFUSED);
  const streaming = info.streaming_data;
  const formats = [...(streaming?.formats ?? []), ...(streaming?.adaptive_formats ?? [])] as VideoFormat[];
  const format = pickFormat(formats);
  if (!format) {
    const known = formats.some((item) => (item.content_length ?? 0) > MAX_BYTES);
    return failure(known ? 413 : 502, known ? YOUTUBE_TOO_BIG : YOUTUBE_REFUSED);
  }
  if (format.content_length && format.content_length > MAX_BYTES) return failure(413, YOUTUBE_TOO_BIG);
  const mediaUrl = await format.decipher(yt.session.player);
  if (!mediaUrl) return failure(502, YOUTUBE_REFUSED);
  let response: Response;
  try {
    response = await fetchMedia(mediaUrl, signal);
  } catch {
    return failure(502, YOUTUBE_REFUSED);
  }
  if (!response.ok) return failure(502, YOUTUBE_REFUSED);
  const type = response.headers.get("content-type") ?? "";
  if (type && !type.startsWith("video/")) return failure(502, YOUTUBE_REFUSED);
  const body = await readCapped(response);
  if ("error" in body) return body;
  return { bytes: body, mime: type.startsWith("video/") ? type.split(";")[0] : "video/mp4" };
}
