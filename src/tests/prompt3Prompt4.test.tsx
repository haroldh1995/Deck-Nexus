import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsProvider } from "../app/SettingsContext";
import { localCardCatalog } from "../data/cardCatalog";
import { resetDatabaseForTests } from "../db/database";
import {
  addDeckCard,
  addScanRecord,
  createBlankCommanderDeck,
  getRecoverableScanBatch,
  listOwnedCards,
  listScanRecords,
  saveScanBatch,
  upsertOwnedCard,
} from "../db/repositories";
import { AnalyzerScreen } from "../features/analyzer/AnalyzerScreen";
import {
  analyzeDeck,
  createSmartBuildConfig,
  getDeckRecommendations,
  runSmartBuild,
} from "../features/analyzer/deckAnalysis";
import { CardSearchScreen } from "../features/cards/CardSearchScreen";
import { searchCards } from "../features/cards/cardSearch";
import type { ManualCardInput } from "../features/decks/builderTypes";
import { OwnedCardsScreen } from "../features/owned/OwnedCardsScreen";
import { ScanCardsScreen } from "../features/scanner/ScanCardsScreen";
import {
  createScanRecordFromCard,
  createScannerBatch,
  nextStackingFeederCycle,
} from "../features/scanner/scannerEngine";
import type { CommanderColor, Deck } from "../types/domain";

function manualCard(
  name: string,
  typeLine: string,
  colorIdentity: CommanderColor[] = [],
  roleTags: string[] = [],
): ManualCardInput {
  return {
    name,
    typeLine,
    colorIdentity,
    roleTags,
    customTags: [],
    owned: true,
    destination: "main",
  };
}

async function createTatyovaDeck(): Promise<Deck> {
  const deck = await createBlankCommanderDeck({
    name: "Prompt Test Deck",
    goals: ["Commander Voltron", "Ramp"],
  });

  return addDeckCard(deck.id, {
    ...manualCard("Tatyova, Benthic Druid", "Legendary Creature", ["U", "G"], [
      "commander",
      "draw",
    ]),
    requestedSection: "commander",
  });
}

function renderWithAppProviders(ui: ReactElement, route = "/") {
  return render(
    <SettingsProvider>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </SettingsProvider>,
  );
}

