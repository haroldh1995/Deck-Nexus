import { defaultAppSettings, defaultBracketLock } from "../data/defaults";
import { db } from "./database";
import type {
  AppSettings,
  BracketLock,
  CommanderColor,
  Deck,
  DeckCard,
  DeckGoal,
  FavoriteItem,
  OwnedCard,
  OwnedDuplicateFlag,
  OwnedPrinting,
  OwnershipPreference,
  ScanBatch,
  ScanBatchDestination,
  ScanRecord,
  SmartBuildResult,
  DeckAnalysis,
  DecisionEvent,
} from "../types/domain";
import { createId, nowIso } from "../utils/ids";
import type { AddDestination, ManualCardInput } from "../features/decks/builderTypes";
import {
  cardInputToCategories,
  classifyCardSection,
} from "../features/decks/cardClassification";

export type CreateBlankDeckInput = {
  name: string;
  commanderName?: string;
  bracketLock?: BracketLock;
  goals?: string[];
  ownershipPreference?: OwnershipPreference;
};

export type SettingsPatch = Partial<
  Omit<AppSettings, "id" | "localFirstMode" | "updatedAt">
>;

export type DeckMetadataPatch = Partial<
  Pick<Deck, "name" | "notes" | "goals" | "bracketLock" | "tags" | "status">
>;

export type OwnedCardInput = {
  name: string;
  quantityOwned: number;
  oracleId?: string;
  scryfallId?: string;
  manaCost?: string;
  typeLine?: string;
  oracleText?: string;
  colorIdentity?: CommanderColor[];
  tags?: string[];
  notes?: string;
  favorite?: boolean;
  storageLocation?: string;
  duplicateFlag?: OwnedDuplicateFlag;
  printing?: Partial<OwnedPrinting>;
};

function dispatchLocalEvent(eventName: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(eventName));
  }
}

export async function ensureAppSettings(): Promise<AppSettings> {
  const existing = await db.settings.get("app");

  if (existing) {
    return {
      ...defaultAppSettings,
      ...existing,
      localFirstMode: true,
    };
  }

  const settings = {
    ...defaultAppSettings,
    updatedAt: nowIso(),
  };

  await db.settings.put(settings);
  return settings;
}

export async function updateAppSettings(
  patch: SettingsPatch,
): Promise<AppSettings> {
  const current = await ensureAppSettings();
  const next: AppSettings = {
    ...current,
    ...patch,
    localFirstMode: true,
    updatedAt: nowIso(),
  };

  await db.settings.put(next);
  dispatchLocalEvent("deck-nexus:settings-updated");
  return next;
}

export async function listDecks(): Promise<Deck[]> {
  return db.decks.orderBy("updatedAt").reverse().toArray();
}

export async function getDeck(deckId: string): Promise<Deck | undefined> {
  return db.decks.get(deckId);
}

function getDeckCardStore(section: DeckCard["section"]) {
  if (section === "maybeboard") {
    return db.maybeboardCards;
  }

  if (section === "cuts") {
    return db.cutCards;
  }

  return db.deckCards;
}

function uniqueColors(colors: readonly CommanderColor[]): CommanderColor[] {
  const order: CommanderColor[] = ["W", "U", "B", "R", "G"];
  const set = new Set(colors);
  return order.filter((color) => set.has(color));
}

function updateCommanderState(deck: Deck): Deck {
  const commanders = deck.cards.filter((card) => card.section === "commander");
  const commanderNames =
    commanders.length > 0
      ? commanders.map((card) => card.name)
      : deck.commanderNames;
  const colorIdentity =
    commanders.length > 0
      ? uniqueColors(
          commanders.flatMap((card) => card.colorIdentity ?? []),
        )
      : deck.colorIdentity;

  return {
    ...deck,
    commanderNames,
    colorIdentity,
  };
}

function assignCardToDeckArrays(deck: Deck, card: DeckCard): Deck {
  if (card.section === "maybeboard") {
    return { ...deck, maybeboard: [...deck.maybeboard, card] };
  }

  if (card.section === "cuts") {
    return { ...deck, cuts: [...deck.cuts, card] };
  }

  return { ...deck, cards: [...deck.cards, card] };
}

