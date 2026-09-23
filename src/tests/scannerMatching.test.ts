import { describe, expect, it } from "vitest";
import type { DeckstateScryfallCard } from "../types/domain";
import { matchScannerEvidence, type ObservedCardEvidence } from "../features/scanner/scannerMatching";

function card(overrides: Partial<DeckstateScryfallCard>): DeckstateScryfallCard {
  return {
    id: "card-id",
    oracleId: "oracle-id",
    name: "Fodder Cannon",
    lang: "en",
    apiUri: "",
    layout: "normal",
    manaCost: "{4}",
    manaValue: 4,
    typeLine: "Artifact",
    oracleText: "{3}, {T}, Sacrifice a creature: Fodder Cannon deals 4 damage to any target.",
    colors: [],
    colorIdentity: [],
    keywords: [],
    legalities: {},
    games: ["paper"],
    setCode: "ody",
    setName: "Odyssey",
    collectorNumber: "298",
    rarity: "uncommon",
    cardFaces: [],
    lastFetchedAt: new Date(0).toISOString(),
    ...overrides,
  };
}

const evidence: ObservedCardEvidence = {
  title: { value: "Fodder Cannon", quality: 0.96, sourceRegion: "title" },
  mana: { value: "{4}", quality: 0.9, sourceRegion: "mana" },
  type: { value: "Artifact", quality: 0.9, sourceRegion: "type" },
  rules: { value: "Sacrifice a creature", quality: 0.82, sourceRegion: "rules" },
};

