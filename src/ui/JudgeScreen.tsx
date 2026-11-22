import { useState } from "react";
import { answerLabel, buildDraft } from "../domain/draft";
import { YAGAMI_ROWS } from "../domain/floor";
import { FILTER_LABEL } from "../domain/labels";
import { displayMove } from "../domain/notation";
import { canonParagraph } from "../domain/phrase";
import type { AppState, ButtonFilter } from "../domain/types";
import { exportPayload } from "../domain/storage";

export function JudgeScreen({
  state,
  onFilter,
  onDeleteRule,
  onDeleteHabit,
  onImport,
}: {
  state: AppState;
  onFilter: (filter: ButtonFilter) => void;
  onDeleteRule: (id: string) => void;
  onDeleteHabit: (id: string) => void;
  onImport: (payload: ReturnType<typeof exportPayload>) => void;
}) {
  const draft = buildDraft(state);
  const edits = state.rules.filter((rule) => rule.origin === "edit");
  const canon = state.rules.filter((rule) => rule.origin === "canon");
  const share = draft.resolved === 0 ? 0 : draft.expensiveWithoutCounter / draft.resolved;
  const [importNote, setImportNote] = useState("");

  return (
    <section className="screen">
      <p className="lead">
        Судья сверяет кнопку с полом, который уже записан. Победа обмена, урон и счёт раунда его не двигают. Черновик из нескольких
        матчей пол не назначает.
      </p>

      <section className="block">
        <h2>Фильтр и вершины</h2>
        <label>
          Фильтр кнопки
          <select value={state.filter} onChange={(event) => onFilter(event.target.value as ButtonFilter)}>
            {Object.entries(FILTER_LABEL).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <p>
          Фильтр остаётся корейским, пока ты сам его не сменишь. Смена фильтра судью не подменяет: дорогую кнопку пол по-прежнему не
          прощает.
        </p>
        <table>
          <thead>
            <tr>
              <th>Вершина</th>
              <th>Соперник</th>
              <th>Yagami</th>
              <th>Не жать</th>
            </tr>
          </thead>
          <tbody>
            {YAGAMI_ROWS.map((row) => (
              <tr key={row.vertex}>
                <td>{row.vertex}</td>
                <td>{row.they}</td>
                <td>{row.press}</td>
                <td>{row.avoid}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          {draft.longestSeries
            ? `Самая длинная серия на одной вершине: ${draft.longestSeries.length}, ${draft.longestSeries.vertex}.`
            : "Вершина в обменах не размечена, серию не посчитать."}{" "}
          Порога Строга в каноне нет, вердикта по серии нет.
        </p>
        <p>
          Доля дорогих кнопок без счётчика: {draft.expensiveWithoutCounter} из {draft.resolved}
          {draft.resolved ? ` (${Math.round(share * 100)}%).` : "."} Это измерение. Фильтром оно не становится.
        </p>
      </section>

      <section className="block">
        <h2>Пол</h2>
        <ul className="rules">
          {canon.map((rule) => (
            <li key={rule.id}>
              <h3>{rule.title}</h3>
              <p>{rule.sentence}</p>
              <p className="fine">
                {rule.source}, срез {rule.checked}. Жать {rule.allow.map(displayMove).join(", ") || "—"}.
                {rule.deny.length ? ` Не жать ${rule.deny.map(displayMove).join(", ")}.` : ""}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="block">
        <h2>Правки</h2>
        {edits.length === 0 ? <p>Правок пока нет. Они появляются со строки обмена и сразу начинают судить.</p> : null}
        <ul className="rules">
          {edits.map((rule) => (
            <li key={rule.id}>
              <h3>{rule.title}</h3>
              <p className="phrase">{canonParagraph(rule)}</p>
              <button type="button" className="text-button" onClick={() => onDeleteRule(rule.id)}>
                Снять правку
              </button>
            </li>
          ))}
        </ul>
        <h3>Счётчики игроков</h3>
        {state.habits.length === 0 ? <p>Привычка одного человека сюда ещё не записана. Общий пол она не трогает.</p> : null}
        <ul className="rules">
          {state.habits.map((habit) => (
            <li key={habit.id}>
              <p>{habit.sentence}</p>
              <button type="button" className="text-button" onClick={() => onDeleteHabit(habit.id)}>
                Снять счётчик
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="block">
        <h2>Черновик</h2>
        <p>Считаются только обмены, которые судья уже разобрал. Неразобранная дистанция в голосовании не участвует.</p>
        <h3>Счётчик внутри матча</h3>
        {draft.counters.length === 0 ? <p>Трёх повторов одной ситуации внутри матча пока нет. В общий пол это всё равно не идёт.</p> : null}
        <ul>
          {draft.counters.map((counter) => (
            <li key={`${counter.matchId}-${counter.key}`}>
              {counter.label}: обменов в одной ситуации — {counter.count}, кнопки {counter.answers.map(answerLabel).join(", ")}. План 2.
            </li>
          ))}
        </ul>
        <h3>Налог</h3>
        {draft.taxes.length === 0 ? <p>Дорогих кнопок вне пола в разобранных обменах нет.</p> : null}
        <ul>
          {draft.taxes.map((tax) => (
            <li key={`${tax.key}-${tax.answer}`}>
              {answerLabel(tax.answer)} в ситуации «{tax.label}» — {tax.count}. В разрешение не предлагается.
            </li>
          ))}
        </ul>
        <h3>Строка черновика</h3>
        {draft.lines.length === 0 ? (
          <p>Дешёвая кнопка ещё не стала самой частой в одних и тех же полях на нескольких матчах. Пачкой черновик пол не заменяет.</p>
        ) : (
          <ul>
            {draft.lines.map((line) => (
              <li key={`${line.key}-${line.answer}`}>
                {line.label}: чаще всего {answerLabel(line.answer)}, {line.count} в {line.matchIds.length} матчах. Это черновик, не
                второй гамеплан. Подтверждение одной строки — та же правка с обмена.
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="block">
        <h2>Файл</h2>
        <p>Структурный файл возвращается тем же ходом. Поле, которое ты уже поставил руками, новая загрузка не затирает.</p>
        <div className="row-actions">
          <button
            type="button"
            onClick={() => {
              const blob = new Blob([JSON.stringify(exportPayload(state), null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = "replay-judge.json";
              link.click();
              URL.revokeObjectURL(url);
            }}
          >
            Скачать файл
          </button>
          <label className="file">
            Загрузить файл
            <input
              type="file"
              accept="application/json"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                try {
                  const parsed = JSON.parse(await file.text()) as ReturnType<typeof exportPayload>;
                  onImport(parsed);
                  setImportNote("Файл принят. Ручные поля остались на месте.");
                } catch {
                  setImportNote("Файл не разобран.");
                }
              }}
            />
          </label>
        </div>
        {importNote ? <p>{importNote}</p> : null}
      </section>
    </section>
  );
}
