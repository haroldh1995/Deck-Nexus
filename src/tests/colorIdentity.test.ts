import { describe, expect, it } from "vitest";
import {
  isWithinCommanderColorIdentity,
  normalizeColorIdentity,
  splitSuggestionsByCommanderIdentity,
} from "../utils/colorIdentity";
import type { SmartBuildSuggestion } from "../types/domain";

describe("Commander color identity helpers", () => {
  it("normalizes identities into WUBRG order and ignores invalid symbols", () => {
    expect(normalizeColorIdentity(["G", "X", "U", "G", "W"])).toEqual([
      "W",
      "U",
      "G",
    ]);
  });

  it("accepts only cards inside the commander color identity", () => {
    expect(isWithinCommanderColorIdentity(["U", "B"], ["U"])).toBe(true);
    expect(isWithinCommanderColorIdentity(["U", "B"], ["U", "R"])).toBe(
      false,
    );
    expect(isWithinCommanderColorIdentity([], [])).toBe(true);
  });

  it("splits automatic suggestions by commander identity", () => {
    const suggestions: SmartBuildSuggestion[] = [
      {
        id: "a",
        scryfallId: "s1",
        oracleId: "o1",
        name: "Inside Identity",
        quantity: 1,
        reason: "Fits",
        colorIdentity: ["G"],
        targetSection: "main",
      },
      {
        id: "b",
        scryfallId: "s2",
        oracleId: "o2",
        name: "Outside Identity",
        quantity: 1,
        reason: "Does not fit",
        colorIdentity: ["R"],
        targetSection: "main",
      },
    ];

    const result = splitSuggestionsByCommanderIdentity(["G", "W"], suggestions);

    expect(result.accepted.map((suggestion) => suggestion.name)).toEqual([
      "Inside Identity",
    ]);
    expect(result.rejected.map((suggestion) => suggestion.name)).toEqual([
      "Outside Identity",
    ]);
  });
});
