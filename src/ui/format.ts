const MONTHS = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

export function formatPlayedAt(iso: string): string {
  const [date, time] = iso.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const clock = (time ?? "").slice(0, 5);
  const body = `${day} ${MONTHS[month - 1]} ${year}`;
  return clock ? `${body}, ${clock}` : body;
}

export function formatDelta(delta: number | null): string {
  if (delta == null) return "";
  return delta > 0 ? `+${delta}` : String(delta);
}

export function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export const EDIT_DATE = "2026-11-22";
