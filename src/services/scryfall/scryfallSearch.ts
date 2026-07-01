import { cardSearchUrl } from "./scryfallEndpoints";
import { ScryfallServiceError } from "./scryfallErrors";
import { fetchScryfallJson } from "./scryfallClient";
import { mapScryfallCard } from "./scryfallMappers";
import {
  cacheScryfallCards,
  getCachedSearchResult,
  isFresh,
  normalizeScryfallText,
  putCachedSearchResult,
  SCRYFALL_SEARCH_TTL_MS,
  searchCacheKey,
  searchCachedCards,
} from "./scryfallCache";
import type { ScryfallCard, ScryfallList, ScryfallSearchOptions, ScryfallSearchResultPage } from "./scryfallTypes";

const scryfallSyntaxPattern =
  /(^|\s)(!?[-\w]+:|"[^"]+"|[-\w]+[<>]=?|is:|not:|legal:|banned:|restricted:|artist:|set:|rarity:|type:|t:|oracle:|o:|id:|c:|color:|keyword:|kw:)/i;

function quoteScryfallValue(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

export function isAdvancedScryfallQuery(query: string): boolean {
  return scryfallSyntaxPattern.test(query.trim());
}

export function buildScryfallQuery(options: ScryfallSearchOptions): string {
  const parts: string[] = [];
  const baseQuery = normalizeScryfallText(options.query);

  if (baseQuery) {
    parts.push(isAdvancedScryfallQuery(baseQuery) ? baseQuery : `name:${quoteScryfallValue(baseQuery)}`);
  }

  if (options.exactPhrase?.trim()) {
    parts.push(`(name:${quoteScryfallValue(options.exactPhrase)} or o:${quoteScryfallValue(options.exactPhrase)})`);
  }

  if (options.typeText?.trim()) {
    parts.push(`t:${quoteScryfallValue(options.typeText)}`);
  }

  if (options.oracleText?.trim()) {
    parts.push(`o:${quoteScryfallValue(options.oracleText)}`);
  }

  if (options.keyword?.trim()) {
    parts.push(`(keyword:${quoteScryfallValue(options.keyword)} or o:${quoteScryfallValue(options.keyword)})`);
  }

  if (options.commanderLegal) {
    parts.push("legal:commander");
  }

  if (options.commanderCandidates) {
    parts.push("(is:commander or t:background)");
  }

  if (options.commanderIdentity && options.commanderIdentity.length > 0) {
    parts.push(`id<=${options.commanderIdentity.join("").toLowerCase()}`);
  }

  return parts.join(" ").trim() || "legal:commander";
}

function pageFromOptions(options: ScryfallSearchOptions): number {
  if (options.pageUrl) {
    const page = new URL(options.pageUrl).searchParams.get("page");
    return page ? Number(page) : options.page ?? 1;
  }

  return options.page ?? 1;
}

export async function getCachedScryfallSearch(
  options: ScryfallSearchOptions,
): Promise<ScryfallSearchResultPage | undefined> {
  const builtQuery = buildScryfallQuery(options);
  const page = pageFromOptions(options);
  const key = searchCacheKey({
    query: builtQuery,
    page,
    unique: options.unique ?? "cards",
    sort: options.sort ?? "name",
    direction: options.direction ?? "auto",
  });
  const cached = await getCachedSearchResult(key);

  if (!cached) {
    return undefined;
  }

  return {
    cards: cached.cards,
    query: builtQuery,
    page,
    totalCards: cached.record.totalCards,
    hasMore: cached.record.hasMore,
    nextPage: cached.record.nextPage,
    warnings: [],
    source: isFresh(cached.record.updatedAt, SCRYFALL_SEARCH_TTL_MS) ? "cache" : "offline",
  };
}

export async function searchScryfallCards(
  options: ScryfallSearchOptions,
  signal?: AbortSignal,
): Promise<ScryfallSearchResultPage> {
  const builtQuery = buildScryfallQuery(options);
  const page = pageFromOptions(options);
  const key = searchCacheKey({
    query: builtQuery,
    page,
    unique: options.unique ?? "cards",
    sort: options.sort ?? "name",
    direction: options.direction ?? "auto",
  });

  if (options.cachedOnly) {
    const cached = await getCachedScryfallSearch(options);
    return (
      cached ?? {
        cards: await searchCachedCards(builtQuery),
        query: builtQuery,
        page,
        hasMore: false,
        warnings: ["Offline cache only."],
        source: "offline",
      }
    );
  }

  try {
    const url = options.pageUrl ?? cardSearchUrl({ ...options, builtQuery });
    const response = await fetchScryfallJson<ScryfallList<ScryfallCard>>({
      url,
      priority: options.priority ?? "high",
      signal,
      cacheKey: `search:${key}`,
    });
    const cards = response.data.map(mapScryfallCard);
    await cacheScryfallCards(cards, "live");
    await putCachedSearchResult({
      key,
      query: builtQuery,
      page,
      unique: options.unique ?? "cards",
      sort: options.sort ?? "name",
      direction: options.direction ?? "auto",
      cardIds: cards.map((card) => card.id),
      totalCards: response.total_cards,
      hasMore: response.has_more,
      nextPage: response.next_page,
    });

    return {
      cards,
      query: builtQuery,
      page,
      totalCards: response.total_cards,
      hasMore: response.has_more,
      nextPage: response.next_page,
      warnings: response.warnings ?? [],
      source: "live",
    };
  } catch (error) {
    if (error instanceof ScryfallServiceError && error.status === 404) {
      return {
        cards: [],
        query: builtQuery,
        page,
        hasMore: false,
        warnings: [error.details ?? error.message],
        source: "live",
      };
    }

    const cached = await getCachedScryfallSearch(options);
    if (cached) {
      return { ...cached, source: "offline", warnings: [error instanceof Error ? error.message : "Offline card data."] };
    }

    return {
      cards: await searchCachedCards(builtQuery),
      query: builtQuery,
      page,
      hasMore: false,
      warnings: [error instanceof Error ? error.message : "Offline card data."],
      source: "offline",
    };
  }
}
