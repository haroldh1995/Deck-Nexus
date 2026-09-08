import type {
  CardPriceReference,
  CollectionValueSummary,
  CollectorCurrency,
  CollectorFinish,
  Deck,
  DeckCard,
  DeckValueSummary,
  ManualPriceOverride,
  OwnedCard,
  OwnedPrinting,
  PriceFetchStatus,
  TradeValueSummary,
} from "../types/domain";

export const PRICE_STALE_AFTER_DAYS = 7;
export const PRICE_RECENT_AFTER_HOURS = 24;
export const DEFAULT_COLLECTOR_CURRENCY: CollectorCurrency = "USD";

export interface TradeValueItem {
  id: string;
  side: "mine" | "theirs";
  name: string;
  quantity: number;
  finish?: CollectorFinish;
  prices?: CardPriceReference;
  manualPriceOverride?: ManualPriceOverride;
}

interface PriceSourceInput {
  usd?: string | number | null;
  usd_foil?: string | number | null;
  usd_etched?: string | number | null;
  eur?: string | number | null;
  eur_foil?: string | number | null;
  tix?: string | number | null;
}

function parsePrice(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function addDays(date: string, days: number): string {
  const timestamp = Date.parse(date);
  const base = Number.isFinite(timestamp) ? timestamp : Date.now();
  return new Date(base + days * 24 * 60 * 60 * 1000).toISOString();
}

export function createScryfallPriceReference(
  prices: PriceSourceInput | undefined,
  fetchedAt = new Date().toISOString(),
): CardPriceReference | undefined {
  if (!prices) {
    return undefined;
  }

  const nonfoil = parsePrice(prices.usd);
  const foil = parsePrice(prices.usd_foil);
  const etched = parsePrice(prices.usd_etched);
  const eur = parsePrice(prices.eur);
  const eurFoil = parsePrice(prices.eur_foil);
  const tix = parsePrice(prices.tix);
  const hasAnyPrice = [nonfoil, foil, etched, eur, eurFoil, tix].some(
    (value) => value !== null,
  );

  return {
    source: "scryfall",
    sourceLabel: "Scryfall",
    currency: DEFAULT_COLLECTOR_CURRENCY,
    nonfoil,
    foil,
    etched,
    eur,
    eurFoil,
    tix,
    market: nonfoil ?? foil ?? etched,
    low: null,
    mid: nonfoil ?? foil ?? etched,
    high: null,
    fetchedAt,
    staleAt: addDays(fetchedAt, PRICE_STALE_AFTER_DAYS),
    status: hasAnyPrice ? "current" : "unavailable",
  };
}

export function finishFromLegacyFoil(foil?: boolean): CollectorFinish {
  return foil ? "foil" : "nonfoil";
}

export function normalizeFinish(value?: string | null, foil?: boolean): CollectorFinish {
  if (value === "foil" || value === "etched" || value === "other" || value === "nonfoil") {
    return value;
  }
  return finishFromLegacyFoil(foil);
}

export function getPriceStatus(
  price: CardPriceReference | undefined,
  now = new Date(),
  offline = false,
): PriceFetchStatus {
  if (!price) {
    return "unavailable";
  }
  if (price.status === "fetch_failed" || price.status === "unavailable") {
    return price.status;
  }
  const fetchedAt = Date.parse(price.fetchedAt);
  const staleAt = Date.parse(price.staleAt);
  if (offline) {
    return "offline_cached";
  }
  if (Number.isFinite(staleAt) && now.getTime() >= staleAt) {
    return "stale";
  }
  if (
    Number.isFinite(fetchedAt) &&
    now.getTime() - fetchedAt <= PRICE_RECENT_AFTER_HOURS * 60 * 60 * 1000
  ) {
    return "current";
  }
  return "recently_updated";
}

export function selectReferencePrice(
  prices?: CardPriceReference,
  finish: CollectorFinish = "nonfoil",
  manualPriceOverride?: ManualPriceOverride,
): { value: number | null; currency: CollectorCurrency; source: string; manual: boolean } {
  if (manualPriceOverride && manualPriceOverride.value >= 0) {
    return {
      value: manualPriceOverride.value,
      currency: manualPriceOverride.currency,
      source: "Manual value",
      manual: true,
    };
  }

  if (!prices) {
    return {
      value: null,
      currency: DEFAULT_COLLECTOR_CURRENCY,
      source: "No price source",
      manual: false,
    };
  }

  const value =
    finish === "foil"
      ? prices.foil
      : finish === "etched"
        ? prices.etched
        : prices.nonfoil;

  return {
    value: value ?? null,
    currency: prices.currency,
    source: prices.sourceLabel,
    manual: false,
  };
}

export function formatCurrency(
  value: number | null | undefined,
  currency: CollectorCurrency = DEFAULT_COLLECTOR_CURRENCY,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "Price unavailable";
  }
  if (currency === "TIX") {
    return `${value.toFixed(2)} TIX`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function shortRelativeTime(date: string, now = new Date()): string {
  const timestamp = Date.parse(date);
  if (!Number.isFinite(timestamp)) {
    return "unknown";
  }
  const diffMs = Math.max(0, now.getTime() - timestamp);
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatPriceFreshness(
  price: CardPriceReference | undefined,
  options: { now?: Date; offline?: boolean } = {},
): string {
  if (!price) {
    return options.offline ? "Price unavailable offline" : "Price unavailable";
  }
  const status = getPriceStatus(price, options.now, options.offline);
  const updated = shortRelativeTime(price.sourceUpdatedAt ?? price.fetchedAt, options.now);
  if (status === "current") {
    return `Source: ${price.sourceLabel} - Updated ${updated}`;
  }
  if (status === "recently_updated") {
    return `Source: ${price.sourceLabel} - Recently updated ${updated}`;
  }
  if (status === "stale") {
    return `Cached stale price - Last updated ${updated}`;
  }
  if (status === "offline_cached") {
    return `Cached price - Last updated ${updated}`;
  }
  if (status === "fetch_failed") {
    return `Price fetch failed - Last successful update ${updated}`;
  }
  return "Price unavailable";
}

export function formatPriceReference(
  prices?: CardPriceReference,
  finish: CollectorFinish = "nonfoil",
  manualPriceOverride?: ManualPriceOverride,
): string {
  const selected = selectReferencePrice(prices, finish, manualPriceOverride);
  if (selected.value === null) {
    return "Price unavailable";
  }
  return `${formatCurrency(selected.value, selected.currency)} ${selected.manual ? "manual value" : finish}`;
}

function sortedPriceDates(cards: readonly OwnedCard[]): string[] {
  return cards
    .flatMap((card) => [
      card.priceUpdatedAt,
      card.prices?.fetchedAt,
      ...card.printings.flatMap((printing) => [
        printing.priceUpdatedAt,
        printing.prices?.fetchedAt,
      ]),
    ])
    .filter((value): value is string => Boolean(value))
    .sort();
}

function cardLevelPrice(card: OwnedCard) {
  const selected = selectReferencePrice(
    card.prices,
    "nonfoil",
    card.manualPriceOverride,
  );
  if (selected.value === null) {
    return undefined;
  }
  return {
    ...selected,
    value: selected.value,
    quantity: card.quantityOwned,
    finish: "nonfoil" as CollectorFinish,
  };
}

function printingPrice(printing: OwnedPrinting, fallback?: CardPriceReference) {
  const finish = normalizeFinish(printing.finish, printing.foil);
  const selected = selectReferencePrice(
    printing.prices ?? fallback,
    finish,
    printing.manualPriceOverride,
  );
  if (selected.value === null) {
    return undefined;
  }
  return {
    ...selected,
    value: selected.value,
    quantity: printing.quantityOwned,
    finish,
  };
}

export function summarizeCollectionValue(
  ownedCards: readonly OwnedCard[],
  currency: CollectorCurrency = DEFAULT_COLLECTOR_CURRENCY,
): CollectionValueSummary {
  let totalEstimatedValue = 0;
  let nonfoilValue = 0;
  let foilValue = 0;
  let etchedValue = 0;
  let pricedCardCount = 0;
  let missingPriceCount = 0;
  let unresolvedPrintingCount = 0;
  let valuableDuplicateCount = 0;
  const highValueCards: CollectionValueSummary["highestValueCards"] = [];

  for (const card of ownedCards) {
    const sources =
      card.printings.length > 0
        ? card.printings.map((printing) => printingPrice(printing, card.prices))
        : [cardLevelPrice(card)];
    let cardValue = 0;
    let cardPriced = false;

    for (const source of sources) {
      if (!source) {
        missingPriceCount += 1;
        continue;
      }
      const subtotal = source.value * source.quantity;
      totalEstimatedValue += subtotal;
      cardValue += subtotal;
      cardPriced = true;
      pricedCardCount += source.quantity;
      if (source.finish === "foil") {
        foilValue += subtotal;
      } else if (source.finish === "etched") {
        etchedValue += subtotal;
      } else {
        nonfoilValue += subtotal;
      }
    }

    if (card.printings.length === 0) {
      unresolvedPrintingCount += 1;
    }
    if (card.quantityOwned > 1 && cardValue > 0) {
      valuableDuplicateCount += 1;
    }
    if (cardPriced) {
      highValueCards.push({
        id: card.id,
        name: card.name,
        quantity: card.quantityOwned,
        value: Number(cardValue.toFixed(2)),
        source: card.manualPriceOverride ? "Manual value" : card.prices?.sourceLabel ?? "Printing price",
      });
    }
  }

  return {
    currency,
    totalEstimatedValue: Number(totalEstimatedValue.toFixed(2)),
    nonfoilValue: Number(nonfoilValue.toFixed(2)),
    foilValue: Number(foilValue.toFixed(2)),
    etchedValue: Number(etchedValue.toFixed(2)),
    pricedCardCount,
    missingPriceCount,
    unresolvedPrintingCount,
    highestValueCards: highValueCards
      .sort((left, right) => right.value - left.value)
      .slice(0, 8),
    valuableDuplicateCount,
    lastPriceRefresh: sortedPriceDates(ownedCards).at(-1),
  };
}

function matchingOwnedPrice(card: DeckCard, ownedCards: readonly OwnedCard[]) {
  return ownedCards.find(
    (owned) =>
      owned.oracleId === card.oracleId ||
      owned.scryfallId === card.scryfallId ||
      owned.name.trim().toLowerCase() === card.name.trim().toLowerCase(),
  );
}

function deckCardPrice(card: DeckCard, ownedCards: readonly OwnedCard[]) {
  const owned = matchingOwnedPrice(card, ownedCards);
  const finish = normalizeFinish(card.finish, false);
  const selected = selectReferencePrice(
    card.prices ?? owned?.prices,
    finish,
    card.manualPriceOverride ?? owned?.manualPriceOverride,
  );
  if (selected.value === null) {
    return undefined;
  }
  return { ...selected, value: selected.value, finish };
}

export function summarizeDeckValue(
  deck: Deck,
  ownedCards: readonly OwnedCard[] = [],
  currency: CollectorCurrency = DEFAULT_COLLECTOR_CURRENCY,
): DeckValueSummary {
  let totalEstimatedValue = 0;
  let commanderValue = 0;
  let mainDeckValue = 0;
  let ownedCopyValue = 0;
  let missingCardValue = 0;
  let maybeboardValue = 0;
  let cutsValue = 0;
  let pricedCardCount = 0;
  let missingPriceCount = 0;
  let highestValueCard: DeckValueSummary["highestValueCard"];

  for (const card of [...deck.cards, ...deck.maybeboard, ...deck.cuts]) {
    const selected = deckCardPrice(card, ownedCards);
    if (!selected) {
      missingPriceCount += 1;
      continue;
    }
    const subtotal = selected.value * card.quantity;
    totalEstimatedValue += subtotal;
    pricedCardCount += card.quantity;
    if (card.section === "commander") {
      commanderValue += subtotal;
    } else if (card.section === "main") {
      mainDeckValue += subtotal;
    } else if (card.section === "maybeboard") {
      maybeboardValue += subtotal;
    } else {
      cutsValue += subtotal;
    }
    if (card.missingQuantity > 0) {
      missingCardValue += selected.value * card.missingQuantity;
    } else {
      ownedCopyValue += subtotal;
    }
    if (!highestValueCard || subtotal > highestValueCard.value) {
      highestValueCard = {
        id: card.id,
        name: card.name,
        value: Number(subtotal.toFixed(2)),
        source: selected.source,
      };
    }
  }

  return {
    currency,
    totalEstimatedValue: Number(totalEstimatedValue.toFixed(2)),
    commanderValue: Number(commanderValue.toFixed(2)),
    mainDeckValue: Number(mainDeckValue.toFixed(2)),
    ownedCopyValue: Number(ownedCopyValue.toFixed(2)),
    missingCardValue: Number(missingCardValue.toFixed(2)),
    maybeboardValue: Number(maybeboardValue.toFixed(2)),
    cutsValue: Number(cutsValue.toFixed(2)),
    pricedCardCount,
    missingPriceCount,
    highestValueCard,
    lastPriceRefresh: sortedPriceDates(ownedCards).at(-1),
  };
}

export function compareTradeValues(
  items: readonly TradeValueItem[],
  currency: CollectorCurrency = DEFAULT_COLLECTOR_CURRENCY,
): TradeValueSummary {
  let mySideValue = 0;
  let theirSideValue = 0;
  let myMissingPriceCount = 0;
  let theirMissingPriceCount = 0;
  const priceDates: string[] = [];

  for (const item of items) {
    const selected = selectReferencePrice(
      item.prices,
      item.finish ?? "nonfoil",
      item.manualPriceOverride,
    );
    if (item.prices?.fetchedAt) {
      priceDates.push(item.prices.fetchedAt);
    }
    if (selected.value === null) {
      if (item.side === "mine") myMissingPriceCount += 1;
      else theirMissingPriceCount += 1;
      continue;
    }
    const value = selected.value;
    const subtotal = value * item.quantity;
    if (item.side === "mine") {
      mySideValue += subtotal;
    } else {
      theirSideValue += subtotal;
    }
  }

  const differenceTowardMe = theirSideValue - mySideValue;
  const larger = Math.max(mySideValue, theirSideValue);
  const smaller = Math.min(mySideValue, theirSideValue);
  const percentDifference = larger > 0 ? ((larger - smaller) / larger) * 100 : 0;
  const summary =
    Math.abs(differenceTowardMe) < 1
      ? "Roughly even by current reference prices"
      : differenceTowardMe > 0
        ? "Their side currently has higher reference value"
        : "Your side currently has higher reference value";

  return {
    currency,
    mySideValue: Number(mySideValue.toFixed(2)),
    theirSideValue: Number(theirSideValue.toFixed(2)),
    differenceTowardMe: Number(differenceTowardMe.toFixed(2)),
    percentDifference: Number(percentDifference.toFixed(2)),
    myMissingPriceCount,
    theirMissingPriceCount,
    summary,
    lastPriceRefresh: priceDates.sort().at(-1),
  };
}

export function isHighValueCard(
  value: number | null | undefined,
  threshold: number,
): boolean {
  return value !== null && value !== undefined && value >= threshold;
}