function removeCardFromDeckArrays(deck: Deck, cardId: string): Deck {
  return {
    ...deck,
    cards: deck.cards.filter((card) => card.id !== cardId),
    maybeboard: deck.maybeboard.filter((card) => card.id !== cardId),
    cuts: deck.cuts.filter((card) => card.id !== cardId),
  };
}

function findDeckCard(deck: Deck, cardId: string): DeckCard | undefined {
  return [...deck.cards, ...deck.maybeboard, ...deck.cuts].find(
    (card) => card.id === cardId,
  );
}

function mapDeckCards(
  deck: Deck,
  cardId: string,
  mapper: (card: DeckCard) => DeckCard,
): Deck {
  return {
    ...deck,
    cards: deck.cards.map((card) => (card.id === cardId ? mapper(card) : card)),
    maybeboard: deck.maybeboard.map((card) =>
      card.id === cardId ? mapper(card) : card,
    ),
    cuts: deck.cuts.map((card) => (card.id === cardId ? mapper(card) : card)),
  };
}

function destinationToDeckCardSection(
  destination: AddDestination,
  input: ManualCardInput,
): DeckCard["section"] {
  if (destination === "maybeboard") {
    return "maybeboard";
  }

  if (destination === "cuts") {
    return "cuts";
  }

  return classifyCardSection(input.typeLine, input.requestedSection) ===
    "commander"
    ? "commander"
    : "main";
}

export function createDeckCardFromInput(
  deckId: string,
  input: ManualCardInput,
  destination: AddDestination = input.destination,
): DeckCard {
  const now = nowIso();
  const cardSection = destinationToDeckCardSection(destination, input);
  const categories = cardInputToCategories({
    ...input,
    destination,
  });

  return {
    id: createId("card"),
    deckId,
    scryfallId: createId("local-scryfall"),
    oracleId: createId("local-oracle"),
    name: input.name.trim(),
    manaCost: input.manaCost?.trim(),
    typeLine: input.typeLine.trim(),
    oracleText: input.oracleText?.trim(),
    colorIdentity: input.colorIdentity,
    quantity: 1,
    section: cardSection,
    categories,
    roleTags: input.roleTags,
    customTags: input.customTags,
    notes: input.notes?.trim() ?? "",
    protected: false,
    ownedQuantityAtAdd: input.owned ? 1 : 0,
    missingQuantity: input.owned ? 0 : 1,
    addedAt: now,
    updatedAt: now,
  };
}

export function createGoalFromName(name: string, priority: number): DeckGoal {
  return {
    id: createId("goal"),
    name,
    priority,
    type: "custom",
    settings: {},
  };
}

export async function createBlankCommanderDeck(
  input: CreateBlankDeckInput,
): Promise<Deck> {
  const settings = await ensureAppSettings();
  const now = nowIso();
  const commanderName = input.commanderName?.trim();
  const goals =
    input.goals
      ?.map((goal) => goal.trim())
      .filter(Boolean)
      .map((goal, index) => createGoalFromName(goal, index + 1)) ?? [];

  const deck: Deck = {
    id: createId("deck"),
    name: input.name.trim(),
    format: "commander",
    commanderIds: [],
    commanderNames: commanderName ? [commanderName] : [],
    colorIdentity: [],
    cards: [],
    maybeboard: [],
    cuts: [],
    goals,
    tags: [],
    style: "unspecified",
    powerTarget: 5,
    bracketLock: input.bracketLock ?? settings.defaultBracketLock,
    ownershipPreference:
      input.ownershipPreference ?? settings.defaultOwnershipPreference,
    categoryStyle: "commander_roles",
    notes: "",
    status: "draft",
    originalImportText: "",
    unresolvedImports: [],
    createdFrom: "blank",
    createdAt: now,
    updatedAt: now,
  };

  await db.transaction("rw", db.decks, db.decisionEvents, async () => {
    await db.decks.add(deck);
    await db.decisionEvents.add({
      id: createId("decision"),
      deckId: deck.id,
      type: "deck_created",
      message: "Blank Commander deck created locally.",
      payload: {
        createdFrom: deck.createdFrom,
        commanderNames: deck.commanderNames,
      },
      createdAt: now,
    });
  });

  dispatchLocalEvent("deck-nexus:decks-updated");
  return deck;
}

