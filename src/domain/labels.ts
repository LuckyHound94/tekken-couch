import type { Distance, FramesSign, Phase, Vertex, WallRead } from "./types";

export const PHASE_LABEL: Record<Phase, string> = {
  start: "старт раунда",
  "red-zone": "красная зона",
  "denied-entry": "в зону не пускают",
  "poke-panic": "паник в пок",
  "their-spam": "их спам",
  turtle: "туртл",
  "my-plus": "твой плюс",
  "their-plus": "их плюс",
  wall: "стена",
  oki: "окиземе",
};

export const DISTANCE_LABEL: Record<Distance, string> = {
  "their-face": "их лицо",
  mishima: "твоя Mishima-длина",
  "open-neutral": "открытый нейтрал",
};

export const WALL_LABEL: Record<WallRead, string> = {
  crouch: "садятся",
  stand: "стоят",
  sidewalk: "уходят сайдволком",
  none: "стены нет",
};

export const FRAMES_LABEL: Record<FramesSign, string> = {
  plus: "кадры в плюс",
  minus: "кадры в минус",
  even: "кадры нулевые",
};

export const VERTEX_LABEL: Record<Vertex, string> = {
  Press: "Press",
  Wait: "Wait",
  Move: "Move",
};

export const OUTCOME_LABEL = {
  match: "совпало",
  mismatch: "не совпало",
  unresolved: "не разобрано",
  execution: "исполнение",
  skipped: "не идёт в разбор",
} as const;

export const FILTER_LABEL = {
  korean: "корейский",
  european: "европейский",
  pakistani: "пакистанский",
  american: "американский",
} as const;

export const PHASES = Object.keys(PHASE_LABEL) as Phase[];
export const DISTANCES = Object.keys(DISTANCE_LABEL) as Distance[];
export const WALLS = Object.keys(WALL_LABEL) as WallRead[];
export const VERTICES: Vertex[] = ["Press", "Wait", "Move"];

export const STANCES = ["standing", "SEN", "WRA", "UNS", "FC", "crouch"] as const;

export const MATCHUP_CHARACTERS = ["Law", "Azucena", "Leroy", "Yoshimitsu"];

export function hasMatchupFile(character: string | null | undefined): boolean {
  if (!character) return false;
  return MATCHUP_CHARACTERS.some((name) => name.toLowerCase() === character.trim().toLowerCase());
}
