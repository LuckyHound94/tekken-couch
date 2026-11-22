import { describe, expect, test } from "vitest";
import { ROSTER, characterById, characterFromPlate, characterFromReads } from "./roster";

describe("строка имени", () => {
  test("целая строка называется, чужая буква нет", () => {
    expect(characterFromPlate("jin")?.id).toBe("jin");
    expect(characterFromPlate("JIN")?.label).toBe("Jin");
    expect(characterFromPlate("devil jin")?.id).toBe("devil-jin");
    expect(characterFromPlate("DEVILJIN")?.id).toBe("devil-jin");
    expect(characterFromPlate("jin")?.id).not.toBe("devil-jin");
    expect(characterFromPlate("armor king")?.id).toBe("armor-king");
    expect(characterFromPlate("king")?.id).toBe("king");
    expect(characterFromPlate("jack-8")?.id).toBe("jack-8");
    expect(characterFromPlate("JACK 8")?.id).toBe("jack-8");
    expect(characterFromPlate("kazu ya")?.id).toBe("kazuya");
    expect(characterFromPlate("jinx")).toBeNull();
    expect(characterFromPlate("M7 REINA")?.id).toBe("reina");
    expect(characterFromPlate("REINA ALISA")).toBeNull();
    expect(characterFromPlate("")).toBeNull();
    expect(characterFromPlate("jin\npa")?.id).toBe("jin");
    expect(characterFromPlate("jin\nkazuya")).toBeNull();
  });

  test("два порога сходятся на одном имени или не сходятся ни на каком", () => {
    expect(characterFromReads(["PY JIN", "JIN"])?.id).toBe("jin");
    expect(characterFromReads(["JIN", "JUN"])).toBeNull();
    expect(characterFromReads(["", "SS"])).toBeNull();
    expect(characterFromReads(["KAZUYA"])?.label).toBe("Kazuya");
  });

  test("каждая табличка ростера называется сама собой", () => {
    expect(ROSTER.length).toBeGreaterThanOrEqual(43);
    for (const character of ROSTER) {
      expect(characterFromPlate(character.plate)?.id).toBe(character.id);
      expect(characterFromPlate(character.label)?.id).toBe(character.id);
    }
  });

  test("id возвращает то же имя", () => {
    expect(characterById("reina")?.label).toBe("Reina");
    expect(characterById("нет")).toBeNull();
  });
});