export async function deleteDeck(deckId: string): Promise<void> {
  await db.transaction(
    "rw",
    db.decks,
    db.deckCards,
    db.maybeboardCards,
    db.cutCards,
    db.decisionEvents,
    async () => {
      await db.decks.delete(deckId);
      await db.deckCards.where("deckId").equals(deckId).delete();
      await db.maybeboardCards.where("deckId").equals(deckId).delete();
      await db.cutCards.where("deckId").equals(deckId).delete();
      await db.decisionEvents.add({
        id: createId("decision"),
        deckId,
        type: "deck_deleted",
        message: "Commander deck deleted locally.",
        payload: {},
        createdAt: nowIso(),
      });
    },
  );

  dispatchLocalEvent("deck-nexus:decks-updated");
}

export async function addDeckCard(
  deckId: string,
  input: ManualCardInput,
  destination: AddDestination = input.destination,
): Promise<Deck> {
  const deck = await getDeck(deckId);

  if (!deck) {
    throw new Error("Deck was not found.");
  }

  const card = createDeckCardFromInput(deckId, input, destination);
  const now = nowIso();
  const nextDeck = updateCommanderState({
    ...assignCardToDeckArrays(deck, card),
    updatedAt: now,
  });

  await db.transaction(
    "rw",
    db.decks,
    db.deckCards,
    db.maybeboardCards,
    db.cutCards,
    db.decisionEvents,
    async () => {
      await getDeckCardStore(card.section).put(card);
      await db.decks.put(nextDeck);
      await db.decisionEvents.add({
        id: createId("decision"),
        deckId,
        type: "deck_card_added",
        message: `${card.name} added locally.`,
        payload: { section: card.section, categories: card.categories },
        createdAt: now,
      });
    },
  );

  dispatchLocalEvent("deck-nexus:decks-updated");
  return nextDeck;
}

export async function updateDeckCard(
  deckId: string,
  cardId: string,
  patch: Partial<DeckCard>,
): Promise<Deck> {
  const deck = await getDeck(deckId);

  if (!deck) {
    throw new Error("Deck was not found.");
  }

  const currentCard = findDeckCard(deck, cardId);

  if (!currentCard) {
    throw new Error("Card was not found.");
  }

  const updatedCard: DeckCard = {
    ...currentCard,
    ...patch,
    id: currentCard.id,
    deckId,
    updatedAt: nowIso(),
  };
  const now = updatedCard.updatedAt;
  const nextDeck = updateCommanderState({
    ...mapDeckCards(deck, cardId, () => updatedCard),
    updatedAt: now,
  });

  await db.transaction(
    "rw",
    db.decks,
    db.deckCards,
    db.maybeboardCards,
    db.cutCards,
    db.decisionEvents,
    async () => {
      if (currentCard.section !== updatedCard.section) {
        await getDeckCardStore(currentCard.section).delete(cardId);
      }
      await getDeckCardStore(updatedCard.section).put(updatedCard);
      await db.decks.put(nextDeck);
      await db.decisionEvents.add({
        id: createId("decision"),
        deckId,
        type: "deck_card_updated",
        message: `${updatedCard.name} updated locally.`,
        payload: { cardId, section: updatedCard.section },
        createdAt: now,
      });
    },
  );

  dispatchLocalEvent("deck-nexus:decks-updated");
  return nextDeck;
}

export async function removeDeckCard(
  deckId: string,
  cardId: string,
): Promise<Deck> {
  const deck = await getDeck(deckId);

  if (!deck) {
    throw new Error("Deck was not found.");
  }

  const currentCard = findDeckCard(deck, cardId);

  if (!currentCard) {
    throw new Error("Card was not found.");
  }

  const now = nowIso();
  const nextDeck = updateCommanderState({
    ...removeCardFromDeckArrays(deck, cardId),
    updatedAt: now,
  });

  await db.transaction(
    "rw",
    db.decks,
    db.deckCards,
    db.maybeboardCards,
    db.cutCards,
    db.decisionEvents,
    async () => {
      await getDeckCardStore(currentCard.section).delete(cardId);
      await db.decks.put(nextDeck);
      await db.decisionEvents.add({
        id: createId("decision"),
        deckId,
        type: "deck_card_removed",
        message: `${currentCard.name} removed locally.`,
        payload: { cardId, section: currentCard.section },
        createdAt: now,
      });
    },
  );

  dispatchLocalEvent("deck-nexus:decks-updated");
  return nextDeck;
}

