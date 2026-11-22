import { useState } from "react";
import { situationLabel } from "../domain/draft";
import {
  buildHabit,
  draftRule,
  finishRule,
  narrowWhen,
  previewFlips,
  resolveScope,
  type Flip,
  type NarrowKey,
  type ScopeChoice,
} from "../domain/edit";
import { inputFrom, judge } from "../domain/judge";
import { canonParagraph } from "../domain/phrase";
import { DISTANCES, DISTANCE_LABEL, OUTCOME_LABEL, PHASES, PHASE_LABEL, STANCES, VERTICES, WALLS, WALL_LABEL } from "../domain/labels";
import { displayMove, isReina, normalizeMove } from "../domain/notation";
import type { AppState, Exchange, FloorRule, Habit, HitResult, Match, Situation, Vertex, WallRead } from "../domain/types";
import { EDIT_DATE, uid } from "./format";

const NARROW_KEYS: Array<{ key: NarrowKey; label: string }> = [
  { key: "phase", label: "фаза" },
  { key: "opponent", label: "персонаж" },
  { key: "vertex", label: "вершина" },
  { key: "distance", label: "дистанция" },
  { key: "stance", label: "стойка" },
  { key: "wall", label: "стена" },
  { key: "frames", label: "кадры" },
  { key: "layerAlive", label: "зона жива" },
  { key: "counter", label: "счётчик до трёх" },
];

