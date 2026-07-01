import { autocompleteUrl } from "./scryfallEndpoints";
import { fetchScryfallJson } from "./scryfallClient";
import {
  getCachedAutocomplete,
  isFresh,
  normalizeScryfallText,
  putCachedAutocomplete,
  SCRYFALL_AUTOCOMPLETE_TTL_MS,
} from "./scryfallCache";
import type { ScryfallAutocompleteList, ScryfallAutocompleteResult, ScryfallPriority } from "./scryfallTypes";

export function shouldAutocomplete(query: string): boolean {
  return normalizeScryfallText(query).length >= 2;
}

export async function getCachedAutocompleteSuggestions(query: string): Promise<ScryfallAutocompleteResult | undefined> {
  const normalized = normalizeScryfallText(query);
  const cached = await getCachedAutocomplete(normalized);
  if (!cached) {
    return undefined;
  }

  return {
    query: normalized,
    suggestions: cached.suggestions,
    source: isFresh(cached.updatedAt, SCRYFALL_AUTOCOMPLETE_TTL_MS) ? "cache" : "offline",
  };
}

export async function autocompleteScryfallCards({
  query,
  includeExtras = false,
  priority = "medium",
  signal,
  cachedOnly = false,
}: {
  query: string;
  includeExtras?: boolean;
  priority?: ScryfallPriority;
  signal?: AbortSignal;
  cachedOnly?: boolean;
}): Promise<ScryfallAutocompleteResult> {
  const normalized = normalizeScryfallText(query);
  const cached = await getCachedAutocompleteSuggestions(normalized);

  if (!shouldAutocomplete(normalized) || cachedOnly) {
    return (
      cached ?? {
        query: normalized,
        suggestions: [],
        source: "offline",
      }
    );
  }

  try {
    const response = await fetchScryfallJson<ScryfallAutocompleteList>({
      url: autocompleteUrl(normalized, includeExtras),
      priority,
      signal,
      cacheKey: `autocomplete:${normalized}:${includeExtras}`,
    });
    await putCachedAutocomplete(normalized, response.data);
    return {
      query: normalized,
      suggestions: response.data,
      source: "live",
    };
  } catch {
    return (
      cached ?? {
        query: normalized,
        suggestions: [],
        source: "offline",
      }
    );
  }
}
