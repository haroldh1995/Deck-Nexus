import { db } from "../../db/database";
import type { ScryfallBulkDataRecord } from "../../types/domain";
import { nowIso } from "../../utils/ids";
import { bulkDataUrl } from "./scryfallEndpoints";
import { fetchScryfallJson } from "./scryfallClient";
import { cacheScryfallCards } from "./scryfallCache";
import { mapScryfallCard } from "./scryfallMappers";
import type { ScryfallBulkData, ScryfallCard, ScryfallList } from "./scryfallTypes";

function mapBulkData(record: ScryfallBulkData): ScryfallBulkDataRecord {
  return {
    id: record.id,
    type: record.type,
    name: record.name,
    description: record.description,
    downloadUri: record.download_uri,
    contentType: record.content_type,
    contentEncoding: record.content_encoding,
    compressedSize: record.compressed_size,
    updatedAt: record.updated_at,
    fetchedAt: nowIso(),
  };
}

export async function getScryfallBulkDataMetadata(signal?: AbortSignal): Promise<ScryfallBulkDataRecord[]> {
  const response = await fetchScryfallJson<ScryfallList<ScryfallBulkData>>({
    url: bulkDataUrl(),
    priority: "low",
    signal,
    cacheKey: "bulk-data",
  });
  const records = response.data.map(mapBulkData);
  await db.scryfallBulkData.bulkPut(records);
  return records;
}

export async function listCachedScryfallBulkData(): Promise<ScryfallBulkDataRecord[]> {
  return db.scryfallBulkData.orderBy("type").toArray();
}

export async function downloadScryfallOfflineCardDatabase({
  type = "default_cards",
  signal,
}: {
  type?: "default_cards" | "oracle_cards";
  signal?: AbortSignal;
} = {}): Promise<{ cardCount: number; compressedSize?: number; updatedAt?: string }> {
  const metadata = await getScryfallBulkDataMetadata(signal);
  const selected = metadata.find((record) => record.type === type);

  if (!selected?.downloadUri) {
    throw new Error("Scryfall bulk-data download was not available.");
  }

  const response = await fetch(selected.downloadUri, {
    signal,
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Offline card database download failed with status ${response.status}.`);
  }

  const rawCards = (await response.json()) as ScryfallCard[];
  const cards = rawCards.map(mapScryfallCard);
  await cacheScryfallCards(cards, "bulk");

  return {
    cardCount: cards.length,
    compressedSize: selected.compressedSize,
    updatedAt: selected.updatedAt,
  };
}

export async function deleteScryfallOfflineCardDatabase(): Promise<void> {
  await db.transaction(
    "rw",
    [
      db.scryfallCards,
      db.scryfallOracleCards,
      db.scryfallSearches,
      db.scryfallAutocomplete,
      db.scryfallBulkData,
      db.scryfallCacheMeta,
    ],
    async () => {
      await db.scryfallCards.clear();
      await db.scryfallOracleCards.clear();
      await db.scryfallSearches.clear();
      await db.scryfallAutocomplete.clear();
      await db.scryfallBulkData.clear();
      await db.scryfallCacheMeta.clear();
    },
  );
}
