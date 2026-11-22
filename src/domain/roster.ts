export interface Character {
  id: string;
  label: string;
  plate: string;
}

const LIST: Array<[string, string, string]> = [
  ["alisa", "Alisa", "ALISA"],
  ["anna", "Anna", "ANNA"],
  ["armor-king", "Armor King", "ARMORKING"],
  ["asuka", "Asuka", "ASUKA"],
  ["azucena", "Azucena", "AZUCENA"],
  ["bob", "Bob", "BOB"],
  ["bryan", "Bryan", "BRYAN"],
  ["claudio", "Claudio", "CLAUDIO"],
  ["clive", "Clive", "CLIVE"],
  ["devil-jin", "Devil Jin", "DEVILJIN"],
  ["dragunov", "Dragunov", "DRAGUNOV"],
  ["eddy", "Eddy", "EDDY"],
  ["fahkumram", "Fahkumram", "FAHKUMRAM"],
  ["feng", "Feng", "FENG"],
  ["heihachi", "Heihachi", "HEIHACHI"],
  ["hwoarang", "Hwoarang", "HWOARANG"],
  ["jack-8", "Jack-8", "JACK8"],
  ["jin", "Jin", "JIN"],
  ["jun", "Jun", "JUN"],
  ["kazuya", "Kazuya", "KAZUYA"],
  ["king", "King", "KING"],
  ["kuma", "Kuma", "KUMA"],
  ["kunimitsu", "Kunimitsu", "KUNIMITSU"],
  ["lars", "Lars", "LARS"],
  ["law", "Law", "LAW"],
  ["lee", "Lee", "LEE"],
  ["leo", "Leo", "LEO"],
  ["leroy", "Leroy", "LEROY"],
  ["lidia", "Lidia", "LIDIA"],
  ["lili", "Lili", "LILI"],
  ["miary-zo", "Miary Zo", "MIARYZO"],
  ["nina", "Nina", "NINA"],
  ["panda", "Panda", "PANDA"],
  ["paul", "Paul", "PAUL"],
  ["raven", "Raven", "RAVEN"],
  ["reina", "Reina", "REINA"],
  ["roger-jr", "Roger Jr.", "ROGERJR"],
  ["shaheen", "Shaheen", "SHAHEEN"],
  ["steve", "Steve", "STEVE"],
  ["victor", "Victor", "VICTOR"],
  ["xiaoyu", "Xiaoyu", "XIAOYU"],
  ["yoshimitsu", "Yoshimitsu", "YOSHIMITSU"],
  ["zafina", "Zafina", "ZAFINA"],
];

export const ROSTER: readonly Character[] = LIST.map(([id, label, plate]) => ({ id, label, plate }));

const BY_PLATE = new Map(ROSTER.map((character) => [character.plate, character]));
const BY_ID = new Map(ROSTER.map((character) => [character.id, character]));

export function characterById(id: string): Character | null {
  return BY_ID.get(id) ?? null;
}

function plateKey(text: string): string {
  return text.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function characterFromPlate(text: string): Character | null {
  const whole = BY_PLATE.get(plateKey(text));
  if (whole) return whole;
  const lines = text
    .split(/\n/)
    .map(plateKey)
    .filter((line) => line.length > 0)
    .map((line) => BY_PLATE.get(line) ?? null)
    .filter((character): character is Character => character != null);
  const ids = new Set(lines.map((character) => character.id));
  if (ids.size === 1) return lines[0];
  if (ids.size > 1) return null;
  const tokens = text
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter((part) => part.length > 0)
    .map((part) => BY_PLATE.get(part) ?? null)
    .filter((character): character is Character => character != null);
  const tokenIds = new Set(tokens.map((character) => character.id));
  if (tokenIds.size === 1) return tokens[0];
  return null;
}

export function characterFromReads(texts: string[]): Character | null {
  const hits = texts
    .map(characterFromPlate)
    .filter((character): character is Character => character != null);
  const ids = new Set(hits.map((character) => character.id));
  if (ids.size !== 1) return null;
  return hits[0];
}
