import { beforeEach, describe, expect, it } from "vitest";
import { defaultBracketLock } from "../data/defaults";
import { resetDatabaseForTests } from "../db/database";
import {
  createFullBackupPackage,
  listPriceHistoryForCard,
  recordPriceHistoryPoint,
} from "../db/repositories";
import {
  compareTradeValues,
  createScryfallPriceReference,
  formatCurrency,
  formatPriceFreshness,
  getPriceStatus,
  normalizeFinish,
  selectReferencePrice,
  summarizeCollectionValue,
  summarizeDeckValue,
} from "../collector";
import { previewImmutableDeckSnapshot } from "../ecosystem";
import type {
  CardPriceReference,
  Deck,
  DeckCard,
  ManualPriceOverride,
  OwnedCard,
  OwnedPrinting,
} from "../types/domain";

const now = "2026-01-01T00:00:00.000Z";
const staleAt = "2026-01-08T00:00:00.000Z";

function priceReference(overrides: Partial<CardPriceReference> = {}): CardPriceReference {
  return {
    source: "scryfall",
    sourceLabel: "Scryfall",
    currency: "USD",
    nonfoil: 5,
    foil: 12,
    etched: null,
    eur: null,
    eurFoil: null,
    tix: null,
    market: 5,
    low: null,
    mid: 5,
    high: null,
    fetchedAt: now,
    staleAt,
    status: "current",
    ...overrides,
  };
}

function manualValue(value: number): ManualPriceOverride {
  return {
    value,
    currency: "USD",
    reason: "Local shop value",
    createdAt: now,
    updatedAt: now,
  };
}

function printing(overrides: Partial<OwnedPrinting> = {}): OwnedPrinting {
  return {
    id: "printing-sol-ring",
    scryfallId: "scryfall-sol-ring",
    oracleId: "oracle-sol-ring",
    name: "Sol Ring",
    setCode: "cmm",
    setName: "Commander Masters",
    collectorNumber: "400",
    language: "en",
    foil: false,
    finish: "nonfoil",
    condition: "Near Mint",
    quantityOwned: 1,
    imageUri: "normal.jpg",
    prices: priceReference(),
    priceUpdatedAt: now,
    tradeStatus: "not_for_trade",
    storageLocation: "Binder 1",
    lastScannedAt: now,
    ...overrides,
  };
}

