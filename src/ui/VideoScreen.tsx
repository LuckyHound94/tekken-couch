import { useRef, useState, type FormEvent } from "react";
import { characterById } from "../domain/roster";
import { formatClock, type SideSegment } from "../domain/sides";
import type { Strike, VideoRead } from "../domain/strikes";
import { commandLabel } from "../domain/notation";
import { mergePoseStrikes, poseStrikes } from "../domain/pose";
import { strikeCatalog } from "../server/strikeCatalog";
import { youtubeVideoId } from "../domain/youtube";
import { nameStrikes } from "../video/nameStrikes";
import { loadYoutubePreviews } from "../video/previewFrames";
import { readMatchFrames, readMatchVideo, type MatchFrames } from "../video/readMatch";

type Status = "idle" | "reading" | "done" | "error";

function sideLabel(id: string | null): string {
  if (!id) return "не распознан";
  return characterById(id)?.label ?? "не распознан";
}

function strikeText(items: Strike[]): string {
  if (items.length === 0) return "удары не распознаны";
  const parts: string[] = [];
  let clock = "";
  for (const item of items) {
    const next = formatClock(item.time);
    const name = commandLabel(item.move);
    if (next === clock) parts.push(name);
    else {
      parts.push(`${next} ${name}`);
      clock = next;
    }
  }
  return parts.join(", ");
}

function strikesFor(segment: SideSegment, side: "left" | "right", strikes: Strike[]): Strike[] {
  const characterId = side === "left" ? segment.left : segment.right;
  if (!characterId) return [];
  return strikes.filter(
    (item) =>
      item.side === side &&
      item.characterId === characterId &&
      item.time >= segment.start - 0.05 &&
      item.time <= segment.end + 0.05,
  );
}

