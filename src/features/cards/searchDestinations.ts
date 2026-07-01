import { db } from "../../db/database";
import {
  addDeckCard,
  createBlankCommanderDeck,
  deleteDeck,
  removeDeckCard,
  type OwnedCardInput,
  upsertOwnedCard,
} from "../../db/repositories";
import type {
  CustomCollection,
  CustomCollectionEntry,
  Deck,
  DeckCard,
  DeckstateScryfallCard,
  DestinationAction,
  FavoriteItem,
  OwnedCard,
  SearchSelectionSession,
  SearchUndoTransaction,
  UpgradeList,
  UpgradeListEntry,
  WishlistEntry,
  WishlistPriority,
} from "../../types/domain";
import { isWithinCommanderColorIdentity } from "../../utils/colorIdentity";
import { createId, nowIso } from "../../utils/ids";
import type { AddDestination, BuilderSectionId, ManualCardInput } from "../decks/builderTypes";
import { getMainDeckCount, isBasicLandName } from "../decks/cardClassification";
import { evaluateAddCardRules } from "../decks/commanderRules";
import { pickCardImage, scryfallCardToManualInput } from "../../services/scryfall";

export type SearchActionContext =
  | "global"
  | "deck"
  | "section"
  | "owned"
  | "scanner"
  | "import"
  | "commander";

export type SearchDestinationType =
  | "current_deck"
  | "existing_deck"
  | "new_deck"
  | "owned"
  | "wishlist"
  | "maybeboard"
  | "cuts"
  | "upgrade_list"
  | "favorites"
  | "custom_collection"
  | "new_custom_collection";

export interface DestinationOption {
  id: SearchDestinationType;
  label: string;
  category: "decks" | "collections" | "planning";
  description: string;
  requiresDeck?: boolean;
  requiresExistingList?: boolean;
}

export interface DeckCompatibilitySummary {
  deck: Deck;
  compatibleCount: number;
  outsideIdentityCount: number;
  duplicateCount: number;
  currentCount: number;
  score: number;
}

export interface DestinationConflictSummary {
  compatible: DeckstateScryfallCard[];
  outsideIdentity: DeckstateScryfallCard[];
  duplicates: DeckstateScryfallCard[];
  overLimit: boolean;
  warnings: string[];
}

export interface AddToCardsResult {
  action: DestinationAction;
  undo?: SearchUndoTransaction;
  message: string;
  viewRoute?: string;
}

export interface SearchStateSnapshot {
  query: string;
  context: SearchActionContext;
  deckId?: string;
  destinationSection?: string;
  pageState: Record<string, unknown>;
  scrollPosition: number;
  selectedScryfallIds: string[];
}

type SearchDirectoryTable =
  | "wishlist"
  | "upgradeLists"
  | "upgradeListEntries"
  | "customCollections"
  | "customCollectionEntries"
  | "favorites";

interface DeleteRecordsPayload {
  records: {
    table: SearchDirectoryTable;
    ids: string[];
    previous?: unknown[];
  }[];
}

interface RestoreOwnedPayload {
  currentIds: string[];
  previous: OwnedCard[];
}

interface DeleteDeckCardsPayload {
  deckId: string;
  cardIds: string[];
}

interface DeleteDeckPayload {
  deckId: string;
}

