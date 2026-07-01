import type { NamedCardLookupOptions, ScryfallSearchOptions } from "./scryfallTypes";

export const SCRYFALL_API_BASE = "https://api.scryfall.com";

function appendParams(url: URL, params: Record<string, string | number | boolean | undefined>) {
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export function makeScryfallUrl(path: string): string {
  return new URL(path, SCRYFALL_API_BASE).toString();
}

export function cardSearchUrl(options: ScryfallSearchOptions & { builtQuery: string }): string {
  const url = new URL("/cards/search", SCRYFALL_API_BASE);
  return appendParams(url, {
    q: options.builtQuery,
    unique: options.unique ?? "cards",
    order: options.sort ?? "name",
    dir: options.direction ?? "auto",
    include_extras: options.includeExtras ? "true" : undefined,
    page: options.page && options.page > 1 ? options.page : undefined,
  });
}

export function autocompleteUrl(query: string, includeExtras = false): string {
  const url = new URL("/cards/autocomplete", SCRYFALL_API_BASE);
  return appendParams(url, {
    q: query,
    include_extras: includeExtras ? "true" : undefined,
  });
}

export function namedCardUrl(options: NamedCardLookupOptions): string {
  const url = new URL("/cards/named", SCRYFALL_API_BASE);
  return appendParams(url, {
    exact: options.exact,
    fuzzy: options.fuzzy,
    set: options.set,
  });
}

export function cardByIdUrl(scryfallId: string): string {
  return makeScryfallUrl(`/cards/${encodeURIComponent(scryfallId)}`);
}

export function collectionUrl(): string {
  return makeScryfallUrl("/cards/collection");
}

export function bulkDataUrl(): string {
  return makeScryfallUrl("/bulk-data");
}