describe("scanner multi-field matching", () => {
  it("rejects Caduceus when Fodder Cannon explains the physical evidence", () => {
    const result = matchScannerEvidence(evidence, [
      card({ id: "fodder", oracleId: "fodder-oracle" }),
      card({ id: "caduceus", oracleId: "caduceus-oracle", name: "Caduceus, Staff of Hermes", manaCost: "{2}", manaValue: 2, typeLine: "Artifact Equipment", oracleText: "Equipped creature gets +1/+1." }),
    ]);

    expect(result.card?.name).toBe("Fodder Cannon");
    expect(result.identityStatus).toBe("verified");
    expect(result.card?.name).not.toBe("Caduceus, Staff of Hermes");
  });

  it("does not turn garbage OCR into a verified canonical card", () => {
    const result = matchScannerEvidence({
      title: { value: "ee Sib SE fe i a oes Ee hsalEa Rae", quality: 0.2, sourceRegion: "title" },
    }, [card({ id: "caduceus", oracleId: "caduceus-oracle", name: "Caduceus, Staff of Hermes" })]);

    expect(result.identityStatus).toBe("unresolved");
    expect(result.card).toBeUndefined();
  });

  it("keeps a reliable contradiction in review instead of averaging to high confidence", () => {
    const result = matchScannerEvidence({
      ...evidence,
      type: { value: "Creature", quality: 0.95, sourceRegion: "type" },
    }, [card({ id: "fodder", oracleId: "fodder-oracle" })]);

    expect(result.identityStatus).toBe("review_required");
    expect(result.card?.name).toBe("Fodder Cannon");
  });

  it("does not verify a fuzzy title-only candidate without an independent physical field", () => {
    const result = matchScannerEvidence({
      title: { value: "Fodder Cannon", quality: 0.96, sourceRegion: "title" },
    }, [card({ id: "fodder", oracleId: "fodder-oracle" })]);

    expect(result.identityStatus).toBe("review_required");
    expect(result.card?.name).toBe("Fodder Cannon");
  });

  it("separates verified card identity from exact set and collector printing identity", () => {
    const first = card({ id: "bde003e6-d674-42cd-9537-91928730e7dd", oracleId: "aaf171bd-a4bb-4ce4-836a-da193c94f42e", setCode: "8ed", setName: "Eighth Edition", collectorNumber: "302", artist: "Christopher Moeller" });
    const second = card({ id: "fodder-reprint", oracleId: "fodder-oracle", setCode: "foo", collectorNumber: "12" });
    const result = matchScannerEvidence({
      ...evidence,
      set: { value: "8ed", quality: 0.92, sourceRegion: "set" },
      collector: { value: "302", quality: 0.92, sourceRegion: "collector" },
      artist: { value: "Christopher Moeller", quality: 0.86, sourceRegion: "artist" },
    }, [first, second]);

    expect(result.card?.name).toBe("Fodder Cannon");
    expect(result.printing?.id).toBe("bde003e6-d674-42cd-9537-91928730e7dd");
    expect(result.printingStatus).toBe("verified");
  });

  it("resolves the photographed Urza's Destiny printing from title, collector number, and artist", () => {
    const uds = card({
      id: "229ba320-69c9-4400-a0d7-f0f79e8d9856",
      oracleId: "aaf171bd-a4bb-4ce4-836a-da193c94f42e",
      setCode: "uds",
      setName: "Urza's Destiny",
      collectorNumber: "131",
      artist: "DiTerlizzi",
    });
    const otherPrinting = card({
      id: "other-fodder-printing",
      oracleId: "aaf171bd-a4bb-4ce4-836a-da193c94f42e",
      setCode: "8ed",
      setName: "Eighth Edition",
      collectorNumber: "302",
      artist: "Christopher Moeller",
    });
    const result = matchScannerEvidence({
      ...evidence,
      collector: { value: "131", quality: 0.86, sourceRegion: "collector-number" },
      artist: { value: "DiTerlizzi", quality: 0.9, sourceRegion: "footer" },
    }, [uds, otherPrinting]);

    expect(result.card?.name).toBe("Fodder Cannon");
    expect(result.printing?.id).toBe(uds.id);
    expect(result.printingStatus).toBe("verified");
  });

  it("verifies Found Footage from the handheld card's independent fields", () => {
    const foundFootage = card({
      id: "b12eb087-762e-4e7d-a6e0-f48df603b7c7",
      oracleId: "ad37551c-9d20-4902-8190-6a0aa32a7947",
      name: "Found Footage",
      manaCost: "{1}",
      manaValue: 1,
      typeLine: "Artifact — Clue",
      oracleText: "You may look at face-down creatures your opponents control any time. {2}, Sacrifice this artifact: Surveil 2, then draw a card.",
      setCode: "dsk",
      setName: "Duskmourn: House of Horror",
      collectorNumber: "246",
      artist: "Jarel Threat",
    });
    const result = matchScannerEvidence({
      title: { value: "Found Footage", quality: 0.9, sourceRegion: "title" },
      mana: { value: "{1}", quality: 0.82, sourceRegion: "mana" },
      type: { value: "Artifact Clue", quality: 0.82, sourceRegion: "type" },
      rules: { value: "Sacrifice this artifact Surveil 2 then draw a card", quality: 0.78, sourceRegion: "rules" },
      set: { value: "dsk", quality: 0.84, sourceRegion: "footer" },
      collector: { value: "246", quality: 0.84, sourceRegion: "footer" },
    }, [foundFootage]);
    expect(result.card?.name).toBe("Found Footage");
    expect(result.identityStatus).toBe("verified");
    expect(result.printing?.id).toBe(foundFootage.id);
    expect(result.printingStatus).toBe("verified");
  });

  it("allows historical printed text to support a card without requiring Oracle wording", () => {
    const historical = card({
      printedText: "Sacrifice a creature: Fodder Cannon deals 4 damage to any target.",
      oracleText: "Different current Oracle wording.",
    });
    const result = matchScannerEvidence({
      title: evidence.title,
      type: evidence.type,
      rules: { value: "Sacrifice a creature", quality: 0.8, sourceRegion: "rules" },
    }, [historical]);

    expect(result.identityStatus).toBe("verified");
  });
});