const destinationOptions: DestinationOption[] = [
  {
    id: "current_deck",
    label: "Current Deck",
    category: "decks",
    description: "Add to the active deck with Commander rule review.",
    requiresDeck: true,
  },
  {
    id: "existing_deck",
    label: "Another Existing Deck",
    category: "decks",
    description: "Choose a saved deck and review compatibility.",
  },
  {
    id: "new_deck",
    label: "New Deck",
    category: "decks",
    description: "Create a Commander shell from the selected cards.",
  },
  {
    id: "owned",
    label: "Owned Cards",
    category: "collections",
    description: "Register ownership, exact printing, location, and notes.",
  },
  {
    id: "wishlist",
    label: "Wishlist",
    category: "collections",
    description: "Track wanted cards as a planning list, without prices.",
  },
  {
    id: "maybeboard",
    label: "Maybeboard",
    category: "planning",
    description: "Stage possible additions for a deck without affecting the 100.",
    requiresDeck: true,
  },
  {
    id: "cuts",
    label: "Cuts",
    category: "planning",
    description: "Remember rejected, removed, or evaluated deck options.",
    requiresDeck: true,
  },
  {
    id: "upgrade_list",
    label: "Upgrade List",
    category: "planning",
    description: "Add to an existing or newly created upgrade plan.",
  },
  {
    id: "favorites",
    label: "Favorites",
    category: "collections",
    description: "Save card favorites and optional Home pins.",
  },
  {
    id: "custom_collection",
    label: "Custom Collection",
    category: "collections",
    description: "Add to a local directory such as Staples or Future Commanders.",
  },
  {
    id: "new_custom_collection",
    label: "New Custom Collection",
    category: "collections",
    description: "Create a collection and add these cards.",
  },
];

function dispatchDirectoriesUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("deck-nexus:directories-updated"));
  }
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function deckAllCards(deck: Deck): DeckCard[] {
  return [...deck.cards, ...deck.maybeboard, ...deck.cuts];
}

function getCardKey(card: DeckstateScryfallCard): string {
  return card.oracleId || card.id || normalizeName(card.name);
}

