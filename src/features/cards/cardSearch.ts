import { localCardCatalog, type CatalogCard } from "../../data/cardCatalog";
import type { CommanderColor, Deck, DeckCard, OwnedCard } from "../../types/domain";
import { isWithinCommanderColorIdentity } from "../../utils/colorIdentity";
import type { AddDestination, BuilderSectionId, ManualCardInput } from "../decks/builderTypes";
import { classifyCardSection } from "../decks/cardClassification";

export type SearchScope =
  | "all"
  | "owned"
  | "current_deck"
  | "maybeboard"
  | "cuts"
  | "commander_candidates"
  | "cached_only";

export type SearchView = "compact" | "image" | "grid";

export interface CardSearchFilters {
  query: string;
  exactPhrase?: string;
  typeText?: string;
  oracleText?: string;
  keyword?: string;
  scope: SearchScope;
}

export interface CardSearchContext {
  deck?: Deck;
  ownedCards?: OwnedCard[];
  manualSearch?: boolean;
}

export interface CardSearchResult {
  card: CatalogCard;
  score: number;
  badges: string[];
  legalInCommanderIdentity: boolean;
  inDeck: boolean;
  ownedQuantity: number;
  duplicate: boolean;
  recommendedSection: BuilderSectionId;
}

const emptyFilters: CardSearchFilters = {
  query: "",
  exactPhrase: "",
  typeText: "",
  oracleText: "",
  keyword: "",
  scope: "all",
};

export function normalizeSearchFilters(
  filters: Partial<CardSearchFilters>,
): CardSearchFilters {
  return {
    ...emptyFilters,
    ...filters,
    query: filters.query?.trim() ?? "",
    exactPhrase: filters.exactPhrase?.trim() ?? "",
    typeText: filters.typeText?.trim() ?? "",
    oracleText: filters.oracleText?.trim() ?? "",
    keyword: filters.keyword?.trim() ?? "",
    scope: filters.scope ?? "all",
  };
}

function normalized(value: string): string {
  return value.trim().toLowerCase();
}

function levenshtein(left: string, right: string): number {
  const rows = left.length + 1;
  const cols = right.length + 1;
  const distances = Array.from({ length: rows }, () => Array<number>(cols).fill(0));

  for (let row = 0; row < rows; row += 1) {
    distances[row][0] = row;
  }

  for (let col = 0; col < cols; col += 1) {
    distances[0][col] = col;
  }

  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const substitution = left[row - 1] === right[col - 1] ? 0 : 1;
      distances[row][col] = Math.min(
        distances[row - 1][col] + 1,
        distances[row][col - 1] + 1,
        distances[row - 1][col - 1] + substitution,
      );
    }
  }

  return distances[left.length][right.length];
}

function getDeckCardNames(deck?: Deck, section?: DeckCard["section"]): Set<string> {
  if (!deck) {
    return new Set();
  }

  const cards = [...deck.cards, ...deck.maybeboard, ...deck.cuts].filter(
    (card) => !section || card.section === section,
  );
  return new Set(cards.map((card) => normalized(card.name)));
}

function getOwnedQuantity(card: CatalogCard, ownedCards: readonly OwnedCard[] = []): number {
  return ownedCards
    .filter(
      (owned) =>
        owned.oracleId === card.oracleId ||
        owned.scryfallId === card.scryfallId ||
        normalized(owned.name) === normalized(card.name),
    )
    .reduce((total, owned) => total + owned.quantityOwned, 0);
}

function scoreCard(card: CatalogCard, filters: CardSearchFilters): number {
  const name = normalized(card.name);
  const query = normalized(filters.query);
  const typeText = normalized(filters.typeText ?? "");
  const oracleText = normalized(filters.oracleText ?? "");
  const exactPhrase = normalized(filters.exactPhrase ?? "");
  const keyword = normalized(filters.keyword ?? "");
  let score = 0;

  if (!query && !typeText && !oracleText && !exactPhrase && !keyword) {
    return 1;
  }

  if (query) {
    if (name === query) {
      score += 120;
    } else if (name.includes(query)) {
      score += 80;
    } else {
      const words = query.split(/\s+/).filter(Boolean);
      score += words.filter((word) => name.includes(word)).length * 18;
      const distance = levenshtein(name.slice(0, Math.max(query.length, 1)), query);
      if (distance <= 2) {
        score += 16 - distance * 4;
      }
    }
  }

  if (exactPhrase && `${name} ${normalized(card.oracleText)}`.includes(exactPhrase)) {
    score += 45;
  }

  if (typeText && normalized(card.typeLine).includes(typeText)) {
    score += 36;
  }

  if (oracleText && normalized(card.oracleText).includes(oracleText)) {
    score += 32;
  }

  if (
    keyword &&
    (card.keywords.some((cardKeyword) => normalized(cardKeyword).includes(keyword)) ||
      card.roles.some((role) => normalized(role).includes(keyword)))
  ) {
    score += 30;
  }

  return score;
}

