const ALIASES: Record<string, string> = {
  hellsweep: "hellsweep",
  "wgs.df+4": "hellsweep",
  "cd.df+4": "hellsweep",
  "db+4": "db+4",
  "d+4": "db+4",
  "df+1": "df+1",
  "1": "1",
  джеб: "1",
  jab: "1",
  "sen.3": "SEN.3",
  sen3: "SEN.3",
  "sen.3+4": "SEN.3+4",
  "sen.2": "SEN.2",
  "sen.1+2": "SEN.1+2",
  wgf: "WGF",
  ewgf: "EWGF",
  electric: "EWGF",
  электрик: "EWGF",
  ewgk: "EWGK",
  дашблок: "dashblock",
  dashblock: "dashblock",
  "dash-block": "dashblock",
  kbd: "kbd",
  бэкдэш: "kbd",
  backdash: "kbd",
  степ: "sidestep",
  sidestep: "sidestep",
  ss: "sidestep",
  сайдстеп: "sidestep",
  шаг: "step-timing",
  "step-timing": "step-timing",
  пауза: "pause",
  pause: "pause",
  wait: "Wait",
  вэйт: "Wait",
  вейт: "Wait",
  "стоячийблок": "stand-block",
  "стоячий-блок": "stand-block",
  блок: "stand-block",
  "stand-block": "stand-block",
  standblock: "stand-block",
  "b+2": "b+2",
  "f+4": "f+4",
  "f,f+2": "f,F+2",
  "ff+2": "f,F+2",
  "f,f+2,f": "f,F+2,F",
  "ff+2,f": "f,F+2,F",
  "ws3,4": "ws3,4",
  ws34: "ws3,4",
  "df+4": "df+4",
  "df+4,2": "df+4,2",
  "ss.4": "SS.4",
  "wra.1+3": "WRA.1+3",
  "wra.3+4": "WRA.3+4",
  "df+2": "df+2",
  "d+2,3": "d+2,3",
  hopkick: "hopkick",
  хопкик: "hopkick",
  "uf+4": "hopkick",
  "3+4,4": "3+4,4",
  "3+4": "3+4",
  wavedash: "wavedash",
  "1,1,2": "1,1,2",
  "3,2": "3,2",
};

const DISPLAY: Record<string, string> = {
  hellsweep: "hellsweep",
  "df+1": "df+1",
  "db+4": "db+4",
  "1": "джеб",
  "SEN.3": "SEN.3",
  "SEN.3+4": "SEN.3+4",
  "SEN.2": "SEN.2",
  "SEN.1+2": "SEN.1+2",
  WGF: "WGF",
  EWGF: "EWGF",
  EWGK: "EWGK",
  dashblock: "дашблок",
  kbd: "KBD",
  sidestep: "степ",
  "step-timing": "шаг",
  pause: "пауза",
  Wait: "Wait",
  "stand-block": "стоячий блок",
  "b+2": "b+2",
  "f+4": "f+4",
  "f,F+2": "f,F+2",
  "f,F+2,F": "f,F+2,F",
  "ws3,4": "ws3,4",
  "df+4": "df+4",
  "df+4,2": "df+4,2",
  "SS.4": "SS.4",
  "WRA.1+3": "WRA.1+3",
  "WRA.3+4": "WRA.3+4",
  "df+2": "df+2",
  "d+2,3": "d+2,3",
  hopkick: "хопкик",
  "3+4,4": "3+4,4",
  "3+4": "3+4",
  wavedash: "wavedash",
  "1,1,2": "1,1,2",
  "3,2": "3,2",
  "seen-strike": "удар",
};

export function cleanNotation(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/d\/f/g, "df")
    .replace(/d\/b/g, "db")
    .replace(/u\/f/g, "uf")
    .replace(/u\/b/g, "ub");
}

export function normalizeMove(raw: string | null | undefined): string {
  if (!raw) return "";
  const cleaned = cleanNotation(raw);
  if (!cleaned) return "";
  return ALIASES[cleaned] ?? cleaned;
}

export function displayMove(canonical: string): string {
  return DISPLAY[canonical] ?? canonical;
}

export function sameName(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function isReina(character: string | null | undefined): boolean {
  return sameName(character, "Reina") || sameName(character, "Рейна");
}