function uniqueCards(cards: readonly DeckstateScryfallCard[]): DeckstateScryfallCard[] {
  const seen = new Set<string>();
  return cards.filter((card) => {
    const key = getCardKey(card);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function toOwnedInput(card: DeckstateScryfallCard, quantity: number): OwnedCardInput {
  const imageUri = pickCardImage(card.imageUris, "normal");

  return {
    name: card.name,
    quantityOwned: quantity,
    oracleId: card.oracleId,
    scryfallId: card.id,
    manaCost: card.manaCost,
    manaValue: card.manaValue,
    typeLine: card.typeLine,
    oracleText: card.oracleText,
    colorIdentity: card.colorIdentity,
    imageUri,
    legalities: card.legalities,
    tags: [],
    duplicateFlag: quantity > 1 ? "multiple_owned" : "none",
    printing: {
      name: card.name,
      oracleId: card.oracleId,
      scryfallId: card.id,
      setCode: card.setCode,
      setName: card.setName,
      collectorNumber: card.collectorNumber,
      language: card.lang,
      foil: false,
      condition: "unspecified",
      imageUri: pickCardImage(card.imageUris, "small") ?? imageUri ?? "",
      quantityOwned: quantity,
    },
  };
}

export function getUniversalDestinations({
  context,
  hasCurrentDeck,
}: {
  context: SearchActionContext;
  hasCurrentDeck: boolean;
}): DestinationOption[] {
  return destinationOptions.filter((option) => {
    if (option.id === "current_deck" && !hasCurrentDeck) {
      return false;
    }
    if ((option.id === "maybeboard" || option.id === "cuts") && !hasCurrentDeck && context !== "global") {
      return true;
    }
    return true;
  });
}

export function getPrimarySearchAction({
  context,
  hasCurrentDeck,
}: {
  context: SearchActionContext;
  hasCurrentDeck: boolean;
}): { label: string; destination?: SearchDestinationType; kind: "view" | "destination" | "scanner" | "import" } {
  if (context === "scanner") {
    return { label: "Use This Match", kind: "scanner" };
  }
  if (context === "import") {
    return { label: "Resolve Entry", kind: "import" };
  }
  if (context === "owned") {
    return { label: "Register Owned", kind: "destination", destination: "owned" };
  }
  if (context === "commander") {
    return { label: "Start New Deck", kind: "destination", destination: "new_deck" };
  }
  if ((context === "deck" || context === "section") && hasCurrentDeck) {
    return { label: "Add to Current Deck", kind: "destination", destination: "current_deck" };
  }
  return { label: "View Card", kind: "view" };
}

export function isCommanderEligible(card: DeckstateScryfallCard): boolean {
  const typeLine = card.typeLine.toLowerCase();
  const oracleText = card.oracleText?.toLowerCase() ?? "";

  return (
    (typeLine.includes("legendary") && typeLine.includes("creature")) ||
    typeLine.includes("background") ||
    oracleText.includes("can be your commander") ||
    oracleText.includes("partner")
  );
}

export function summarizeDeckCompatibility(
  deck: Deck,
  cards: readonly DeckstateScryfallCard[],
): DestinationConflictSummary {
  const existingNames = new Set(
    deck.cards
      .filter((card) => card.section === "main" || card.section === "commander")
      .map((card) => normalizeName(card.name)),
  );
  const compatible: DeckstateScryfallCard[] = [];
  const outsideIdentity: DeckstateScryfallCard[] = [];
  const duplicates: DeckstateScryfallCard[] = [];
  const warnings: string[] = [];

  for (const card of uniqueCards(cards)) {
    const withinIdentity =
      deck.colorIdentity.length === 0 || isWithinCommanderColorIdentity(deck.colorIdentity, card.colorIdentity);
    if (withinIdentity) {
      compatible.push(card);
    } else {
      outsideIdentity.push(card);
    }

    if (existingNames.has(normalizeName(card.name)) && !isBasicLandName(card.name)) {
      duplicates.push(card);
    }
  }

  if (outsideIdentity.length > 0) {
    warnings.push(`${outsideIdentity.length} outside commander color identity.`);
  }
  if (duplicates.length > 0) {
    warnings.push(`${duplicates.length} singleton duplicate conflict${duplicates.length === 1 ? "" : "s"}.`);
  }

  const overLimit = getMainDeckCount(deck.cards) + compatible.length > 100;
  if (overLimit) {
    warnings.push("Adding all compatible cards would put this deck over 100.");
  }

  return {
    compatible,
    outsideIdentity,
    duplicates,
    overLimit,
    warnings,
  };
}

export function rankDecksForCards(
  decks: readonly Deck[],
  cards: readonly DeckstateScryfallCard[],
): DeckCompatibilitySummary[] {
  return decks
    .map((deck) => {
      const summary = summarizeDeckCompatibility(deck, cards);
      const currentCount = getMainDeckCount(deck.cards);
      const favoriteScore = deck.tags.includes("favorite") ? 10 : 0;
      const score =
        summary.compatible.length * 20 -
        summary.outsideIdentity.length * 12 -
        summary.duplicates.length * 7 -
        (summary.overLimit ? 5 : 0) +
        favoriteScore;

      return {
        deck,
        compatibleCount: summary.compatible.length,
        outsideIdentityCount: summary.outsideIdentity.length,
        duplicateCount: summary.duplicates.length,
        currentCount,
        score,
      };
    })
    .sort((left, right) => right.score - left.score || right.deck.updatedAt.localeCompare(left.deck.updatedAt));
}

export async function persistSearchSelection(snapshot: SearchStateSnapshot): Promise<SearchSelectionSession> {
  const now = nowIso();
  const session: SearchSelectionSession = {
    id: createId("search-selection"),
    query: snapshot.query,
    selectedScryfallIds: snapshot.selectedScryfallIds,
    context: snapshot.context,
    deckId: snapshot.deckId,
    destinationSection: snapshot.destinationSection,
    pageState: snapshot.pageState,
    scrollPosition: snapshot.scrollPosition,
    createdAt: now,
    updatedAt: now,
  };

  await db.searchSelectionSessions.put(session);
  return session;
}

async function recordAction({
  actionType,
  selectedCards,
  destinationType,
  destinationId,
  status = "completed",
  conflicts = [],
  undoData = {},
}: {
  actionType: string;
  selectedCards: readonly DeckstateScryfallCard[];
  destinationType: SearchDestinationType | "scanner" | "import";
  destinationId?: string;
  status?: DestinationAction["status"];
  conflicts?: string[];
  undoData?: Record<string, unknown>;
}): Promise<DestinationAction> {
  const now = nowIso();
  const action: DestinationAction = {
    id: createId("destination-action"),
    actionType,
    selectedCardIds: selectedCards.map((card) => card.id),
    destinationType,
    destinationId,
    status,
    conflicts,
    undoData,
    createdAt: now,
    completedAt: status === "completed" ? now : undefined,
  };

  await db.destinationActionHistory.put(action);
  return action;
}

async function recordUndo(
  label: string,
  undoType: SearchUndoTransaction["undoType"],
  payload: Record<string, unknown>,
  actionId?: string,
): Promise<SearchUndoTransaction> {
  const undo: SearchUndoTransaction = {
    id: createId("search-undo"),
    label,
    actionId,
    undoType,
    payload,
    createdAt: nowIso(),
  };

  await db.searchUndoTransactions.put(undo);
  return undo;
}

function getTable(table: SearchDirectoryTable) {
  switch (table) {
    case "wishlist":
      return db.wishlist;
    case "upgradeLists":
      return db.upgradeLists;
    case "upgradeListEntries":
      return db.upgradeListEntries;
    case "customCollections":
      return db.customCollections;
    case "customCollectionEntries":
      return db.customCollectionEntries;
    case "favorites":
      return db.favorites;
  }
}

async function restoreDirectoryRecords(
  table: SearchDirectoryTable,
  previous: readonly unknown[],
): Promise<void> {
  if (previous.length === 0) {
    return;
  }

  switch (table) {
    case "wishlist":
      await db.wishlist.bulkPut(previous as WishlistEntry[]);
      return;
    case "upgradeLists":
      await db.upgradeLists.bulkPut(previous as UpgradeList[]);
      return;
    case "upgradeListEntries":
      await db.upgradeListEntries.bulkPut(previous as UpgradeListEntry[]);
      return;
    case "customCollections":
      await db.customCollections.bulkPut(previous as CustomCollection[]);
      return;
    case "customCollectionEntries":
      await db.customCollectionEntries.bulkPut(previous as CustomCollectionEntry[]);
      return;
    case "favorites":
      await db.favorites.bulkPut(previous as FavoriteItem[]);
      return;
  }
}

export async function applySearchUndoTransaction(undo: SearchUndoTransaction): Promise<string> {
  if (undo.undoType === "delete_deck_cards") {
    const payload = undo.payload as unknown as DeleteDeckCardsPayload;
    for (const cardId of payload.cardIds) {
      await removeDeckCard(payload.deckId, cardId);
    }
    await db.searchUndoTransactions.delete(undo.id);
    return "Deck additions were undone.";
  }

  if (undo.undoType === "delete_deck") {
    const payload = undo.payload as unknown as DeleteDeckPayload;
    await deleteDeck(payload.deckId);
    await db.searchUndoTransactions.delete(undo.id);
    return "New deck creation was undone.";
  }

  if (undo.undoType === "restore_owned_card") {
    const payload = undo.payload as unknown as RestoreOwnedPayload;
    await db.transaction("rw", db.ownedCards, async () => {
      for (const currentId of payload.currentIds) {
        await db.ownedCards.delete(currentId);
      }
      if (payload.previous.length > 0) {
        await db.ownedCards.bulkPut(payload.previous);
      }
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("deck-nexus:owned-updated"));
    }
    await db.searchUndoTransactions.delete(undo.id);
    return "Owned card update was undone.";
  }

  if (undo.undoType === "delete_records") {
    const payload = undo.payload as unknown as DeleteRecordsPayload;
    for (const record of payload.records) {
      const table = getTable(record.table);
      await table.bulkDelete(record.ids);
      if (record.previous && record.previous.length > 0) {
        await restoreDirectoryRecords(record.table, record.previous);
      }
    }
    dispatchDirectoriesUpdated();
    await db.searchUndoTransactions.delete(undo.id);
    return "Directory update was undone.";
  }

  await db.searchUndoTransactions.delete(undo.id);
  return "Action was undone.";
}

async function findAddedDeckCardIds(deckId: string, beforeIds: Set<string>): Promise<string[]> {
  const [main, maybeboard, cuts] = await Promise.all([
    db.deckCards.where("deckId").equals(deckId).toArray(),
    db.maybeboardCards.where("deckId").equals(deckId).toArray(),
    db.cutCards.where("deckId").equals(deckId).toArray(),
  ]);

  return [...main, ...maybeboard, ...cuts]
    .map((card) => card.id)
    .filter((cardId) => !beforeIds.has(cardId));
}

export async function addCardsToDeckFromSearch({
  deck,
  cards,
  destination,
  requestedSection,
  sourceQuery,
  allowConflicts,
}: {
  deck: Deck;
  cards: readonly DeckstateScryfallCard[];
  destination: AddDestination;
  requestedSection?: BuilderSectionId;
  sourceQuery: string;
  allowConflicts: boolean;
}): Promise<AddToCardsResult> {
  const unique = uniqueCards(cards);
  const beforeIds = new Set(deckAllCards(deck).map((card) => card.id));
  const conflicts: string[] = [];

  for (const card of unique) {
    const input = scryfallCardToManualInput({
      card,
      ownedQuantity: 0,
      destination,
      requestedSection,
    });
    const ruleResult = evaluateAddCardRules({ deck, input, mode: "guided" });
    conflicts.push(...ruleResult.warnings.map((warning) => `${card.name}: ${warning.message}`));

    if (!allowConflicts && destination === "main" && ruleResult.warnings.length > 0) {
      continue;
    }

    await addDeckCard(deck.id, { ...input, notes: sourceQuery ? `Added from Search: ${sourceQuery}` : input.notes }, destination);
  }

  const addedCardIds = await findAddedDeckCardIds(deck.id, beforeIds);
  const action = await recordAction({
    actionType: destination === "main" ? "add_to_deck" : `add_to_${destination}`,
    selectedCards: unique,
    destinationType: destination === "maybeboard" ? "maybeboard" : destination === "cuts" ? "cuts" : "current_deck",
    destinationId: deck.id,
    conflicts,
    undoData: { deckId: deck.id, cardIds: addedCardIds },
  });
  const undo =
    addedCardIds.length > 0
      ? await recordUndo("Undo deck additions", "delete_deck_cards", { deckId: deck.id, cardIds: addedCardIds }, action.id)
      : undefined;

  return {
    action,
    undo,
    message:
      addedCardIds.length === 1
        ? `Added ${unique[0]?.name ?? "card"} to ${deck.name}.`
        : `Added ${addedCardIds.length} cards to ${deck.name}.`,
    viewRoute: `/deck-builder/${deck.id}`,
  };
}

export async function createDeckFromSearch({
  cards,
  deckName,
  role,
  commanderId,
  sourceQuery,
}: {
  cards: readonly DeckstateScryfallCard[];
  deckName: string;
  role: "commander" | "main" | "maybeboard" | "inspiration";
  commanderId?: string;
  sourceQuery: string;
}): Promise<AddToCardsResult> {
  const unique = uniqueCards(cards);
  const selectedCommander =
    unique.find((card) => card.id === commanderId) ?? (role === "commander" ? unique[0] : undefined);
  const commanderIsEligible = selectedCommander ? isCommanderEligible(selectedCommander) : false;
  const deck = await createBlankCommanderDeck({
    name: deckName.trim() || `${selectedCommander?.name ?? unique[0]?.name ?? "Search"} Deck`,
    commanderName: selectedCommander && commanderIsEligible ? selectedCommander.name : undefined,
  });
  const addedIds: string[] = [];

  if (selectedCommander && commanderIsEligible && role === "commander") {
    const beforeIds = new Set(deckAllCards(deck).map((card) => card.id));
    const input = scryfallCardToManualInput({
      card: selectedCommander,
      ownedQuantity: 0,
      destination: "main",
      requestedSection: "commander",
    });
    await addDeckCard(deck.id, { ...input, requestedSection: "commander" }, "main");
    addedIds.push(...(await findAddedDeckCardIds(deck.id, beforeIds)));
  }

  if (role !== "inspiration") {
    const latest = (await db.decks.get(deck.id)) ?? deck;
    for (const card of unique.filter((card) => card.id !== selectedCommander?.id || role !== "commander")) {
      const withinIdentity =
        latest.colorIdentity.length === 0 || isWithinCommanderColorIdentity(latest.colorIdentity, card.colorIdentity);
      const destination: AddDestination = role === "maybeboard" || !withinIdentity ? "maybeboard" : "main";
      const beforeIds = new Set((await db.decks.get(deck.id)) ? deckAllCards((await db.decks.get(deck.id)) as Deck).map((deckCard) => deckCard.id) : []);
      const input = scryfallCardToManualInput({
        card,
        ownedQuantity: 0,
        destination,
      });
      await addDeckCard(deck.id, { ...input, notes: sourceQuery ? `New deck from Search: ${sourceQuery}` : input.notes }, destination);
      addedIds.push(...(await findAddedDeckCardIds(deck.id, beforeIds)));
    }
  }

  const action = await recordAction({
    actionType: "create_deck_from_search",
    selectedCards: unique,
    destinationType: "new_deck",
    destinationId: deck.id,
    conflicts: selectedCommander && !commanderIsEligible ? [`${selectedCommander.name} is not Commander eligible.`] : [],
    undoData: { deckId: deck.id, cardIds: addedIds },
  });
  const undo = await recordUndo("Undo new deck", "delete_deck", { deckId: deck.id }, action.id);

  return {
    action,
    undo,
    message: `${deck.name} created from Search.`,
    viewRoute: `/deck-builder/${deck.id}`,
  };
}

export async function registerOwnedFromSearch({
  cards,
  quantity,
}: {
  cards: readonly DeckstateScryfallCard[];
  quantity: number;
}): Promise<AddToCardsResult> {
  const unique = uniqueCards(cards);
  const previous = (
    await Promise.all(
      unique.map((card) =>
        db.ownedCards
          .filter((owned) => owned.oracleId === card.oracleId || normalizeName(owned.name) === normalizeName(card.name))
          .first(),
      ),
    )
  ).filter(Boolean) as OwnedCard[];
  const updated: OwnedCard[] = [];

  for (const card of unique) {
    updated.push(await upsertOwnedCard(toOwnedInput(card, quantity)));
  }

  const action = await recordAction({
    actionType: "register_owned",
    selectedCards: unique,
    destinationType: "owned",
    destinationId: "owned",
    undoData: { currentIds: updated.map((card) => card.id), previous },
  });
  const undo = await recordUndo(
    "Undo owned registration",
    "restore_owned_card",
    { currentIds: updated.map((card) => card.id), previous },
    action.id,
  );

  return {
    action,
    undo,
    message: unique.length === 1 ? `Added ${unique[0].name} to Owned Cards.` : `Added ${unique.length} cards to Owned Cards.`,
    viewRoute: "/owned",
  };
}

export async function addCardsToWishlistFromSearch({
  cards,
  quantity,
  priority,
  sourceQuery,
  intendedDeckId,
}: {
  cards: readonly DeckstateScryfallCard[];
  quantity: number;
  priority: WishlistPriority;
  sourceQuery: string;
  intendedDeckId?: string;
}): Promise<AddToCardsResult> {
  const unique = uniqueCards(cards);
  const createdIds: string[] = [];
  const previousEntries: WishlistEntry[] = [];
  const now = nowIso();

  for (const card of unique) {
    const existing = await db.wishlist
      .filter((entry) => entry.oracleId === card.oracleId || entry.scryfallId === card.id)
      .first();
    if (existing) {
      previousEntries.push(existing);
      await db.wishlist.put({
        ...existing,
        desiredQuantity: existing.desiredQuantity + quantity,
        priority,
        intendedDeckIds:
          intendedDeckId && !existing.intendedDeckIds.includes(intendedDeckId)
            ? [...existing.intendedDeckIds, intendedDeckId]
            : existing.intendedDeckIds,
        updatedAt: now,
      });
      createdIds.push(existing.id);
      continue;
    }

    const entry: WishlistEntry = {
      id: createId("wishlist"),
      scryfallId: card.id,
      oracleId: card.oracleId,
      cardName: card.name,
      preferredPrintingId: card.id,
      preferredSet: card.setCode,
      desiredQuantity: quantity,
      preferredFoilStatus: "either",
      preferredLanguage: card.lang,
      priority,
      intendedDeckIds: intendedDeckId ? [intendedDeckId] : [],
      intendedRole: "",
      intendedSection: undefined,
      goalMatches: [],
      notes: "",
      tags: [],
      sourceQuery,
      acquiredQuantity: 0,
      ownershipStatus: "missing",
      createdAt: now,
      updatedAt: now,
    };
    await db.wishlist.put(entry);
    createdIds.push(entry.id);
  }

  dispatchDirectoriesUpdated();
  const action = await recordAction({
    actionType: "add_to_wishlist",
    selectedCards: unique,
    destinationType: "wishlist",
    destinationId: "wishlist",
    undoData: { records: [{ table: "wishlist", ids: createdIds, previous: previousEntries }] },
  });
  const undo = await recordUndo(
    "Undo wishlist additions",
    "delete_records",
    { records: [{ table: "wishlist", ids: createdIds, previous: previousEntries }] },
    action.id,
  );

  return {
    action,
    undo,
    message: unique.length === 1 ? `Added ${unique[0].name} to Wishlist.` : `Added ${unique.length} cards to Wishlist.`,
    viewRoute: "/wishlist",
  };
}

export async function addCardsToUpgradeListFromSearch({
  cards,
  listId,
  listName,
  relatedDeckId,
  sourceQuery,
}: {
  cards: readonly DeckstateScryfallCard[];
  listId?: string;
  listName?: string;
  relatedDeckId?: string;
  sourceQuery: string;
}): Promise<AddToCardsResult> {
  const unique = uniqueCards(cards);
  const now = nowIso();
  let list = listId ? await db.upgradeLists.get(listId) : undefined;
  const createdListIds: string[] = [];

  if (!list) {
    list = {
      id: createId("upgrade-list"),
      name: listName?.trim() || "Search Upgrades",
      description: "Created from Search.",
      relatedDeckId,
      tags: [],
      favorite: false,
      showOnHome: false,
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    await db.upgradeLists.put(list);
    createdListIds.push(list.id);
  }

  const entries: UpgradeListEntry[] = unique.map((card) => ({
    id: createId("upgrade-entry"),
    upgradeListId: list.id,
    scryfallId: card.id,
    oracleId: card.oracleId,
    cardName: card.name,
    quantity: 1,
    role: "",
    goalMatches: [],
    bracketImpact: 0,
    ownedStatus: "missing",
    priority: "normal",
    notes: "",
    sourceQuery,
    completed: false,
    createdAt: now,
    updatedAt: now,
  }));
  await db.upgradeListEntries.bulkPut(entries);
  dispatchDirectoriesUpdated();

  const records: DeleteRecordsPayload["records"] = [
    { table: "upgradeListEntries", ids: entries.map((entry) => entry.id) },
  ];
  if (createdListIds.length > 0) {
    records.push({ table: "upgradeLists", ids: createdListIds });
  }
  const action = await recordAction({
    actionType: "add_to_upgrade_list",
    selectedCards: unique,
    destinationType: "upgrade_list",
    destinationId: list.id,
    undoData: { records },
  });
  const undo = await recordUndo("Undo upgrade list additions", "delete_records", { records }, action.id);

  return {
    action,
    undo,
    message: `Added ${unique.length} card${unique.length === 1 ? "" : "s"} to ${list.name}.`,
    viewRoute: "/upgrade-lists",
  };
}

export async function addCardsToCustomCollectionFromSearch({
  cards,
  collectionId,
  collectionName,
  sourceQuery,
}: {
  cards: readonly DeckstateScryfallCard[];
  collectionId?: string;
  collectionName?: string;
  sourceQuery: string;
}): Promise<AddToCardsResult> {
  const unique = uniqueCards(cards);
  const now = nowIso();
  let collection = collectionId ? await db.customCollections.get(collectionId) : undefined;
  const createdCollectionIds: string[] = [];

  if (!collection) {
    collection = {
      id: createId("collection"),
      name: collectionName?.trim() || "Search Collection",
      description: "Created from Search.",
      tags: [],
      favorite: false,
      showOnHome: false,
      icon: "archive",
      associatedDeckIds: [],
      sortMode: "custom",
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    await db.customCollections.put(collection);
    createdCollectionIds.push(collection.id);
  }

  const existingCount = await db.customCollectionEntries
    .where("collectionId")
    .equals(collection.id)
    .count();
  const entries: CustomCollectionEntry[] = unique.map((card, index) => ({
    id: createId("collection-entry"),
    collectionId: collection.id,
    scryfallId: card.id,
    oracleId: card.oracleId,
    cardName: card.name,
    quantity: 1,
    notes: "",
    tags: [],
    customStatus: "",
    ownedStatus: "missing",
    sourceQuery,
    customOrder: existingCount + index,
    createdAt: now,
    updatedAt: now,
  }));
  await db.customCollectionEntries.bulkPut(entries);
  dispatchDirectoriesUpdated();

  const records: DeleteRecordsPayload["records"] = [
    { table: "customCollectionEntries", ids: entries.map((entry) => entry.id) },
  ];
  if (createdCollectionIds.length > 0) {
    records.push({ table: "customCollections", ids: createdCollectionIds });
  }
  const action = await recordAction({
    actionType: "add_to_custom_collection",
    selectedCards: unique,
    destinationType: "custom_collection",
    destinationId: collection.id,
    undoData: { records },
  });
  const undo = await recordUndo("Undo collection additions", "delete_records", { records }, action.id);

  return {
    action,
    undo,
    message: `Added ${unique.length} card${unique.length === 1 ? "" : "s"} to ${collection.name}.`,
    viewRoute: "/collections",
  };
}

export async function favoriteCardsFromSearch({
  cards,
  sourceQuery,
}: {
  cards: readonly DeckstateScryfallCard[];
  sourceQuery: string;
}): Promise<AddToCardsResult> {
  const unique = uniqueCards(cards);
  const now = nowIso();
  const createdIds: string[] = [];
  const currentCount = await db.favorites.count();

  for (const [index, card] of unique.entries()) {
    const existing = await db.favorites
      .filter((favorite) => favorite.type === "card" && favorite.targetId === card.oracleId)
      .first();
    if (existing) {
      continue;
    }
    const favorite: FavoriteItem = {
      id: createId("favorite"),
      type: "card",
      targetId: card.oracleId,
      title: card.name,
      subtitle: sourceQuery ? `From Search: ${sourceQuery}` : "Favorite card",
      route: `/search?q=${encodeURIComponent(card.name)}`,
      order: currentCount + index + 1,
      colorIdentity: card.colorIdentity,
      createdAt: now,
      updatedAt: now,
    };
    await db.favorites.put(favorite);
    createdIds.push(favorite.id);
  }

  dispatchDirectoriesUpdated();
  const action = await recordAction({
    actionType: "favorite_cards",
    selectedCards: unique,
    destinationType: "favorites",
    destinationId: "favorites",
    undoData: { records: [{ table: "favorites", ids: createdIds }] },
  });
  const undo =
    createdIds.length > 0
      ? await recordUndo("Undo favorites", "delete_records", { records: [{ table: "favorites", ids: createdIds }] }, action.id)
      : undefined;

  return {
    action,
    undo,
    message: createdIds.length === 0 ? "Selected cards were already favorited." : `Favorited ${createdIds.length} card${createdIds.length === 1 ? "" : "s"}.`,
    viewRoute: "/library",
  };
}

export function buildManualInputForPreview({
  card,
  ownedQuantity,
  destination,
  requestedSection,
}: {
  card: DeckstateScryfallCard;
  ownedQuantity: number;
  destination: AddDestination;
  requestedSection?: BuilderSectionId;
}): ManualCardInput {
  return scryfallCardToManualInput({
    card,
    ownedQuantity,
    destination,
    requestedSection,
  });
}
