import { describe, expect, test } from "vitest";
import { youtubeResponse } from "./youtubeRoute";

function post(url: string): Request {
  return new Request("http://127.0.0.1/api/youtube", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url }),
  });
}

describe("маршрут ссылки", () => {
  test("чужой адрес не скачивается", async () => {
    let called = false;
    const response = await youtubeResponse(post("https://example.com/watch?v=dQw4w9WgXcQ"), async () => {
      called = true;
      return { bytes: new Uint8Array([1]), mime: "video/mp4" };
    });
    expect(response.status).toBe(400);
    expect(called).toBe(false);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("YouTube");
  });

  test("годная ссылка отдаёт ролик как файл", async () => {
    const response = await youtubeResponse(post("https://youtu.be/dQw4w9WgXcQ"), async () => ({
      bytes: Uint8Array.from([1, 2, 3, 4]),
      mime: "video/mp4",
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("video/mp4");
    expect(response.headers.get("cache-control")).toBe("no-store");
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(Array.from(bytes)).toEqual([1, 2, 3, 4]);
  });

  test("отказ загрузки остаётся текстом ошибки", async () => {
    const response = await youtubeResponse(post("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), async () => ({
      status: 502,
      error: "YouTube не отдал этот ролик. Загрузите файл.",
    }));
    expect(response.status).toBe(502);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe("YouTube не отдал этот ролик. Загрузите файл.");
  });
});