describe("Prompt 3 card search and owned registry", () => {
  beforeEach(async () => {
    await resetDatabaseForTests();
    vi.restoreAllMocks();
  });

  it("searches partial names, exact phrases, types, oracle text, and keyword roles", async () => {
    const deck = await createTatyovaDeck();
    await upsertOwnedCard({
      name: "Counterspell",
      quantityOwned: 2,
      typeLine: "Instant",
      colorIdentity: ["U"],
      duplicateFlag: "multiple_owned",
    });
    const ownedCards = await listOwnedCards();

    expect(searchCards({ query: "counter", scope: "all" }, { deck })[0].card.name).toBe("Counterspell");
    expect(searchCards({ exactPhrase: "draw a card", scope: "all" }, { deck }).map((result) => result.card.name)).toContain("Tatyova, Benthic Druid");
    expect(searchCards({ typeText: "Aura", scope: "all" }, { deck }).map((result) => result.card.name)).toContain("Rancor");
    expect(searchCards({ oracleText: "Treasure", scope: "all" }, { deck }).map((result) => result.card.name)).toContain("Smothering Tithe");
    expect(searchCards({ keyword: "voltron", scope: "all" }, { deck }).map((result) => result.card.name)).toContain("Swiftfoot Boots");

    const ownedResults = searchCards({ query: "counter", scope: "owned" }, { deck, ownedCards });
    expect(ownedResults[0].badges).toContain("Owned");
    const illegalResults = searchCards({ query: "Lightning Bolt", scope: "all" }, { deck, manualSearch: true });
    expect(illegalResults[0].badges).toContain("Outside Identity");
    expect(illegalResults[0].badges).toContain("Manual Search Result");
  });

  it("renders Card Search and warns before manual outside-color main-deck add", async () => {
    const deck = await createTatyovaDeck();
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/cards/autocomplete")) {
        return new Response(
          JSON.stringify({ object: "catalog", total_values: 1, data: ["Lightning Bolt"] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          object: "list",
          total_cards: 1,
          has_more: false,
          data: [
            {
              object: "card",
              id: "scryfall-lightning-bolt",
              oracle_id: "oracle-lightning-bolt",
              name: "Lightning Bolt",
              lang: "en",
              uri: "https://api.scryfall.com/cards/scryfall-lightning-bolt",
              layout: "normal",
              mana_cost: "{R}",
              cmc: 1,
              type_line: "Instant",
              oracle_text: "Lightning Bolt deals 3 damage to any target.",
              color_identity: ["R"],
              colors: ["R"],
              keywords: [],
              legalities: { commander: "legal" },
              games: ["paper"],
              set: "lea",
              set_name: "Limited Edition Alpha",
              collector_number: "161",
              rarity: "common",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    renderWithAppProviders(<CardSearchScreen />, `/search?deckId=${deck.id}`);
    await screen.findByRole("heading", { name: "Card Search" });
    await userEvent.type(screen.getByLabelText("Search Scryfall cards"), "Lightning Bolt");
    await userEvent.click(screen.getByRole("button", { name: /^Search$/ }));
    await screen.findByRole("heading", { name: "Lightning Bolt" }, { timeout: 2500 });
    await userEvent.click(await screen.findByRole("button", { name: "Add to Current Deck" }));

    await waitFor(() => {
      expect(screen.getAllByText(/outside identity/i).length).toBeGreaterThan(1);
    });
  });

  it("adds and edits local owned card quantities with duplicate/share status", async () => {
    renderWithAppProviders(<OwnedCardsScreen />, "/owned");
    await screen.findByRole("heading", { name: "Owned Cards" });
    await userEvent.type(screen.getByLabelText("Card name"), "Sol Ring");
    await userEvent.clear(screen.getByLabelText("Quantity owned"));
    await userEvent.type(screen.getByLabelText("Quantity owned"), "2");
    await userEvent.selectOptions(screen.getByLabelText("Duplicate/share flag"), "multiple_owned");
    await userEvent.click(screen.getByRole("button", { name: "Save Owned Card" }));

    await waitFor(async () => {
      const cards = await listOwnedCards();
      expect(cards[0].name).toBe("Sol Ring");
      expect(cards[0].quantityOwned).toBe(2);
      expect(cards[0].duplicateFlag).toBe("multiple_owned");
    });
  });
});

describe("Prompt 3 scanner persistence and feeder modes", () => {
  beforeEach(async () => {
    await resetDatabaseForTests();
  });

  it("treats stacking feeder too-close as a normal cue and pauses on tray-full timeout", () => {
    const cue = nextStackingFeederCycle({
      current: "idle_watching_tray",
      cue: "too_close",
      tooCloseDurationMs: 900,
    });
    expect(cue.stackingState).toBe("new_card_arrival_cue");
    expect(cue.shouldPause).toBe(false);

    const timeout = nextStackingFeederCycle({
      current: "wait_for_next_too_close_cue",
      cue: "timeout",
      tooCloseDurationMs: 6000,
    });
    expect(timeout.stackingState).toBe("paused_tray_full");
    expect(timeout.warning).toMatch(/Tray may be full/);
  });

  it("persists recoverable scan batches and records through local storage", async () => {
    const batch = await saveScanBatch(
      createScannerBatch({
        mode: "stacking_feeder",
        destination: "owned_cards",
      }),
    );
    const record = createScanRecordFromCard({
      batchId: batch.id,
      card: localCardCatalog[0],
      status: "assumed",
      destination: "owned_cards",
    });
    await addScanRecord(record);

    expect((await getRecoverableScanBatch())?.id).toBe(batch.id);
    expect(await listScanRecords(batch.id)).toHaveLength(1);
  });

  it("renders scanner mode switching and tray-full controls", async () => {
    renderWithAppProviders(<ScanCardsScreen />, "/scan");
    await screen.findByRole("heading", { name: "Scan Cards" });
    await userEvent.selectOptions(screen.getByLabelText("Scanner mode"), "stacking_feeder");
    await userEvent.click(screen.getByRole("button", { name: "Too-Close Cue" }));
    expect(await screen.findByText(/Too-close cue detected/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Trigger Tray Full Prompt" }));
    expect(await screen.findByText(/Tray may be full/i)).toBeInTheDocument();
  });
});

describe("Prompt 4 analyzer, recommendations, and Smart Build", () => {
  beforeEach(async () => {
    await resetDatabaseForTests();
  });

  it("analyzes deck health and excludes maybeboard/cuts from Commander count", async () => {
    let deck = await createTatyovaDeck();
    deck = await addDeckCard(deck.id, manualCard("Cultivate", "Sorcery", ["G"], ["ramp"]));
    deck = await addDeckCard(deck.id, {
      ...manualCard("Rancor", "Enchantment", ["G"], ["voltron"]),
      destination: "maybeboard",
    }, "maybeboard");

    const analysis = analyzeDeck(deck);
    expect(analysis.cardCount).toBe(2);
    expect(analysis.health).toBe("Incomplete");
    expect(analysis.categoryCounts.sorceries).toBe(1);
  });

  it("keeps recommendations and Smart Build proposals inside commander color identity", async () => {
    const deck = await createTatyovaDeck();
    const recommendations = getDeckRecommendations({ deck });
    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations.every((recommendation) => !recommendation.colorIdentity.includes("R"))).toBe(true);
    expect(recommendations.some((recommendation) => recommendation.name === "Lightning Bolt")).toBe(false);

    const config = createSmartBuildConfig({
      deck,
      mode: "ideal_goal_based",
    });
    const result = runSmartBuild({ deck, config });
    expect(result.proposedCards?.length).toBeGreaterThan(0);
    expect(result.rejectedOutsideColorIdentity).toHaveLength(0);
    expect(result.proposedCards?.every((card) => !card.colorIdentity.includes("R"))).toBe(true);
  });

  it("renders Analyzer with Smart Build and Recommendation tabs", async () => {
    await createTatyovaDeck();
    renderWithAppProviders(<AnalyzerScreen />, "/analyzer?tab=smart-build");
    await screen.findByRole("heading", { name: "Analyzer" });
    await userEvent.click(screen.getByRole("tab", { name: "Recommendations" }));
    expect(await screen.findByText("Best Fits")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Smart Build" }));
    await userEvent.click(screen.getByRole("button", { name: /Generate Smart Build Review/i }));
    expect(await screen.findByText("Build Summary")).toBeInTheDocument();
  });
});
