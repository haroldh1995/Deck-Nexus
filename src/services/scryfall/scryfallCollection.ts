import { collectionUrl } from "./scryfallEndpoints";
import { fetchScryfallJson } from "./scryfallClient";
import { cacheScryfallCards } from "./scryfallCache";
import { mapScryfallCard } from "./scryfallMappers";
import type {
  ScryfallCard,
  ScryfallCollectionIdentifier,
  ScryfallCollectionResult,
  ScryfallList,
  ScryfallPriority,
} from "./scryfallTypes";

const SCRYFALL_COLLECTION_BATCH_SIZE = 75;

function stableIdentifierKey(identifier: ScryfallCollectionIdentifier): string {
  return JSON.stringify(identifier, Object.keys(identifier).sort());
}

export function chunkScryfallCollectionIdentifiers(
  identifiers: readonly ScryfallCollectionIdentifier[],
): ScryfallCollectionIdentifier[][] {
  const chunks: ScryfallCollectionIdentifier[][] = [];
  for (let index = 0; index < identifiers.length; index += SCRYFALL_COLLECTION_BATCH_SIZE) {
    chunks.push(identifiers.slice(index, index + SCRYFALL_COLLECTION_BATCH_SIZE));
  }
  return chunks;
}

export async function lookupScryfallCollection({
  identifiers,
  priority = "medium",
  signal,
}: {
  identifiers: readonly ScryfallCollectionIdentifier[];
  priority?: ScryfallPriority;
  signal?: AbortSignal;
}): Promise<ScryfallCollectionResult> {
  const found = [];
  const notFound: ScryfallCollectionIdentifier[] = [];

  for (const chunk of chunkScryfallCollectionIdentifiers(identifiers)) {
    const response = await fetchScryfallJson<
      ScryfallList<ScryfallCard> & { not_found?: ScryfallCollectionIdentifier[] }
    >({
      url: collectionUrl(),
      method: "POST",
      priority,
      signal,
      body: {
        identifiers: chunk,
      },
      cacheKey: `collection:${chunk.map(stableIdentifierKey).join("|")}`,
    });
    const cards = response.data.map(mapScryfallCard);
    await cacheScryfallCards(cards, "live");
    found.push(...cards);
    notFound.push(...(response.not_found ?? []));
  }

  return { found, notFound };
}
