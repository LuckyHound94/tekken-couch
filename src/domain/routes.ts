export interface Route {
  id: string;
  title: string;
  source: string;
  after: string;
  expect: string[];
  sentenceOk: string;
  sentenceBroken: string;
}

export const ROUTES: Route[] = [
  {
    id: "ws34-offline",
    title: "Пикап после ws3,4",
    source: "notes/reina/situations.md",
    after: "ws3,4",
    expect: ["f,F+2,F", "f,F+2"],
    sentenceOk: "После ws3,4 офлайн-пол уже выбрал пикап f,F+2,F SEN.3, и следующий ввод с ним совпал.",
    sentenceBroken:
      "После ws3,4 пол уже выбрал f,F+2,F SEN.3. Следующий ввод роут сорвал: решение было верным, связка нет.",
  },
];
