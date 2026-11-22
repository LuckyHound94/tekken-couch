import { describe, expect, test } from "vitest";
import { allowedVideoHost, youtubePreviewUrls, youtubeVideoId } from "./youtube";

const ID = "dQw4w9WgXcQ";

describe("ссылка YouTube", () => {
  test("берёт идентификатор из обычных адресов", () => {
    expect(youtubeVideoId(`https://www.youtube.com/watch?v=${ID}`)).toBe(ID);
    expect(youtubeVideoId(`https://m.youtube.com/watch?v=${ID}&t=12`)).toBe(ID);
    expect(youtubeVideoId(`https://youtu.be/${ID}?si=abc`)).toBe(ID);
    expect(youtubeVideoId(`https://www.youtube.com/shorts/${ID}`)).toBe(ID);
    expect(youtubeVideoId(`https://www.youtube.com/embed/${ID}`)).toBe(ID);
    expect(youtubeVideoId(`https://www.youtube.com/live/${ID}`)).toBe(ID);
    expect(youtubeVideoId(`http://music.youtube.com/watch?v=${ID}`)).toBe(ID);
  });

  test("чужой адрес и обрывок идентификатора не проходят", () => {
    expect(youtubeVideoId("https://example.com/watch?v=" + ID)).toBeNull();
    expect(youtubeVideoId("https://youtube.com.evil.com/watch?v=" + ID)).toBeNull();
    expect(youtubeVideoId("https://www.youtube.com/playlist?list=PL123")).toBeNull();
    expect(youtubeVideoId("https://www.youtube.com/watch?v=short")).toBeNull();
    expect(youtubeVideoId("javascript:alert(1)")).toBeNull();
    expect(youtubeVideoId("")).toBeNull();
  });

  test("к ролику есть три кадра превью", () => {
    expect(youtubePreviewUrls("dQw4w9WgXcQ")).toEqual([
      "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxres1.jpg",
      "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxres2.jpg",
      "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxres3.jpg",
    ]);
  });

  test("скачивание разрешено только с хоста ролика", () => {
    expect(allowedVideoHost("rr3---sn-abc.googlevideo.com")).toBe(true);
    expect(allowedVideoHost("googlevideo.com")).toBe(true);
    expect(allowedVideoHost("evilgooglevideo.com")).toBe(false);
    expect(allowedVideoHost("www.youtube.com")).toBe(false);
    expect(allowedVideoHost("localhost")).toBe(false);
  });
});
