const HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
  "youtu.be",
  "www.youtu.be",
]);

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export function youtubeVideoId(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!HOSTS.has(host)) return null;
  if (host === "youtu.be" || host === "www.youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0] ?? "";
    return VIDEO_ID.test(id) ? id : null;
  }
  const fromQuery = url.searchParams.get("v");
  if (fromQuery && VIDEO_ID.test(fromQuery)) return fromQuery;
  const parts = url.pathname.split("/").filter(Boolean);
  const marker = parts.findIndex((part) => part === "embed" || part === "shorts" || part === "live" || part === "v");
  const id = marker >= 0 ? (parts[marker + 1] ?? "") : "";
  return VIDEO_ID.test(id) ? id : null;
}

export function youtubePreviewUrls(id: string): string[] {
  return [1, 2, 3].map((part) => `https://i.ytimg.com/vi/${id}/maxres${part}.jpg`);
}

export function allowedVideoHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return host === "googlevideo.com" || host.endsWith(".googlevideo.com");
}