export function MatchScreen({
  state,
  match,
  selectedId,
  onSelect,
  onChangeExchange,
  onAddExchange,
  onRemoveExchange,
  onAddRule,
  onAddHabit,
}: {
  state: AppState;
  match: Match;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onChangeExchange: (exchange: Exchange) => void;
  onAddExchange: () => void;
  onRemoveExchange: (id: string) => void;
  onAddRule: (rule: FloorRule) => void;
  onAddHabit: (habit: Habit) => void;
}) {
  const [deathsOnly, setDeathsOnly] = useState(true);
  const visible = deathsOnly ? match.exchanges.filter((item) => item.deathClip) : match.exchanges;
  const judged = isReina(match.playerCharacter);

  return (
    <section className="screen">
      <header className="match-head">
        <h2>
          {match.playerCharacter} против {match.opponentCharacter}
          {match.opponentPlayerId ? `, ${match.opponentPlayerId}` : ""}
        </h2>
        <p>{match.blurb || "Обмены по порядку. По умолчанию оставлены клипы смерти."}</p>
        {match.file === "dead" ? (
          <p className="banner">
            Файла боя нет. Патч 3.03.01 от 12 ноября стёр реплеи до обновления. Мод отправлять нечего. Обмен можно приложить
            руками.
          </p>
        ) : null}
        {!judged ? <p className="banner">В couch входит Reina. Эта строка в списке видна и в разбор не идёт.</p> : null}
      </header>
      <div className="row-actions">
        <label className="check">
          <input type="checkbox" checked={deathsOnly} onChange={(event) => setDeathsOnly(event.target.checked)} />
          Только клипы смерти
        </label>
        <button type="button" className="primary" onClick={onAddExchange}>
          Добавить обмен
        </button>
      </div>
      {visible.length === 0 ? (
        <p className="empty">Обменов нет. Шапка сама по себе решение не читает.</p>
      ) : (
        <ol className="exchanges">
          {visible.map((exchange) => {
            const verdict = judge(inputFrom(match, exchange), state.rules);
            const open = exchange.id === selectedId;
            return (
              <li key={exchange.id} data-testid={`exchange-${exchange.id}`} data-outcome={verdict.outcome}>
                <button type="button" className={`exchange outcome-${verdict.outcome}`} onClick={() => onSelect(exchange.id)}>
                  <span className="outcome">{OUTCOME_LABEL[verdict.outcome]}</span>
                  <span className="answer">{exchange.answer ? displayMove(normalizeMove(exchange.answer)) : "кнопка не названа"}</span>
                  <span className="sit">{situationLabel(exchange.situation)}</span>
                </button>
                <p className="phrase" data-testid={`phrase-${exchange.id}`}>
                  {verdict.phrase}
                </p>
                {verdict.advice && verdict.advice.length > 0 ? (
                  <p className="advice" data-testid={`advice-${exchange.id}`}>
                    {verdict.outcome === "execution" ? "Роут держит" : "Пол назвал"}:{" "}
                    {verdict.advice.map(displayMove).join(", ")}
                  </p>
                ) : (
                  <p className="advice muted" data-testid={`advice-${exchange.id}`}>
                    {verdict.outcome === "unresolved" ? "Совета нет." : "Поправлять нечего."}
                  </p>
                )}
                {verdict.framesUnverified && verdict.outcome !== "unresolved" ? (
                  <p className="fine">Кадры этого патча со срезом не сверены. Исход решения это не отменяет.</p>
                ) : null}
                {open ? (
                  <Editor
                    state={state}
                    match={match}
                    exchange={exchange}
                    judged={judged}
                    onChange={onChangeExchange}
                    onRemove={() => onRemoveExchange(exchange.id)}
                    onAddRule={onAddRule}
                    onAddHabit={onAddHabit}
                  />
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function Editor({
  state,
  match,
  exchange,
  judged,
  onChange,
  onRemove,
  onAddRule,
  onAddHabit,
}: {
  state: AppState;
  match: Match;
  exchange: Exchange;
  judged: boolean;
  onChange: (exchange: Exchange) => void;
  onRemove: () => void;
  onAddRule: (rule: FloorRule) => void;
  onAddHabit: (habit: Habit) => void;
}) {
  const [scopeChoice, setScope] = useState<ScopeChoice>("auto");
  const [narrow, setNarrow] = useState<NarrowKey[]>(["phase", "opponent", "vertex", "distance", "stance", "wall", "counter", "layerAlive"]);
  const [replacement, setReplacement] = useState("");
  const [pending, setPending] = useState<{ rule: FloorRule | null; habit: Habit | null; flips: Flip[]; error: string } | null>(null);
  const situation = exchange.situation;

  function patch(partial: Partial<Exchange>) {
    setPending(null);
    onChange({ ...exchange, ...partial });
  }

  function patchSituation(partial: Partial<Situation>) {
    patch({ situation: { ...situation, ...partial } });
  }

  function prepare(kind: "keep" | "replace") {
    const scope = resolveScope(scopeChoice, situation.opponent);
    const when = narrowWhen(situation, narrow);
    if (Object.keys(when).length === 0) {
      setPending({ rule: null, habit: null, flips: [], error: "Без полей правка накрыла бы все обмены. Оставь хотя бы одно." });
      return;
    }
    if (scope === "person") {
      if (!exchange.opponentPlayerId) {
        setPending({ rule: null, habit: null, flips: [], error: "Для счётчика нужен игрок соперника." });
        return;
      }
      const habit = buildHabit(exchange.opponentPlayerId, situation.opponent, when, exchange.answer, uid("habit"));
      setPending({ rule: null, habit, flips: [], error: "" });
      return;
    }
    if (kind === "replace" && !replacement.trim()) {
      setPending({ rule: null, habit: null, flips: [], error: "Назови, что надо было нажать." });
      return;
    }
    const input = inputFrom(match, exchange);
    const rule = finishRule(
      draftRule(input, state.rules, when, kind === "replace" ? replacement : null),
      scope,
      situation.opponent,
      uid("edit"),
      EDIT_DATE,
    );
    setPending({ rule, habit: null, flips: previewFlips(state, rule), error: "" });
  }

  const overturned = pending?.flips.filter((flip) => flip.before !== flip.after) ?? [];

  return (
    <div className="editor">
      <div className="grid">
        <label>
          Твой ответ
          <input value={exchange.answer} list="moves" spellCheck={false} onChange={(event) => patch({ answer: event.target.value })} />
        </label>
        <label>
          Предыдущий ввод роута
          <input
            value={exchange.priorInput ?? ""}
            spellCheck={false}
            placeholder="ws3,4"
            onChange={(event) => patch({ priorInput: event.target.value || null })}
          />
        </label>
        <label>
          Персонаж соперника
          <input value={situation.opponent ?? ""} onChange={(event) => patchSituation({ opponent: event.target.value || null })} />
        </label>
        <label>
          Игрок соперника
          <input
            value={exchange.opponentPlayerId ?? ""}
            onChange={(event) => patch({ opponentPlayerId: event.target.value || null })}
          />
        </label>
        <label>
          Фаза
          <select
            value={situation.phase ?? ""}
            onChange={(event) => patchSituation({ phase: (event.target.value || null) as Situation["phase"] })}
          >
            <option value="">не названа</option>
            {PHASES.map((phase) => (
              <option key={phase} value={phase}>
                {PHASE_LABEL[phase]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Вершина
          <select
            value={situation.vertex ?? ""}
            onChange={(event) => patchSituation({ vertex: (event.target.value || null) as Vertex | null })}
          >
            <option value="">не названа</option>
            {VERTICES.map((vertex) => (
              <option key={vertex} value={vertex}>
                {vertex}
              </option>
            ))}
          </select>
        </label>
        <label>
          Дистанция
          <select
            value={situation.distance ?? ""}
            onChange={(event) => patchSituation({ distance: (event.target.value || null) as Situation["distance"] })}
          >
            <option value="">пустая</option>
            {DISTANCES.map((distance) => (
              <option key={distance} value={distance}>
                {DISTANCE_LABEL[distance]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Стойка
          <select
            value={situation.stance ?? ""}
            onChange={(event) => patchSituation({ stance: (event.target.value || null) as Situation["stance"] })}
          >
            <option value="">не названа</option>
            {STANCES.map((stance) => (
              <option key={stance} value={stance}>
                {stance}
              </option>
            ))}
          </select>
        </label>
        <label>
          Стена
          <select
            value={situation.wall ?? ""}
            onChange={(event) => patchSituation({ wall: (event.target.value || null) as WallRead | null })}
          >
            <option value="">не названа</option>
            {WALLS.map((wall) => (
              <option key={wall} value={wall}>
                {WALL_LABEL[wall]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Твои кадры
          <input
            value={situation.frames ?? ""}
            inputMode="numeric"
            onChange={(event) => patchSituation({ frames: numberOrNull(event.target.value) })}
          />
        </label>
        <label>
          Закрытых лоу
          <input
            value={situation.counter ?? ""}
            inputMode="numeric"
            placeholder="не видно"
            onChange={(event) => patchSituation({ counter: numberOrNull(event.target.value) })}
          />
        </label>
        <label>
          Красная зона
          <select
            value={situation.layerAlive == null ? "" : situation.layerAlive ? "yes" : "no"}
            onChange={(event) =>
              patchSituation({
                layerAlive: event.target.value === "" ? null : event.target.value === "yes",
              })
            }
          >
            <option value="">не размечено</option>
            <option value="yes">ещё не контрят</option>
            <option value="no">уже контрят</option>
          </select>
        </label>
        <label>
          Их кнопка на блоке
          <input
            value={situation.theirMove ?? ""}
            spellCheck={false}
            onChange={(event) => patchSituation({ theirMove: event.target.value || null })}
          />
        </label>
        <label>
          Хит или блок
          <select value={exchange.hit} onChange={(event) => patch({ hit: event.target.value as HitResult })}>
            <option value="unknown">не снят</option>
            <option value="hit">хит</option>
            <option value="block">блок</option>
            <option value="whiff">вифф</option>
          </select>
        </label>
        <label>
          Урон
          <input
            value={exchange.damage ?? ""}
            inputMode="numeric"
            onChange={(event) => patch({ damage: numberOrNull(event.target.value) })}
          />
        </label>
        <label>
          Счёт раунда
          <input value={exchange.roundScore ?? ""} onChange={(event) => patch({ roundScore: event.target.value || null })} />
        </label>
        <label>
          Патч реплея
          <input value={exchange.patch ?? ""} onChange={(event) => patch({ patch: event.target.value || null })} />
        </label>
        <label>
          Игра в сете
          <input
            value={situation.gameIndex ?? ""}
            inputMode="numeric"
            onChange={(event) => patchSituation({ gameIndex: numberOrNull(event.target.value) })}
          />
        </label>
      </div>
      <p className="fine">Хит, урон и счёт раунда на исход не влияют. Попавший hellsweep с плюса остаётся ошибкой, если пол его не назвал.</p>
      <label className="check">
        <input type="checkbox" checked={exchange.deathClip} onChange={(event) => patch({ deathClip: event.target.checked })} />
        Клип смерти
      </label>
      <label>
        Заметка
        <textarea value={exchange.note} rows={2} onChange={(event) => patch({ note: event.target.value })} />
      </label>
      <datalist id="moves">
        {["df+1", "db+4", "джеб", "hellsweep", "дашблок", "KBD", "степ", "Wait", "стоячий блок", "EWGF", "WGF", "SEN.3", "b+2", "f+4"].map(
          (move) => (
            <option key={move} value={move} />
          ),
        )}
      </datalist>
      {judged ? (
        <fieldset className="edit-box">
          <legend>Правка этой ситуации</legend>
          <p className="fine">
            Область по умолчанию — матчап, если файл на этого персонажа уже есть. Иначе общий пол. Привычка одного игрока пол не
            переписывает.
          </p>
          <div className="checks">
            {NARROW_KEYS.map((item) => (
              <label key={item.key} className="check">
                <input
                  type="checkbox"
                  checked={narrow.includes(item.key)}
                  onChange={(event) => {
                    setPending(null);
                    setNarrow((current) =>
                      event.target.checked ? [...current, item.key] : current.filter((key) => key !== item.key),
                    );
                  }}
                />
                {item.label}
              </label>
            ))}
          </div>
          <label>
            Куда класть
            <select value={scopeChoice} onChange={(event) => setScope(event.target.value as ScopeChoice)}>
              <option value="auto">само: матчап или общий пол</option>
              <option value="floor">общий пол</option>
              <option value="matchup">файл матчапа</option>
              <option value="person">счётчик этого игрока</option>
            </select>
          </label>
          <div className="row-actions">
            <button type="button" onClick={() => prepare("keep")}>
              Так и надо
            </button>
            <input
              value={replacement}
              placeholder="надо было вот это"
              spellCheck={false}
              onChange={(event) => setReplacement(event.target.value)}
            />
            <button type="button" onClick={() => prepare("replace")}>
              Надо было вот это
            </button>
          </div>
          {pending ? (
            <div className="preview">
              {pending.error ? <p>{pending.error}</p> : null}
              {pending.habit ? (
                <>
                  <p>Общий пол не перепишется. Исход старых строк не сменится.</p>
                  <p>{pending.habit.sentence}</p>
                  <button
                    type="button"
                    className="primary"
                    onClick={() => {
                      onAddHabit(pending.habit!);
                      setPending(null);
                    }}
                  >
                    Записать счётчик
                  </button>
                </>
              ) : null}
              {pending.rule ? (
                <>
                  <p>
                    {overturned.length === 0 ? "Исход старых строк не меняется." : `Исход сменится ${atRows(overturned.length)}.`}{" "}
                    {pending.flips.length > overturned.length
                      ? `Ещё ${pending.flips.length - overturned.length} сменят строку пола при том же исходе.`
                      : ""}
                  </p>
                  {overturned.length > 0 ? (
                    <ul>
                      {overturned.slice(0, 8).map((flip) => (
                        <li key={flip.exchangeId}>
                          {displayMove(normalizeMove(flip.answer))}: {OUTCOME_LABEL[flip.before]} → {OUTCOME_LABEL[flip.after]}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <p className="phrase">{canonParagraph(pending.rule)}</p>
                  <button
                    type="button"
                    className="primary"
                    onClick={() => {
                      onAddRule(pending.rule!);
                      setPending(null);
                    }}
                  >
                    Сделать этой правкой couch
                  </button>
                </>
              ) : null}
            </div>
          ) : null}
        </fieldset>
      ) : null}
      <button type="button" className="text-button" onClick={onRemove}>
        Удалить обмен
      </button>
    </div>
  );
}

function numberOrNull(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function atRows(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `у ${count} строки`;
  return `у ${count} строк`;
}