export async function moveDeckCard(
  deckId: string,
  cardId: string,
  destination: AddDestination,
  cutReason = "",
): Promise<Deck> {
  const deck = await getDeck(deckId);

  if (!deck) {
    throw new Error("Deck was not found.");
  }

  const currentCard = findDeckCard(deck, cardId);

  if (!currentCard) {
    throw new Error("Card was not found.");
  }

  const nextSection: DeckCard["section"] =
    destination === "main"
      ? currentCard.categories.includes("commander")
        ? "commander"
        : "main"
      : destination;
  const now = nowIso();
  const movedCard: DeckCard = {
    ...currentCard,
    section: nextSection,
    cutReason: nextSection === "cuts" ? cutReason : undefined,
    updatedAt: now,
  };
  const removedDeck = removeCardFromDeckArrays(deck, cardId);
  const nextDeck = updateCommanderState({
    ...assignCardToDeckArrays(removedDeck, movedCard),
    updatedAt: now,
  });

  await db.transaction(
    "rw",
    db.decks,
    db.deckCards,
    db.maybeboardCards,
    db.cutCards,
    db.decisionEvents,
    async () => {
      await getDeckCardStore(currentCard.section).delete(cardId);
      await getDeckCardStore(movedCard.section).put(movedCard);
      await db.decks.put(nextDeck);
      await db.decisionEvents.add({
        id: createId("decision"),
        deckId,
        type: "deck_card_moved",
        message: `${movedCard.name} moved locally.`,
        payload: { cardId, from: currentCard.section, to: movedCard.section },
        createdAt: now,
      });
    },
  );

  dispatchLocalEvent("deck-nexus:decks-updated");
  return nextDeck;
}

export async function replaceDeckCard(
  deckId: string,
  replaceCardId: string,
  input: ManualCardInput,
): Promise<Deck> {
  const deck = await getDeck(deckId);

  if (!deck) {
    throw new Error("Deck was not found.");
  }

  const oldCard = findDeckCard(deck, replaceCardId);

  if (!oldCard) {
    throw new Error("Replacement target was not found.");
  }

  const now = nowIso();
  const cutCard: DeckCard = {
    ...oldCard,
    section: "cuts",
    cutReason: `Replaced by ${input.name.trim()}`,
    updatedAt: now,
  };
  const newCard = createDeckCardFromInput(deckId, input, "main");
  const withoutOld = removeCardFromDeckArrays(deck, replaceCardId);
  const nextDeck = updateCommanderState({
    ...assignCardToDeckArrays(assignCardToDeckArrays(withoutOld, cutCard), newCard),
    updatedAt: now,
  });

  await db.transaction(
    "rw",
    db.decks,
    db.deckCards,
    db.maybeboardCards,
    db.cutCards,
    db.decisionEvents,
    async () => {
      await getDeckCardStore(oldCard.section).delete(oldCard.id);
      await db.cutCards.put(cutCard);
      await getDeckCardStore(newCard.section).put(newCard);
      await db.decks.put(nextDeck);
      await db.decisionEvents.add({
        id: createId("decision"),
        deckId,
        type: "deck_card_replaced",
        message: `${oldCard.name} replaced locally.`,
        payload: { oldCardId: oldCard.id, newCardId: newCard.id },
        createdAt: now,
      });
    },
  );

  dispatchLocalEvent("deck-nexus:decks-updated");
  return nextDeck;
}

export async function updateDeckMetadata(
  deckId: string,
  patch: DeckMetadataPatch,
): Promise<Deck> {
  const deck = await getDeck(deckId);

  if (!deck) {
    throw new Error("Deck was not found.");
  }

  const now = nowIso();
  const nextDeck: Deck = {
    ...deck,
    ...patch,
    id: deck.id,
    updatedAt: now,
  };

  await db.transaction("rw", db.decks, db.decisionEvents, async () => {
    await db.decks.put(nextDeck);
    await db.decisionEvents.add({
      id: createId("decision"),
      deckId,
      type: "deck_metadata_updated",
      message: "Deck metadata updated locally.",
      payload: { fields: Object.keys(patch) },
      createdAt: now,
    });
  });

  dispatchLocalEvent("deck-nexus:decks-updated");
  return nextDeck;
}

