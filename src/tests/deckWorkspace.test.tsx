import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { defaultBracketLock } from "../data/defaults";
import { CommanderIdentityOrbs } from "../features/decks/CommanderIdentityOrbs";
import {
  classifyCardSection,
  getCardBadges,
} from "../features/decks/cardClassification";
import {
  combineCommanderColorIdentity,
  deckWorkspaceSectionOrder,
  filterWorkspaceCards,
  getCardsForWorkspaceSection,
  getColorlessIdentityState,
  getCommanderIdentityOrbStates,
  getDeckCountSummary,
  getScrollRangeDescription,
  getWorkspaceSectionCounts,
  sortWorkspaceCards,
} from "../features/decks/deckWorkspace";
import type { CommanderColor, Deck, DeckCard } from "../types/domain";

function makeCard(
  id: string,
  name: string,
  typeLine: string,
  colorIdentity: CommanderColor[] = [],
  section: DeckCard["section"] = "main",
  quantity = 1,
): DeckCard {
  return {
    id,
    deckId: "workspace-deck",
    scryfallId: `scryfall-${id}`,
    oracleId: `oracle-${id}`,
    name,
    manaCost: "{2}",
    typeLine,
    oracleText: "",
    colorIdentity,
    quantity,
    section,
    categories: [classifyCardSection(typeLine, section === "commander" ? "commander" : undefined)],
    roleTags: [],
    customTags: [],
    notes: "",
    protected: false,
    ownedQuantityAtAdd: 1,
    missingQuantity: 0,
    addedAt: `2026-01-01T00:00:0${Math.min(Number(id.replace(/\D/g, "")) || 0, 9)}.000Z`,
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function makeDeck(cards: DeckCard[], maybeboard: DeckCard[] = [], cuts: DeckCard[] = []): Deck {
  const commanders = cards.filter((card) => card.section === "commander");

  return {
    id: "workspace-deck",
    name: "Workspace Test",
    format: "commander",
    commanderIds: [],
    commanderNames: commanders.map((card) => card.name),
    colorIdentity: combineCommanderColorIdentity(commanders),
    cards,
    maybeboard,
    cuts,
    goals: [],
    tags: [],
    style: "unspecified",
    powerTarget: 5,
    bracketLock: defaultBracketLock,
    ownershipPreference: "owned_first",
    categoryStyle: "commander_roles",
    notes: "",
    status: "draft",
    originalImportText: "",
    unresolvedImports: [],
    createdFrom: "blank",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("Deck workspace layout and counts", () => {
  it("keeps the authoritative seven-section order", () => {
    expect(deckWorkspaceSectionOrder).toEqual([
      "creatures",
      "instants",
      "sorceries",
      "artifacts",
      "enchantments",
      "otherPermanents",
      "lands",
    ]);
  });

  it("classifies future-proof card types and secondary badges", () => {
    expect(classifyCardSection("Artifact Creature")).toBe("creatures");
    expect(classifyCardSection("Enchantment Creature")).toBe("creatures");
    expect(classifyCardSection("Artifact Land")).toBe("lands");
    expect(classifyCardSection("Battle")).toBe("otherPermanents");
    expect(classifyCardSection("Planeswalker")).toBe("otherPermanents");
    expect(getCardBadges("Artifact Creature")).toContain("Artifact");
    expect(getCardBadges("Enchantment Creature")).toContain("Enchantment");
    expect(getCardBadges("Artifact Land")).toEqual(["Artifact", "Land"]);
  });

  it("calculates section counts and excludes maybeboard and cuts from main totals", () => {
    const deck = makeDeck(
      [
        makeCard("c0", "Tatyova", "Legendary Creature", ["G", "U"], "commander"),
        makeCard("c1", "Coiling Oracle", "Creature", ["G", "U"], "main", 2),
        makeCard("i1", "Counterspell", "Instant", ["U"]),
        makeCard("l1", "Command Tower", "Artifact Land", [], "main", 3),
      ],
      [makeCard("m1", "Maybe Instant", "Instant", ["U"], "maybeboard")],
      [makeCard("x1", "Cut Creature", "Creature", ["G"], "cuts")],
    );

    expect(getWorkspaceSectionCounts(deck).creatures).toBe(2);
    expect(getWorkspaceSectionCounts(deck).instants).toBe(1);
    expect(getWorkspaceSectionCounts(deck).lands).toBe(3);
    expect(getCardsForWorkspaceSection(deck, "instants", "maybeboard")).toHaveLength(1);
    expect(getDeckCountSummary(deck).count).toBe(7);
  });

  it("reports complete, illegal, and over-limit deck count states", () => {
    const commander = makeCard("c0", "Tatyova", "Legendary Creature", ["G", "U"], "commander");
    const completeDeck = makeDeck([
      commander,
      ...Array.from({ length: 99 }, (_, index) =>
        makeCard(`main-${index}`, `Main ${index}`, "Creature"),
      ),
    ]);
    const overDeck = makeDeck([
      commander,
      ...Array.from({ length: 100 }, (_, index) =>
        makeCard(`over-${index}`, `Over ${index}`, "Creature"),
      ),
    ]);

    expect(getDeckCountSummary(completeDeck).status).toBe("Legal");
    expect(getDeckCountSummary(completeDeck, true).status).toBe("Illegal");
    expect(getDeckCountSummary(overDeck).status).toBe("Over Limit");
  });

  it("combines commander color identity and exposes active orb states", () => {
    const identity = combineCommanderColorIdentity([
      makeCard("c0", "Partner One", "Legendary Creature", ["U"], "commander"),
      makeCard("c1", "Partner Two", "Legendary Creature", ["B", "R"], "commander"),
    ]);
    const orbs = getCommanderIdentityOrbStates(identity);

    expect(identity).toEqual(["U", "B", "R"]);
    expect(orbs.filter((orb) => orb.active).map((orb) => orb.color)).toEqual([
      "U",
      "B",
      "R",
    ]);
    expect(getColorlessIdentityState([], true).active).toBe(true);
    expect(getColorlessIdentityState([], false).active).toBe(false);
  });

  it("sorts, filters, and describes independent scroll ranges", () => {
    const missing = { ...makeCard("a", "A Missing", "Artifact"), missingQuantity: 1 };
    const protectedCard = { ...makeCard("b", "B Protected", "Artifact"), protected: true };
    const lowCost = { ...makeCard("c", "C Low", "Artifact"), manaCost: "{1}" };
    const highCost = { ...makeCard("d", "D High", "Artifact"), manaCost: "{5}" };

    expect(filterWorkspaceCards([missing, protectedCard], "missing")).toEqual([
      missing,
    ]);
    expect(sortWorkspaceCards([highCost, lowCost], "manaValue")).toEqual([
      lowCost,
      highCost,
    ]);
    expect(getScrollRangeDescription("Lands", 36, 120, 300, 60)).toBe(
      "Showing lands 3 through 7 of 36.",
    );
  });
});

describe("CommanderIdentityOrbs", () => {
  it("renders active and inactive accessible color identity orbs", () => {
    render(<CommanderIdentityOrbs colorIdentity={["U", "G"]} hasCommander />);

    expect(screen.getByLabelText("Blue color identity active.")).toBeInTheDocument();
    expect(screen.getByLabelText("Green color identity active.")).toBeInTheDocument();
    expect(screen.getByLabelText("White color identity inactive.")).toBeInTheDocument();
    expect(screen.getByLabelText("Colorless commander identity inactive.")).toBeInTheDocument();
  });

  it("shows colorless identity as active for a colorless commander", () => {
    render(<CommanderIdentityOrbs colorIdentity={[]} hasCommander />);

    expect(screen.getByLabelText("Colorless commander identity active.")).toBeInTheDocument();
  });
});
