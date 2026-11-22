import { useEffect, useState } from "react";
import type { AppState, ButtonFilter, Match } from "./domain/types";
import { emptyExchange } from "./domain/types";
import { loadState, mergeImport, saveState } from "./domain/storage";
import { sampleState } from "./domain/sample";
import { JudgeScreen } from "./ui/JudgeScreen";
import { MatchScreen } from "./ui/MatchScreen";
import { MatchesScreen } from "./ui/MatchesScreen";
import { uid } from "./ui/format";

type Screen = "matches" | "match" | "judge";

export function App() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [screen, setScreen] = useState<Screen>("matches");
  const [matchId, setMatchId] = useState("tutorial");
  const [exchangeId, setExchangeId] = useState<string | null>("t-hellsweep");

  useEffect(() => {
    saveState(state);
  }, [state]);

  const match = state.matches.find((item) => item.id === matchId) ?? state.matches[0];

  function openMatch(id: string) {
    setMatchId(id);
    const next = state.matches.find((item) => item.id === id);
    setExchangeId(next?.exchanges[0]?.id ?? null);
    setScreen("match");
  }

  function patchMatch(id: string, update: (match: Match) => Match) {
    setState((current) => ({
      ...current,
      matches: current.matches.map((item) => (item.id === id ? update(item) : item)),
    }));
  }

  return (
    <div className="app">
      <header className="top">
        <div>
          <p className="eyebrow">Tekken ID {state.tekkenId}</p>
          <h1>Судья реплея</h1>
        </div>
        <nav className="tabs" aria-label="Экраны">
          <button type="button" aria-current={screen === "matches" ? "page" : undefined} onClick={() => setScreen("matches")}>
            Матчи
          </button>
          <button type="button" aria-current={screen === "match" ? "page" : undefined} onClick={() => setScreen("match")}>
            Матч
          </button>
          <button type="button" aria-current={screen === "judge" ? "page" : undefined} onClick={() => setScreen("judge")}>
            Судья
          </button>
        </nav>
      </header>
      <main>
        {screen === "matches" ? (
          <MatchesScreen
            state={state}
            onTekkenId={(tekkenId) => setState((current) => ({ ...current, tekkenId }))}
            onOpen={openMatch}
            onAdd={(created) => {
              setState((current) => ({ ...current, matches: [created, ...current.matches] }));
              setMatchId(created.id);
              setExchangeId(null);
              setScreen("match");
            }}
            onReset={() => {
              if (window.confirm("Вернуть учебный набор? Матчи и правки на этом устройстве сотрутся.")) {
                setState(sampleState());
                setMatchId("tutorial");
                setExchangeId("t-hellsweep");
                setScreen("matches");
              }
            }}
          />
        ) : null}
        {screen === "match" && match ? (
          <MatchScreen
            state={state}
            match={match}
            selectedId={exchangeId}
            onSelect={setExchangeId}
            onChangeExchange={(exchange) =>
              patchMatch(match.id, (current) => ({
                ...current,
                exchanges: current.exchanges.map((item) => (item.id === exchange.id ? exchange : item)),
              }))
            }
            onAddExchange={() => {
              const created = emptyExchange(uid("ex"), match.exchanges.length + 1);
              created.situation = {
                ...created.situation,
                opponent: match.opponentCharacter === "разные" ? null : match.opponentCharacter,
              };
              created.opponentPlayerId = match.opponentPlayerId || null;
              patchMatch(match.id, (current) => ({ ...current, exchanges: [...current.exchanges, created] }));
              setExchangeId(created.id);
            }}
            onRemoveExchange={(id) => {
              patchMatch(match.id, (current) => ({
                ...current,
                exchanges: current.exchanges.filter((item) => item.id !== id),
              }));
              if (exchangeId === id) setExchangeId(null);
            }}
            onAddRule={(rule) => setState((current) => ({ ...current, rules: [...current.rules, rule] }))}
            onAddHabit={(habit) => setState((current) => ({ ...current, habits: [...current.habits, habit] }))}
          />
        ) : null}
        {screen === "judge" ? (
          <JudgeScreen
            state={state}
            onFilter={(filter: ButtonFilter) => setState((current) => ({ ...current, filter }))}
            onDeleteRule={(id) =>
              setState((current) => ({ ...current, rules: current.rules.filter((rule) => rule.id !== id) }))
            }
            onDeleteHabit={(id) =>
              setState((current) => ({ ...current, habits: current.habits.filter((habit) => habit.id !== id) }))
            }
            onImport={(payload) => setState((current) => mergeImport(current, payload))}
          />
        ) : null}
      </main>
    </div>
  );
}