export async function duplicateDeck(deckId: string): Promise<Deck> {
  const deck = await getDeck(deckId);

  if (!deck) {
    throw new Error("Deck was not found.");
  }

  const now = nowIso();
  const nextId = createId("deck");
  const cloneCard = (card: DeckCard): DeckCard => ({
    ...card,
    id: createId("card"),
    deckId: nextId,
    addedAt: now,
    updatedAt: now,
  });
  const duplicate: Deck = {
    ...deck,
    id: nextId,
    name: `${deck.name} Copy`,
    cards: deck.cards.map(cloneCard),
    maybeboard: deck.maybeboard.map(cloneCard),
    cuts: deck.cuts.map(cloneCard),
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };

  await db.transaction(
    "rw",
    db.decks,
    db.deckCards,
    db.maybeboardCards,
    db.cutCards,
    db.decisionEvents,
    async () => {
      await db.decks.add(duplicate);
      await db.deckCards.bulkPut(duplicate.cards);
      await db.maybeboardCards.bulkPut(duplicate.maybeboard);
      await db.cutCards.bulkPut(duplicate.cuts);
      await db.decisionEvents.add({
        id: createId("decision"),
        deckId: duplicate.id,
        type: "deck_duplicated",
        message: "Deck duplicated locally.",
        payload: { sourceDeckId: deckId },
        createdAt: now,
      });
    },
  );

  dispatchLocalEvent("deck-nexus:decks-updated");
  return duplicate;
}

export async function listFavorites(): Promise<FavoriteItem[]> {
  return db.favorites.orderBy("order").toArray();
}

export function createBracketLockFromDefault(
  bracket: BracketLock["bracket"],
  enabled: boolean,
): BracketLock {
  return {
    ...defaultBracketLock,
    enabled,
    bracket,
  };
}

export async function listOwnedCards(): Promise<OwnedCard[]> {
  return db.ownedCards.orderBy("updatedAt").reverse().toArray();
}

export async function getOwnedCard(ownedCardId: string): Promise<OwnedCard | undefined> {
  return db.ownedCards.get(ownedCardId);
}

function createOwnedPrintingFromInput(
  input: OwnedCardInput,
  ownedCardId: string,
): OwnedPrinting | undefined {
  if (!input.printing && !input.scryfallId && !input.oracleId) {
    return undefined;
  }

  const printing = input.printing ?? {};

  return {
    id: printing.id ?? createId("printing"),
    scryfallId: printing.scryfallId ?? input.scryfallId ?? ownedCardId,
    oracleId: printing.oracleId ?? input.oracleId ?? ownedCardId,
    name: printing.name ?? input.name.trim(),
    setCode: printing.setCode ?? "local",
    setName: printing.setName ?? "Local Entry",
    collectorNumber: printing.collectorNumber ?? "",
    language: printing.language ?? "en",
    foil: printing.foil ?? false,
    condition: printing.condition ?? "unspecified",
    quantityOwned: printing.quantityOwned ?? input.quantityOwned,
    imageUri: printing.imageUri ?? "",
    lastScannedAt: printing.lastScannedAt,
  };
}