export function VideoScreen({ video, onVideo }: { video: VideoRead | null; onVideo: (video: VideoRead | null) => void }) {
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState("");
  const [catalogNote, setCatalogNote] = useState("");
  const [link, setLink] = useState("");
  const [openingLink, setOpeningLink] = useState(false);
  const run = useRef(0);
  const abort = useRef<AbortController | null>(null);

  function takeToken(): { token: number; signal: AbortSignal } {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    const token = run.current + 1;
    run.current = token;
    return { token, signal: controller.signal };
  }

  async function publish(read: MatchFrames, token: number, signal: AbortSignal) {
    let strikes: Strike[] = [];
    let note = "";
    try {
      const named = await nameStrikes(read.moves, signal);
      strikes = mergePoseStrikes(named, poseStrikes(read.poses, read.settled.segments, strikeCatalog()));
    } catch {
      if (token !== run.current || signal.aborted) return;
      note = "Удары с каталогом не сверились. Имена сторон на месте.";
    }
    if (token !== run.current) return;
    onVideo({ segments: read.settled.segments, strikes });
    setCatalogNote(note);
    setStatus("done");
  }

  async function start(file: Blob, token: number, signal: AbortSignal) {
    setStatus("reading");
    setError("");
    setCatalogNote("");
    onVideo(null);
    setProgress({ done: 0, total: 0 });
    try {
      const next = await readMatchVideo(
        file,
        (done, total) => {
          if (token !== run.current) return;
          setProgress({ done, total });
        },
        signal,
      );
      if (token !== run.current) return;
      await publish(next, token, signal);
    } catch {
      if (token !== run.current) return;
      setStatus("error");
      setError("Ролик не прочитался. Нужен файл видео, в котором виден матч.");
    }
  }

  function begin(file: Blob) {
    const { token, signal } = takeToken();
    setOpeningLink(false);
    void start(file, token, signal);
  }

  async function finishFrames(frames: Awaited<ReturnType<typeof loadYoutubePreviews>>, token: number, signal: AbortSignal) {
    if (frames.length === 0) return false;
    setOpeningLink(false);
    const next = await readMatchFrames(frames, (done, total) => {
      if (token !== run.current) return;
      setProgress({ done, total });
    });
    if (token !== run.current) return true;
    await publish(next, token, signal);
    return true;
  }

  async function openLink(event: FormEvent) {
    event.preventDefault();
    const id = youtubeVideoId(link);
    if (!id) {
      setStatus("error");
      setError("Нужна ссылка на ролик YouTube.");
      setCatalogNote("");
      onVideo(null);
      return;
    }
    const { token, signal } = takeToken();
    setOpeningLink(true);
    setStatus("reading");
    setError("");
    setCatalogNote("");
    onVideo(null);
    setProgress({ done: 0, total: 0 });
    let refused = "Ссылка не открылась. Ролик может быть закрыт или недоступен.";
    try {
      const response = await fetch("/api/youtube", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: link.trim() }),
        signal,
      });
      if (token !== run.current) return;
      if (response.ok) {
        const blob = await response.blob();
        if (token !== run.current) return;
        setOpeningLink(false);
        await start(blob, token, signal);
        return;
      }
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (body?.error) refused = body.error;
    } catch {
      if (token !== run.current || signal.aborted) return;
    }
    try {
      const frames = await loadYoutubePreviews(id, signal);
      if (token !== run.current) return;
      if (await finishFrames(frames, token, signal)) return;
    } catch {
      if (token !== run.current || signal.aborted) return;
    }
    if (token !== run.current) return;
    setStatus("error");
    setError(refused);
  }

  async function openFixture() {
    const response = await fetch("/fixture-match.mp4");
    if (!response.ok) {
      setStatus("error");
      setError("Учебный ролик не открылся.");
      return;
    }
    const blob = await response.blob();
    begin(blob);
  }

  const shown = status === "reading" ? null : video;
  const segments = shown?.segments ?? [];
  const strikes = shown?.strikes ?? [];

  return (
    <section className="screen">
      <p className="lead">
        Ролик матча можно выбрать файлом или открыть по ссылке на YouTube. Приложение читает, кто стоит слева и справа.
        Для Рейны и Алисы удар называется командой из каталога, если поза тела совпала ровно с одной командой: 1, 2,
        df+1, df+2, uf+4, а у Рейны ещё f,n,d,df+2 и WGS.DF+4. Другой персонаж и неоднозначная поза остаются без имени
        команды. Если команда написана на кадре, берётся она. Свойства удара и вывод «правильно или ошибка» этот шаг не
        делает.
      </p>
      <div className="row-actions">
        <label className="file">
          Видео матча
          <input
            id="match-video"
            name="match-video"
            type="file"
            accept="video/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) begin(file);
            }}
          />
        </label>
        <button type="button" onClick={() => void openFixture()} disabled={status === "reading"}>
          Учебный ролик
        </button>
      </div>
      <form className="link-form" onSubmit={(event) => void openLink(event)}>
        <label htmlFor="youtube-url">
          Ссылка на YouTube
          <input
            id="youtube-url"
            name="youtube-url"
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="https://www.youtube.com/watch?v=…"
            value={link}
            onChange={(event) => setLink(event.target.value)}
          />
        </label>
        <button type="submit" disabled={status === "reading" || !link.trim()}>
          Открыть ссылку
        </button>
      </form>
      {status === "reading" ? (
        <p className="fine">
          {progress.total ? `Кадр ${progress.done} из ${progress.total}` : openingLink ? "Открываю ссылку" : "Открываю ролик"}
        </p>
      ) : null}
      {status === "error" ? <p className="banner">{error}</p> : null}
      {shown && catalogNote ? <p className="banner">{catalogNote}</p> : null}
      {shown && segments.length === 0 ? (
        <div className="sides">
          <Side title="Слева" name="не распознан" moves="" />
          <Side title="Справа" name="не распознан" moves="" />
        </div>
      ) : null}
      {shown && segments.length === 1 ? (
        <div className="sides">
          <Side
            title="Слева"
            name={sideLabel(segments[0].left)}
            moves={segments[0].left ? strikeText(strikesFor(segments[0], "left", strikes)) : ""}
          />
          <Side
            title="Справа"
            name={sideLabel(segments[0].right)}
            moves={segments[0].right ? strikeText(strikesFor(segments[0], "right", strikes)) : ""}
          />
        </div>
      ) : null}
      {shown && segments.length > 1 ? (
        <div className="block">
          <h2>Стороны по ходу ролика</h2>
          <ul className="segments">
            {segments.map((segment) => (
              <li key={`${segment.start}-${segment.end}-${segment.left}-${segment.right}`}>
                <span className="when">
                  {formatClock(segment.start)}
                  {segment.end !== segment.start ? `–${formatClock(segment.end)}` : ""}
                </span>
                <span>
                  слева {sideLabel(segment.left)}
                  {segment.left ? `, ${strikeText(strikesFor(segment, "left", strikes))}` : ""}
                  ; справа {sideLabel(segment.right)}
                  {segment.right ? `, ${strikeText(strikesFor(segment, "right", strikes))}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function Side({ title, name, moves }: { title: string; name: string; moves: string }) {
  const known = name !== "не распознан";
  return (
    <div className={known ? "side named" : "side unknown"}>
      <p className="eyebrow">{title}</p>
      <h2>{name}</h2>
      {moves ? <p className="moves">{moves}</p> : null}
    </div>
  );
}
