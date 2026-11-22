import { useRef, useState } from "react";
import { characterById } from "../domain/roster";
import { formatClock, type SettledSides } from "../domain/sides";
import { readMatchVideo } from "../video/readMatch";

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
  const run = useRef(0);

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
    const token = run.current + 1;
    run.current = token;
    void start(file, token);
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
        Ролик матча. Под каждым портретом написано имя: слева и справа. Приложение читает эти две строки. Строка, которую не
        удалось прочитать, остаётся без имени. Удары, их свойства и вывод «правильно или ошибка» этот шаг не делает.
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
      {status === "reading" ? (
        <p className="fine">{progress.total ? `Кадр ${progress.done} из ${progress.total}` : "Открываю ролик"}</p>
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