export async function upsertOwnedCard(input: OwnedCardInput): Promise<OwnedCard> {
  const normalizedName = input.name.trim();
  const existing = await db.ownedCards
    .filter((card) => card.name.trim().toLowerCase() === normalizedName.toLowerCase())
    .first();
  const now = nowIso();
  const baseId = existing?.id ?? createId("owned");
  const printing = createOwnedPrintingFromInput(input, baseId);
  const printings = printing
    ? [
        ...(existing?.printings.filter(
          (existingPrinting) => existingPrinting.id !== printing.id,
        ) ?? []),
        printing,
      ]
    : (existing?.printings ?? []);
  const next: OwnedCard = {
    id: baseId,
    oracleId: input.oracleId ?? existing?.oracleId ?? createId("owned-oracle"),
    scryfallId: input.scryfallId ?? existing?.scryfallId ?? createId("owned-scryfall"),
    name: normalizedName,
    manaCost: input.manaCost ?? existing?.manaCost,
    typeLine: input.typeLine ?? existing?.typeLine,
    oracleText: input.oracleText ?? existing?.oracleText,
    colorIdentity: input.colorIdentity ?? existing?.colorIdentity ?? [],
    quantityOwned: Math.max(0, input.quantityOwned),
    printings,
    tags: input.tags ?? existing?.tags ?? [],
    notes: input.notes ?? existing?.notes ?? "",
    favorite: input.favorite ?? existing?.favorite ?? false,
    storageLocation: input.storageLocation ?? existing?.storageLocation ?? "",
    duplicateFlag:
      input.duplicateFlag ??
      (typeof existing?.duplicateFlag === "boolean"
        ? existing.duplicateFlag
          ? "needs_review"
          : "none"
        : existing?.duplicateFlag) ??
      "none",
    deckUsage: existing?.deckUsage ?? {},
    lastScannedAt: existing?.lastScannedAt,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await db.transaction("rw", db.ownedCards, db.ownedPrintings, db.decisionEvents, async () => {
    await db.ownedCards.put(next);
    if (printing) {
      await db.ownedPrintings.put(printing);
    }
    await db.decisionEvents.add({
      id: createId("decision"),
      type: existing ? "owned_card_updated" : "owned_card_added",
      message: `${next.name} ownership updated locally.`,
      payload: { quantityOwned: next.quantityOwned, duplicateFlag: next.duplicateFlag },
      createdAt: now,
    });
  });

  dispatchLocalEvent("deck-nexus:owned-updated");
  return next;
}

export async function updateOwnedCard(
  ownedCardId: string,
  patch: Partial<OwnedCard>,
): Promise<OwnedCard> {
  const current = await db.ownedCards.get(ownedCardId);

  if (!current) {
    throw new Error("Owned card was not found.");
  }

  const next: OwnedCard = {
    ...current,
    ...patch,
    id: current.id,
    updatedAt: nowIso(),
  };

  await db.ownedCards.put(next);
  dispatchLocalEvent("deck-nexus:owned-updated");
  return next;
}

export async function deleteOwnedCard(ownedCardId: string): Promise<void> {
  await db.transaction("rw", db.ownedCards, db.ownedPrintings, db.decisionEvents, async () => {
    const current = await db.ownedCards.get(ownedCardId);
    await db.ownedCards.delete(ownedCardId);
    if (current) {
      await db.ownedPrintings.where("oracleId").equals(current.oracleId).delete();
      await db.decisionEvents.add({
        id: createId("decision"),
        type: "owned_card_removed",
        message: `${current.name} removed from owned registry.`,
        payload: { ownedCardId },
        createdAt: nowIso(),
      });
    }
  });

  dispatchLocalEvent("deck-nexus:owned-updated");
}

export async function listScanBatches(): Promise<ScanBatch[]> {
  return db.scannerBatches.orderBy("updatedAt").reverse().toArray();
}

export async function getScanBatch(batchId: string): Promise<ScanBatch | undefined> {
  return db.scannerBatches.get(batchId);
}

export async function getRecoverableScanBatch(): Promise<ScanBatch | undefined> {
  const recoverableStatuses: ScanBatch["status"][] = [
    "scanning",
    "paused",
    "needs_review",
    "reviewing",
    "partially_applied",
    "saved_for_later",
    "open",
  ];
  return db.scannerBatches
    .orderBy("updatedAt")
    .reverse()
    .filter((batch) => recoverableStatuses.includes(batch.status))
    .first();
}

export async function saveScanBatch(batch: ScanBatch): Promise<ScanBatch> {
  const next: ScanBatch = {
    ...batch,
    persistenceEnabled: true,
    updatedAt: nowIso(),
  };

  await db.scannerBatches.put(next);
  dispatchLocalEvent("deck-nexus:scanner-updated");
  return next;
}

export async function updateScanBatch(
  batchId: string,
  patch: Partial<ScanBatch>,
): Promise<ScanBatch> {
  const current = await db.scannerBatches.get(batchId);

  if (!current) {
    throw new Error("Scan batch was not found.");
  }

  return saveScanBatch({ ...current, ...patch, id: current.id });
}

export async function listScanRecords(batchId: string): Promise<ScanRecord[]> {
  return db.scanRecords.where("batchId").equals(batchId).sortBy("createdAt");
}

export async function addScanRecord(record: ScanRecord): Promise<ScanRecord> {
  const batch = await db.scannerBatches.get(record.batchId);

  await db.transaction("rw", db.scanRecords, db.scannerBatches, async () => {
    await db.scanRecords.put(record);
    if (batch) {
      await db.scannerBatches.put({
        ...batch,
        recordsCreated: batch.recordsCreated + record.quantity,
        status: batch.status === "open" ? "scanning" : batch.status,
        updatedAt: nowIso(),
      });
    }
  });

  dispatchLocalEvent("deck-nexus:scanner-updated");
  return record;
}

export async function updateScanRecord(
  recordId: string,
  patch: Partial<ScanRecord>,
): Promise<ScanRecord> {
  const current = await db.scanRecords.get(recordId);

  if (!current) {
    throw new Error("Scan record was not found.");
  }

  const next: ScanRecord = {
    ...current,
    ...patch,
    id: current.id,
    updatedAt: nowIso(),
  };

  await db.scanRecords.put(next);
  dispatchLocalEvent("deck-nexus:scanner-updated");
  return next;
}

export async function applyScanBatchToOwned(batchId: string): Promise<number> {
  const batch = await db.scannerBatches.get(batchId);
  const records = await listScanRecords(batchId);
  const applicableRecords = records.filter((record) =>
    ["confirmed", "assumed", "matched", "low_confidence"].includes(record.status),
  );

  if (!batch) {
    throw new Error("Scan batch was not found.");
  }

  for (const record of applicableRecords) {
    await upsertOwnedCard({
      name: record.name,
      quantityOwned: record.quantity,
      oracleId: record.oracleId,
      scryfallId: record.scryfallId,
      typeLine: record.typeLine,
      colorIdentity: record.colorIdentity,
      duplicateFlag: "none",
      printing: {
        name: record.name,
        oracleId: record.oracleId,
        scryfallId: record.scryfallId,
        quantityOwned: record.quantity,
        lastScannedAt: nowIso(),
      },
    });
    await updateScanRecord(record.id, {
      status: "applied",
      destination: "owned_cards" satisfies ScanBatchDestination,
    });
  }

  await updateScanBatch(batchId, {
    status: "applied",
    recordsCreated: records.length,
  });

  return applicableRecords.length;
}

export async function saveAnalysisSnapshot(analysis: DeckAnalysis): Promise<DeckAnalysis> {
  await db.analysisSnapshots.put(analysis);
  dispatchLocalEvent("deck-nexus:analysis-updated");
  return analysis;
}

export async function saveSmartBuildResult(
  result: SmartBuildResult,
): Promise<SmartBuildResult> {
  await db.smartBuildResults.put(result);
  dispatchLocalEvent("deck-nexus:smart-build-updated");
  return result;
}

export async function listSmartBuildResults(deckId: string): Promise<SmartBuildResult[]> {
  return db.smartBuildResults.where("deckId").equals(deckId).reverse().sortBy("createdAt");
}

export async function listDecisionEvents(deckId?: string) {
  if (!deckId) {
    return db.decisionEvents.orderBy("createdAt").reverse().toArray();
  }

  return db.decisionEvents
    .where("deckId")
    .equals(deckId)
    .reverse()
    .sortBy("createdAt");
}

export async function recordDecisionEvent(
  input: Omit<DecisionEvent, "id" | "createdAt"> & { id?: string; createdAt?: string },
): Promise<DecisionEvent> {
  const event: DecisionEvent = {
    id: input.id ?? createId("decision"),
    deckId: input.deckId,
    type: input.type,
    message: input.message,
    payload: input.payload,
    createdAt: input.createdAt ?? nowIso(),
  };

  await db.decisionEvents.add(event);
  dispatchLocalEvent("deck-nexus:decks-updated");
  return event;
}
