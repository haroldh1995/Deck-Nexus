import { localCardCatalog, type CatalogCard } from "../../data/cardCatalog";
import type { DeckstateScryfallCard, OwnedCard } from "../../types/domain";
import { getNamedScryfallCard, resolveScryfallCardName, searchScryfallCards } from "../../services/scryfall";
import { normalizeImportedName, type ParsedImportEntry } from "./importParser";

export type ImportResolutionStatus = "resolved" | "ambiguous" | "unresolved";

export type ImportOwnershipStatus =
  | "owned"
  | "enough_copies_owned"
  | "partially_owned"
  | "not_owned"
  | "shared_between_decks"
  | "multiple_owned";

export interface ImportResolvedEntry extends ParsedImportEntry {
  status: ImportResolutionStatus;
  card?: DeckstateScryfallCard;
  catalogCard?: CatalogCard;
  fuzzy: boolean;
  exactPrinting: boolean;
  ownershipStatus: ImportOwnershipStatus;
  warnings: string[];
  removed: boolean;
  keepUnresolved: boolean;
}

function exactCatalogMatch(name: string): CatalogCard | undefined {
  const normalized = normalizeImportedName(name);
  return localCardCatalog.find((card) => normalizeImportedName(card.name) === normalized);
}

function matchingOwnedQuantity(
  entry: ParsedImportEntry,
  ownedCards: readonly OwnedCard[],
  card?: DeckstateScryfallCard,
  catalogCard?: CatalogCard,
): { quantity: number; hasSharedUsage: boolean; hasMultipleOwned: boolean } {
  const normalized = normalizeImportedName(entry.name);
  const oracleId = card?.oracleId ?? catalogCard?.oracleId;
  const scryfallId = card?.id ?? catalogCard?.scryfallId;
  const matches = ownedCards.filter(
    (owned) =>
      (oracleId && owned.oracleId === oracleId) ||
      (scryfallId && owned.scryfallId === scryfallId) ||
      normalizeImportedName(owned.name) === normalized,
  );

  return {
    quantity: matches.reduce((total, owned) => total + owned.quantityOwned, 0),
    hasSharedUsage: matches.some((owned) => owned.duplicateFlag === "sharing_between_decks"),
    hasMultipleOwned: matches.some((owned) => owned.duplicateFlag === "multiple_owned" || owned.quantityOwned > 1),
  };
}

export function classifyImportOwnership(
  entry: ParsedImportEntry,
  ownedCards: readonly OwnedCard[],
  card?: DeckstateScryfallCard,
  catalogCard?: CatalogCard,
): ImportOwnershipStatus {
  const owned = matchingOwnedQuantity(entry, ownedCards, card, catalogCard);

  if (owned.hasSharedUsage) return "shared_between_decks";
  if (owned.hasMultipleOwned && owned.quantity >= entry.quantity) return "multiple_owned";
  if (owned.quantity >= entry.quantity) return entry.quantity > 1 ? "enough_copies_owned" : "owned";
  if (owned.quantity > 0) return "partially_owned";
  return "not_owned";
}

async function resolveExactPrinting(
  entry: ParsedImportEntry,
  signal?: AbortSignal,
): Promise<DeckstateScryfallCard | undefined> {
  if (!entry.setCode || !entry.collectorNumber) {
    return undefined;
  }

  const page = await searchScryfallCards(
    {
      query: `set:${entry.setCode} cn:${entry.collectorNumber}`,
      unique: "prints",
      priority: "high",
    },
    signal,
  );

  return (
    page.cards.find((card) => normalizeImportedName(card.name) === normalizeImportedName(entry.name)) ??
    page.cards[0]
  );
}

export async function resolveImportEntry(
  entry: ParsedImportEntry,
  ownedCards: readonly OwnedCard[],
  signal?: AbortSignal,
): Promise<ImportResolvedEntry> {
  const warnings: string[] = [];

  try {
    const exactPrinting = await resolveExactPrinting(entry, signal);
    if (exactPrinting) {
      return {
        ...entry,
        status: normalizeImportedName(exactPrinting.name) === normalizeImportedName(entry.name) ? "resolved" : "ambiguous",
        card: exactPrinting,
        fuzzy: normalizeImportedName(exactPrinting.name) !== normalizeImportedName(entry.name),
        exactPrinting: true,
        ownershipStatus: classifyImportOwnership(entry, ownedCards, exactPrinting),
        warnings,
        removed: false,
        keepUnresolved: false,
      };
    }
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : "Exact printing lookup failed.");
  }

  try {
    const card = entry.setCode
      ? await getNamedScryfallCard({ exact: entry.name, set: entry.setCode, priority: "high" }, signal)
      : (await resolveScryfallCardName(entry.name, signal)).card;
    const fuzzy = normalizeImportedName(card.name) !== normalizeImportedName(entry.name);

    return {
      ...entry,
      status: fuzzy ? "ambiguous" : "resolved",
      card,
      fuzzy,
      exactPrinting: Boolean(entry.setCode && entry.collectorNumber),
      ownershipStatus: classifyImportOwnership(entry, ownedCards, card),
      warnings,
      removed: false,
      keepUnresolved: false,
    };
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : "Card lookup failed.");
  }

  const catalogCard = exactCatalogMatch(entry.name);
  if (catalogCard) {
    return {
      ...entry,
      status: "resolved",
      catalogCard,
      fuzzy: false,
      exactPrinting: false,
      ownershipStatus: classifyImportOwnership(entry, ownedCards, undefined, catalogCard),
      warnings,
      removed: false,
      keepUnresolved: false,
    };
  }

  return {
    ...entry,
    status: "unresolved",
    fuzzy: false,
    exactPrinting: false,
    ownershipStatus: classifyImportOwnership(entry, ownedCards),
    warnings,
    removed: false,
    keepUnresolved: true,
  };
}

export async function resolveDeckImportEntries(
  entries: readonly ParsedImportEntry[],
  ownedCards: readonly OwnedCard[],
  signal?: AbortSignal,
): Promise<ImportResolvedEntry[]> {
  const resolved: ImportResolvedEntry[] = [];

  for (const entry of entries) {
    if (signal?.aborted) {
      break;
    }
    resolved.push(await resolveImportEntry(entry, ownedCards, signal));
  }

  return resolved;
}
