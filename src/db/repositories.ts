import { defaultAppSettings, defaultBracketLock } from "../data/defaults";
import { db } from "./database";
import type {
  AppSettings,
  BracketLock,
  Deck,
  DeckGoal,
  FavoriteItem,
  OwnershipPreference,
} from "../types/domain";
import { createId, nowIso } from "../utils/ids";

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