function passesScope(
  card: CatalogCard,
  filters: CardSearchFilters,
  context: CardSearchContext,
): boolean {
  const deckNames = getDeckCardNames(context.deck);

  if (filters.scope === "owned") {
    return getOwnedQuantity(card, context.ownedCards) > 0;
  }

  if (filters.scope === "current_deck") {
    return deckNames.has(normalized(card.name));
  }

  if (filters.scope === "maybeboard") {
    return getDeckCardNames(context.deck, "maybeboard").has(normalized(card.name));
  }

  if (filters.scope === "cuts") {
    return getDeckCardNames(context.deck, "cuts").has(normalized(card.name));
  }

  if (filters.scope === "commander_candidates") {
    return Boolean(card.isCommanderCandidate) || normalized(card.typeLine).includes("legendary creature");
  }

  return true;
}

export function getSearchBadges(
  card: CatalogCard,
  context: CardSearchContext = {},
): string[] {
  const deckNames = getDeckCardNames(context.deck);
  const ownedQuantity = getOwnedQuantity(card, context.ownedCards);
  const legalInCommanderIdentity =
    !context.deck ||
    context.deck.colorIdentity.length === 0 ||
    isWithinCommanderColorIdentity(context.deck.colorIdentity, card.colorIdentity);
  const badges: string[] = [];

  badges.push(ownedQuantity > 0 ? "Owned" : "Missing");
  if (deckNames.has(normalized(card.name))) {
    badges.push("In Deck");
  }
  badges.push(legalInCommanderIdentity ? "Legal" : "Outside Identity");
  badges.push(card.commanderLegal ? "Commander Legal" : "Not Commander Legal");
  if (card.banned) {
    badges.push("Banned");
  }
  if (deckNames.has(normalized(card.name)) && card.typeLine.toLowerCase() !== "basic land") {
    badges.push("Duplicate");
  }
  if (card.roles.includes("high power")) {
    badges.push("High Power");
  }
  if (card.bracketImpact >= 0.45) {
    badges.push("cEDH Relevant");
  }
  if (card.roles.includes("synergy")) {
    badges.push("Synergy Pick");
  }
  if (context.manualSearch) {
    badges.push("Manual Search Result");
  }

  return badges;
}

export function searchCards(
  filtersInput: Partial<CardSearchFilters>,
  context: CardSearchContext = {},
  catalog: readonly CatalogCard[] = localCardCatalog,
): CardSearchResult[] {
  const filters = normalizeSearchFilters(filtersInput);

  return catalog
    .map((card) => ({ card, score: scoreCard(card, filters) }))
    .filter(({ card, score }) => score > 0 && passesScope(card, filters, context))
    .map(({ card, score }) => {
      const ownedQuantity = getOwnedQuantity(card, context.ownedCards);
      const inDeck = getDeckCardNames(context.deck).has(normalized(card.name));
      const legalInCommanderIdentity =
        !context.deck ||
        context.deck.colorIdentity.length === 0 ||
        isWithinCommanderColorIdentity(context.deck.colorIdentity, card.colorIdentity);

      return {
        card,
        score,
        badges: getSearchBadges(card, context),
        legalInCommanderIdentity,
        inDeck,
        ownedQuantity,
        duplicate: inDeck,
        recommendedSection: classifyCardSection(card.typeLine),
      };
    })
    .sort((left, right) => right.score - left.score || left.card.name.localeCompare(right.card.name));
}

export function catalogCardToManualInput({
  card,
  ownedQuantity = 0,
  destination = "main",
  requestedSection,
}: {
  card: CatalogCard;
  ownedQuantity?: number;
  destination?: AddDestination;
  requestedSection?: BuilderSectionId;
}): ManualCardInput {
  return {
    scryfallId: card.scryfallId,
    oracleId: card.oracleId,
    name: card.name,
    manaCost: card.manaCost,
    manaValue: card.manaValue,
    typeLine: card.typeLine,
    oracleText: card.oracleText,
    colorIdentity: card.colorIdentity,
    roleTags: card.roles,
    customTags: [],
    notes: "",
    owned: ownedQuantity > 0,
    destination,
    requestedSection,
  };
}

export function combineCommanderColorsFromCards(
  cards: readonly Pick<CatalogCard, "colorIdentity">[],
): CommanderColor[] {
  const order: CommanderColor[] = ["W", "U", "B", "R", "G"];
  const selected = new Set(cards.flatMap((card) => card.colorIdentity));
  return order.filter((color) => selected.has(color));
}
