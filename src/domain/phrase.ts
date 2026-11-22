import { DISTANCE_LABEL, FRAMES_LABEL, PHASE_LABEL, WALL_LABEL } from "./labels";
import { displayMove } from "./notation";
import type { FloorRule, When } from "./types";

export function describeWhen(when: When): string {
  const parts: string[] = [];
  if (when.phase) parts.push(PHASE_LABEL[when.phase]);
  if (when.opponent) parts.push(`против ${when.opponent}`);
  if (when.vertex) parts.push(`вершина ${when.vertex}`);
  if (when.distance) parts.push(DISTANCE_LABEL[when.distance]);
  if (when.stance) parts.push(`стойка ${when.stance}`);
  if (when.wall) parts.push(`у стены ${WALL_LABEL[when.wall]}`);
  if (when.frames) parts.push(FRAMES_LABEL[when.frames]);
  if (when.layerAlive === true) parts.push("пока зону не контрят");
  if (when.layerAlive === false) parts.push("зону уже контрят");
  if (when.counterBelow != null) parts.push(`закрытых лоу меньше ${when.counterBelow}`);
  if (when.counterAtLeast != null) parts.push(`закрытых лоу не меньше ${when.counterAtLeast}`);
  if (when.theirMove) parts.push(`их ${displayMove(when.theirMove)} на блоке`);
  if (when.phaseNot?.length) parts.push("вне чужого плюса и стены");
  if (parts.length === 0) return "В этой ситуации";
  const [first, ...rest] = parts;
  const head = first.charAt(0).toUpperCase() + first.slice(1);
  return rest.length ? `${head}, ${rest.join(", ")}` : head;
}

export function canonParagraph(rule: FloorRule): string {
  const place =
    rule.destination === "matchup"
      ? `Фраза готовится в файл матчапа ${rule.when.opponent ?? ""}.`
      : "Фраза готовится в общий пол, в решения раунда.";
  const allow = rule.allow.map(displayMove).join(", ") || "—";
  const deny = rule.deny.length ? ` Не жать ${rule.deny.map(displayMove).join(", ")}.` : "";
  return `${describeWhen(rule.when)}: жать ${allow}.${deny} ${place} Срез правки: ${rule.checked}. Приложение файл базы не пишет.`;
}

export function habitSentence(personId: string, when: When, answer: string): string {
  return `${describeWhen(when)}. Игрок ${personId}: записан ответ ${displayMove(answer)}. Это план 2, счётчик одного игрока. Общий пол от этой строки не меняется, и исход старых обменов она не переворачивает.`;
}
