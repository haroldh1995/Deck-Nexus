import { cardByIdUrl, namedCardUrl } from "./scryfallEndpoints";
import { fetchScryfallJson } from "./scryfallClient";
import { cacheScryfallCards, getCachedCard, normalizeScryfallText } from "./scryfallCache";
import { mapScryfallCard } from "./scryfallMappers";
import type { DeckstateScryfallCard } from "../../types/domain";
import type { NamedCardLookupOptions, ScryfallCard } from "./scryfallTypes";

export async function getScryfallCardById(
  scryfallId: string,
  signal?: AbortSignal,
): Promise<DeckstateScryfallCard> {
  const cached = await getCachedCard(scryfallId);

  try {
    const raw = await fetchScryfallJson<ScryfallCard>({
      url: cardByIdUrl(scryfallId),
      priority: "high",
      signal,
      cacheKey: `card:${scryfallId}`,
    });
    const card = mapScryfallCard(raw);
    await cacheScryfallCards([card], "live");
    return card;
  } catch (error) {
    if (cached) {
      return cached;
    }
    throw error;
  }
}

export async function getNamedScryfallCard(
  options: NamedCardLookupOptions,
  signal?: AbortSignal,
): Promise<DeckstateScryfallCard> {
  const lookupOptions: NamedCardLookupOptions = {
    ...options,
    exact: options.exact ? normalizeScryfallText(options.exact) : undefined,
    fuzzy: options.fuzzy ? normalizeScryfallText(options.fuzzy) : undefined,
  };
  const raw = await fetchScryfallJson<ScryfallCard>({
    url: namedCardUrl(lookupOptions),
    priority: options.priority ?? "high",
    signal,
    cacheKey: `named:${lookupOptions.exact ?? ""}:${lookupOptions.fuzzy ?? ""}:${lookupOptions.set ?? ""}`,
  });
  const card = mapScryfallCard(raw);
  await cacheScryfallCards([card], "live");
  return card;
}

export async function resolveScryfallCardName(
  typedName: string,
  signal?: AbortSignal,
): Promise<{ card: DeckstateScryfallCard; fuzzy: boolean }> {
  const normalized = normalizeScryfallText(typedName);

  try {
    return {
      card: await getNamedScryfallCard({ exact: normalized, priority: "high" }, signal),
      fuzzy: false,
    };
  } catch {
    return {
      card: await getNamedScryfallCard({ fuzzy: normalized, priority: "high" }, signal),
      fuzzy: true,
    };
  }
}