function ownedCard(overrides: Partial<OwnedCard> = {}): OwnedCard {
  return {
    id: "owned-sol-ring",
    oracleId: "oracle-sol-ring",
    scryfallId: "scryfall-sol-ring",
    name: "Sol Ring",
    manaCost: "{1}",
    manaValue: 1,
    typeLine: "Artifact",
    oracleText: "{T}: Add {C}{C}.",
    colorIdentity: [],
    imageUri: "normal.jpg",
    legalities: { commander: "legal" },
    prices: priceReference(),
    priceUpdatedAt: now,
    tradeStatus: "not_for_trade",
    wantStatus: "none",
    quantityOwned: 1,
    printings: [printing()],
    tags: [],
    notes: "",
    favorite: false,
    storageLocation: "Binder 1",
    duplicateFlag: "none",
    deckUsage: {},
    lastScannedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function deckCard(overrides: Partial<DeckCard> = {}): DeckCard {
  return {
    id: "card-sol-ring",
    deckId: "deck-collector",
    scryfallId: "scryfall-sol-ring",
    oracleId: "oracle-sol-ring",
    name: "Sol Ring",
    manaCost: "{1}",
    manaValue: 1,
    typeLine: "Artifact",
    oracleText: "{T}: Add {C}{C}.",
    colorIdentity: [],
    setCode: "cmm",
    setName: "Commander Masters",
    collectorNumber: "400",
    prices: priceReference(),
    priceUpdatedAt: now,
    quantity: 1,
    section: "main",
    categories: ["ramp"],
    roleTags: ["ramp"],
    customTags: [],
    notes: "",
    protected: false,
    ownedQuantityAtAdd: 1,
    missingQuantity: 0,
    addedAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function deck(overrides: Partial<Deck> = {}): Deck {
  const commander = deckCard({
    id: "card-commander",
    oracleId: "oracle-talrand",
    scryfallId: "scryfall-talrand",
    name: "Talrand, Sky Summoner",
    typeLine: "Legendary Creature - Merfolk Wizard",
    colorIdentity: ["U"],
    prices: priceReference({ nonfoil: 2, market: 2, mid: 2 }),
    section: "commander",
    categories: ["commander"],
    roleTags: ["commander"],
  });
  return {
    id: "deck-collector",
    name: "Collector Test",
    format: "commander",
    commanderIds: [commander.scryfallId],
    commanderNames: [commander.name],
    colorIdentity: ["U"],
    cards: [commander, deckCard()],
    maybeboard: [deckCard({ id: "card-maybe", name: "Brainstorm", oracleId: "oracle-brainstorm", scryfallId: "scryfall-brainstorm", prices: undefined, missingQuantity: 1, section: "maybeboard" })],
    cuts: [],
    goals: [],
    tags: [],
    style: "control",
    powerTarget: 5,
    bracketLock: defaultBracketLock,
    ownershipPreference: "owned_first",
    categoryStyle: "commander_roles",
    notes: "",
    status: "draft",
    originalImportText: "",
    unresolvedImports: [],
    createdFrom: "blank",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("collector pricing foundation", () => {
  beforeEach(async () => {
    await resetDatabaseForTests();
  });

  it("parses Scryfall prices with source attribution and does not treat missing prices as zero", () => {
    const prices = createScryfallPriceReference({ usd: "4.20", usd_foil: "8.40", usd_etched: null }, now);
    const missing = createScryfallPriceReference({ usd: null, usd_foil: null }, now);

    expect(prices?.nonfoil).toBe(4.2);
    expect(prices?.foil).toBe(8.4);
    expect(prices?.sourceLabel).toBe("Scryfall");
    expect(selectReferencePrice(missing).value).toBeNull();
    expect(formatCurrency(selectReferencePrice(missing).value)).toBe("Price unavailable");
  });

  it("distinguishes current, stale, unavailable, and offline cached freshness", () => {
    const prices = priceReference();
    expect(getPriceStatus(prices, new Date("2026-01-01T01:00:00.000Z"))).toBe("current");
    expect(getPriceStatus(prices, new Date("2026-01-09T00:00:00.000Z"))).toBe("stale");
    expect(getPriceStatus(prices, new Date("2026-01-02T00:00:00.000Z"), true)).toBe("offline_cached");
    expect(getPriceStatus(undefined, new Date("2026-01-02T00:00:00.000Z"), true)).toBe("unavailable");
    expect(formatPriceFreshness(undefined, { offline: true })).toBe("Price unavailable offline");
  });

  it("summarizes collection value by finish while reporting missing prices and unresolved printings", () => {
    const summary = summarizeCollectionValue([
      ownedCard({
        quantityOwned: 3,
        printings: [
          printing({ id: "printing-nonfoil", quantityOwned: 2, finish: "nonfoil", foil: false }),
          printing({ id: "printing-foil", quantityOwned: 1, finish: "foil", foil: true }),
        ],
      }),
      ownedCard({
        id: "owned-unpriced",
        oracleId: "oracle-unpriced",
        scryfallId: "scryfall-unpriced",
        name: "Unpriced Card",
        prices: undefined,
        quantityOwned: 1,
        printings: [],
      }),
    ]);

    expect(summary.totalEstimatedValue).toBe(22);
    expect(summary.nonfoilValue).toBe(10);
    expect(summary.foilValue).toBe(12);
    expect(summary.missingPriceCount).toBe(1);
    expect(summary.unresolvedPrintingCount).toBe(1);
    expect(summary.highestValueCards[0].source).toBe("Scryfall");
  });

  it("keeps manual values separate from market references in trade comparison", () => {
    const summary = compareTradeValues([
      {
        id: "mine",
        side: "mine",
        name: "Sol Ring",
        quantity: 1,
        prices: priceReference(),
      },
      {
        id: "theirs",
        side: "theirs",
        name: "Manual Trade Card",
        quantity: 2,
        manualPriceOverride: manualValue(3),
      },
      {
        id: "missing",
        side: "theirs",
        name: "No Price",
        quantity: 1,
      },
    ]);

    expect(summary.mySideValue).toBe(5);
    expect(summary.theirSideValue).toBe(6);
    expect(summary.differenceTowardMe).toBe(1);
    expect(summary.theirMissingPriceCount).toBe(1);
    expect(summary.summary).toMatch(/Their side/);
  });

  it("summarizes deck value without making value a legality signal", () => {
    const summary = summarizeDeckValue(deck(), [ownedCard()]);

    expect(summary.totalEstimatedValue).toBe(7);
    expect(summary.commanderValue).toBe(2);
    expect(summary.mainDeckValue).toBe(5);
    expect(summary.missingPriceCount).toBe(1);
    expect(summary.highestValueCard?.name).toBe("Sol Ring");
  });

  it("migrates legacy foil flags into finish values without losing condition or language meaning", () => {
    expect(normalizeFinish(undefined, true)).toBe("foil");
    expect(normalizeFinish(undefined, false)).toBe("nonfoil");
    expect(normalizeFinish("etched", false)).toBe("etched");
  });

  it("stores price history and includes it in full backups", async () => {
    await recordPriceHistoryPoint({
      oracleId: "oracle-sol-ring",
      scryfallId: "scryfall-sol-ring",
      printingId: "printing-sol-ring",
      finish: "nonfoil",
      source: "scryfall",
      sourceLabel: "Scryfall",
      currency: "USD",
      value: 5,
      recordedAt: now,
    });

    expect(await listPriceHistoryForCard({ oracleId: "oracle-sol-ring" })).toHaveLength(1);
    const backup = await createFullBackupPackage("collector backup");
    expect((backup.contents.tables as Record<string, unknown[]>).priceHistory).toHaveLength(1);
  });

  it("does not let price changes alter immutable gameplay checksums", () => {
    const baseDeck = deck();
    const priceChangedDeck = deck({
      cards: baseDeck.cards.map((card) => ({
        ...card,
        prices: card.prices
          ? priceReference({ ...card.prices, nonfoil: (card.prices.nonfoil ?? 0) + 100, market: (card.prices.market ?? 0) + 100 })
          : undefined,
        priceUpdatedAt: "2026-02-01T00:00:00.000Z",
      })),
    });

    const first = previewImmutableDeckSnapshot(baseDeck, {
      sequenceNumber: 1,
      createdAt: now,
      consumerIntent: "advanced_gameplay",
    });
    const second = previewImmutableDeckSnapshot(priceChangedDeck, {
      sequenceNumber: 1,
      createdAt: now,
      consumerIntent: "advanced_gameplay",
    });

    expect(first.record.gameplayChecksum).toBe(second.record.gameplayChecksum);
    expect(JSON.stringify(first.record.immutablePayload)).not.toMatch(/prices|market|usd|eur|tix/i);
  });
});
