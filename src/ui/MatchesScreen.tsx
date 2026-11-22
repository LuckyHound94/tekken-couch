import { useState } from "react";
import { isReina } from "../domain/notation";
import type { AppState, Match, ReplayFile } from "../domain/types";
import { formatDelta, formatPlayedAt, uid } from "./format";

export function MatchesScreen({
  state,
  onTekkenId,
  onOpen,
  onAdd,
  onReset,
}: {
  state: AppState;
  onTekkenId: (id: string) => void;
  onOpen: (id: string) => void;
  onAdd: (match: Match) => void;
  onReset: () => void;
}) {
  return (
    <section className="screen">
      <p className="lead">
        Список — шапка матча: время, персонаж, соперник, раунды, рейтинг. Самого боя в строке нет. Живую ленту Wavu этот срез не
        тянет. Здесь шапка 11 октября и обмены, которые ты разметил руками.
      </p>
      <label className="id-field">
        Tekken ID
        <input value={state.tekkenId} onChange={(event) => onTekkenId(event.target.value)} spellCheck={false} />
      </label>
      <ul className="match-list">
        {state.matches.map((match) => {
          const judged = isReina(match.playerCharacter);
          return (
            <li key={match.id}>
              <button type="button" className="match-row" onClick={() => onOpen(match.id)}>
                <span className="when">{formatPlayedAt(match.playedAt)}</span>
                <span className="who">
                  {match.playerCharacter} против {match.opponentCharacter}
                  {match.opponentPlayerId ? ` (${match.opponentPlayerId})` : ""}
                </span>
                <span className="meta">
                  {match.rounds}
                  {match.rating != null ? ` · ${match.rating} ${formatDelta(match.ratingDelta)}` : ""}
                  {match.patch ? ` · патч ${match.patch}` : ""}
                </span>
                <span className="tags">
                  <em>{fileLabel(match)}</em>
                  {match.fixture ? <em>учебное</em> : null}
                  {judged ? null : <em className="skip">в разбор не идёт</em>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <AddMatch onAdd={onAdd} />
      <button type="button" className="text-button" onClick={onReset}>
        Вернуть учебный набор
      </button>
    </section>
  );
}

function fileLabel(match: Match): string {
  if (match.file === "dead") return "файла нет";
  if (match.file === "local") return "запись лежит у тебя";
  return "ручная запись";
}

function AddMatch({ onAdd }: { onAdd: (match: Match) => void }) {
  const [open, setOpen] = useState(false);
  const [playedAt, setPlayedAt] = useState("2026-11-22T20:00");
  const [playerCharacter, setPlayer] = useState("Reina");
  const [opponentCharacter, setOpponent] = useState("");
  const [opponentPlayerId, setPlayerId] = useState("");
  const [rounds, setRounds] = useState("");
  const [rating, setRating] = useState("");
  const [file, setFile] = useState<ReplayFile>("manual");

  if (!open) {
    return (
      <button type="button" className="primary" onClick={() => setOpen(true)}>
        Добавить матч
      </button>
    );
  }

  return (
    <form
      className="panel"
      onSubmit={(event) => {
        event.preventDefault();
        if (!opponentCharacter.trim()) return;
        const stamp = playedAt.length === 16 ? `${playedAt}:00` : playedAt;
        onAdd({
          id: uid("match"),
          playedAt: stamp,
          playerCharacter: playerCharacter.trim() || "Reina",
          opponentCharacter: opponentCharacter.trim(),
          opponentPlayerId: opponentPlayerId.trim(),
          rounds: rounds.trim() || "—",
          rating: rating.trim() ? Number(rating) : null,
          ratingDelta: null,
          patch: null,
          file,
          fixture: false,
          blurb: "",
          exchanges: [],
        });
      }}
    >
      <h2>Новая шапка</h2>
      <div className="grid">
        <label>
          Время боя
          <input type="datetime-local" value={playedAt} onChange={(event) => setPlayedAt(event.target.value)} required />
        </label>
        <label>
          Твой персонаж
          <input value={playerCharacter} onChange={(event) => setPlayer(event.target.value)} />
        </label>
        <label>
          Персонаж соперника
          <input value={opponentCharacter} onChange={(event) => setOpponent(event.target.value)} required />
        </label>
        <label>
          Игрок соперника
          <input value={opponentPlayerId} onChange={(event) => setPlayerId(event.target.value)} />
        </label>
        <label>
          Раунды
          <input value={rounds} onChange={(event) => setRounds(event.target.value)} placeholder="3–2" />
        </label>
        <label>
          Рейтинг
          <input value={rating} onChange={(event) => setRating(event.target.value)} inputMode="numeric" />
        </label>
        <label>
          Файл боя
          <select value={file} onChange={(event) => setFile(event.target.value as ReplayFile)}>
            <option value="manual">ручная запись</option>
            <option value="dead">файла нет</option>
            <option value="local">запись лежит у тебя</option>
          </select>
        </label>
      </div>
      <div className="row-actions">
        <button type="submit" className="primary">
          Положить в список
        </button>
        <button type="button" className="text-button" onClick={() => setOpen(false)}>
          Закрыть
        </button>
      </div>
    </form>
  );
}
