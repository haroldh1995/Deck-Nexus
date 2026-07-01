import { localCardCatalog } from "../../data/cardCatalog";
import { db } from "../../db/database";
import type {
  DeckstateScryfallCard,
  ScryfallAutocompleteCacheRecord,
  ScryfallCardCacheRecord,
  ScryfallSearchCacheRecord,
} from "../../types/domain";
import { nowIso } from "../../utils/ids";

export const SCRYFALL_AUTOCOMPLETE_TTL_MS = 1000 * 60 * 60 * 24;
export const SCRYFALL_SEARCH_TTL_MS = 1000 * 60 * 30;
export const SCRYFALL_CARD_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export function normalizeScryfallText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeCacheKey(value: string): string {
  return normalizeScryfallText(value).toLowerCase();
}

export function isFresh(updatedAt: string | undefined, ttlMs: number): boolean {
  if (!updatedAt) {
    return false;
  }

  return Date.now() - Date.parse(updatedAt) < ttlMs;
}

export function autocompleteCacheKey(query: string): string {
  return `autocomplete:${normalizeCacheKey(query)}`;
}

export function searchCacheKey(input: {
  query: string;
  page: number;
  unique: string;
  sort: string;
  direction: string;
}): string {
  return [
    "search",
    normalizeCacheKey(input.query),
    `page:${input.page}`,
    `unique:${input.unique}`,
    `sort:${input.sort}`,
    `dir:${input.direction}`,
  ].join("|");
}

export async function cacheScryfallCards(cards: readonly DeckstateScryfallCard[], source: "live" | "bulk" = "live") {
  const now = nowIso();
  const records: ScryfallCardCacheRecord[] = cards.map((card) => ({
    id: card.id,
    oracleId: card.oracleId,
    name: card.name,
    setCode: card.setCode,
    collectorNumber: card.collectorNumber,
    card: {
      ...card,
      lastFetchedAt: now,
    },
    source,
    updatedAt: now,
    lastFetchedAt: now,
  }));

  if (records.length === 0) {
    return;
  }

  await db.transaction("rw", db.scryfallCards, db.scryfallOracleCards, async () => {
    await db.scryfallCards.bulkPut(records);
    await db.scryfallOracleCards.bulkPut(records.map((record) => ({ ...record, id: record.oracleId })));
  });
}

export async function getCachedCard(scryfallId: string): Promise<DeckstateScryfallCard | undefined> {
  const record = await db.scryfallCards.get(scryfallId);
  if (!record || !isFresh(record.updatedAt, SCRYFALL_CARD_TTL_MS)) {
    return record?.card;
  }

  return record.card;
}

export async function getCachedAutocomplete(query: string): Promise<ScryfallAutocompleteCacheRecord | undefined> {
  return db.scryfallAutocomplete.get(autocompleteCacheKey(query));
}

export async function putCachedAutocomplete(query: string, suggestions: readonly string[]) {
  const normalized = normalizeScryfallText(query);
  await db.scryfallAutocomplete.put({
    key: autocompleteCacheKey(normalized),
    query: normalized,
    suggestions: [...suggestions],
    updatedAt: nowIso(),
  });
}

export async function getCachedSearchResult(key: string): Promise<{
  record: ScryfallSearchCacheRecord;
  cards: DeckstateScryfallCard[];
} | undefined> {
  const record = await db.scryfallSearches.get(key);
  if (!record) {
    return undefined;
  }

  const cardRecords = await db.scryfallCards.bulkGet(record.cardIds);
  return {
    record,
    cards: cardRecords.flatMap((cardRecord) => (cardRecord ? [cardRecord.card] : [])),
  };
}

export async function putCachedSearchResult(
  record: Omit<ScryfallSearchCacheRecord, "updatedAt">,
) {
  await db.scryfallSearches.put({
    ...record,
    updatedAt: nowIso(),
  });
}

export async function searchCachedCards(query: string, limit = 60): Promise<DeckstateScryfallCard[]> {
  const normalized = normalizeCacheKey(query);
  const cached = await db.scryfallCards.toArray();
  const matched = cached
    .map((record) => record.card)
    .filter((card) => {
      const haystack = [
        card.name,
        card.typeLine,
        card.oracleText ?? "",
        card.keywords.join(" "),
        card.cardFaces.map((face) => `${face.name} ${face.typeLine ?? ""} ${face.oracleText ?? ""}`).join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return !normalized || haystack.includes(normalized);
    })
    .slice(0, limit);

  if (matched.length > 0) {
    return matched;
  }

  return localCardCatalog
    .filter((card) => {
      const haystack = [card.name, card.typeLine, card.oracleText, card.keywords.join(" "), card.roles.join(" ")]
        .join(" ")
        .toLowerCase();
      return !normalized || haystack.includes(normalized);
    })
    .slice(0, limit)
    .map((card) => ({
      id: card.scryfallId,
      oracleId: card.oracleId,
      name: card.name,
      lang: "en",
      apiUri: "",
      layout: "normal",
      manaCost: card.manaCost,
      manaValue: card.manaValue,
      typeLine: card.typeLine,
      oracleText: card.oracleText,
      colors: card.colorIdentity,
      colorIdentity: card.colorIdentity,
      keywords: card.keywords,
      legalities: { commander: card.commanderLegal ? "legal" : "not_legal" },
      games: ["paper"],
      setCode: "local",
      setName: "Seeded Local Cache",
      collectorNumber: "",
      rarity: "common",
      cardFaces: [],
      lastFetchedAt: new Date(0).toISOString(),
    }));
}
