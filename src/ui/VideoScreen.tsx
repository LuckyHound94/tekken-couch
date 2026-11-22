import { useRef, useState, type FormEvent } from "react";
import { characterById } from "../domain/roster";
import { formatClock, type SettledSides } from "../domain/sides";
import { youtubeVideoId } from "../domain/youtube";
import { loadYoutubePreviews } from "../video/previewFrames";
import { readMatchFrames, readMatchVideo } from "../video/readMatch";

type Status = "idle" | "reading" | "done" | "error";

function sideLabel(id: string | null): string {
  if (!id) return "не распознан";
  return characterById(id)?.label ?? "не распознан";
}

export function VideoScreen() {
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState("");
  const [settled, setSettled] = useState<SettledSides | null>(null);
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

  async function start(file: Blob, token: number) {
    setStatus("reading");
    setError("");
    setSettled(null);
    setProgress({ done: 0, total: 0 });
    try {
      const next = await readMatchVideo(file, (done, total) => {
        if (token !== run.current) return;
        setProgress({ done, total });
      });
      if (token !== run.current) return;
      setSettled(next);
      setStatus("done");
    } catch {
      if (token !== run.current) return;
      setStatus("error");
      setError("Ролик не прочитался. Нужен файл видео, в котором виден матч.");
    }
  }

  function begin(file: Blob) {
    const { token } = takeToken();
    setOpeningLink(false);
    void start(file, token);
  }

  async function finishFrames(frames: Awaited<ReturnType<typeof loadYoutubePreviews>>, token: number) {
    if (frames.length === 0) return false;
    setOpeningLink(false);
    const next = await readMatchFrames(frames, (done, total) => {
      if (token !== run.current) return;
      setProgress({ done, total });
    });
    if (token !== run.current) return true;
    setSettled(next);
    setStatus("done");
    return true;
  }

  async function openLink(event: FormEvent) {
    event.preventDefault();
    const id = youtubeVideoId(link);
    if (!id) {
      setStatus("error");
      setError("Нужна ссылка на ролик YouTube.");
      setSettled(null);
      return;
    }
    const { token, signal } = takeToken();
    setOpeningLink(true);
    setStatus("reading");
    setError("");
    setSettled(null);
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
        await start(blob, token);
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
      if (await finishFrames(frames, token)) return;
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

  const segments = settled?.segments ?? [];

  return (
    <section className="screen">
      <p className="lead">
        Ролик матча можно выбрать файлом или открыть по ссылке на YouTube. Под каждым портретом написано имя: слева и
        справа. Приложение читает эти две строки. Строка, которую не удалось прочитать, остаётся без имени. Удары, их
        свойства и вывод «правильно или ошибка» этот шаг не делает.
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
      {status === "done" && segments.length === 0 ? (
        <div className="sides">
          <Side title="Слева" name="не распознан" known={false} />
          <Side title="Справа" name="не распознан" known={false} />
        </div>
      ) : null}
      {status === "done" && segments.length === 1 ? (
        <div className="sides">
          <Side title="Слева" name={sideLabel(segments[0].left)} known={segments[0].left != null} />
          <Side title="Справа" name={sideLabel(segments[0].right)} known={segments[0].right != null} />
        </div>
      ) : null}
      {status === "done" && segments.length > 1 ? (
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
                  слева {sideLabel(segment.left)}, справа {sideLabel(segment.right)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function Side({ title, name, known }: { title: string; name: string; known: boolean }) {
  return (
    <div className={known ? "side named" : "side unknown"}>
      <p className="eyebrow">{title}</p>
      <h2>{name}</h2>
    </div>
  );
}
