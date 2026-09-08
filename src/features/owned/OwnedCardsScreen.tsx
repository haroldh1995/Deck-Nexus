import { useMemo, useState } from "react";
import { DollarSign, Heart, LibraryBig, Minus, Plus, RefreshCw, Repeat2, ShoppingCart, Trash2 } from "lucide-react";
import {
  compareTradeValues,
  formatCurrency,
  formatPriceFreshness,
  formatPriceReference,
  isHighValueCard,
  selectReferencePrice,
  summarizeCollectionValue,
  type TradeValueItem,
} from "../../collector";
import { HolographicPanel } from "../../components/HolographicPanel";
import { PageHeader } from "../../components/PageHeader";
import { StatusPill } from "../../components/StatusPill";
import { useSettings } from "../../app/useSettings";
import { useOwnedCards } from "../../db/hooks";
import { deleteOwnedCard, recordPriceHistoryPoint, updateOwnedCard, upsertOwnedCard } from "../../db/repositories";
import { resolveScryfallCardName } from "../../services/scryfall";
import type { CollectorFinish, CollectorTradeStatus, CommanderColor, OwnedCard, OwnedDuplicateFlag } from "../../types/domain";
import { parseColorIdentityInput, parseTagInput } from "../decks/cardClassification";

type OwnedView =
  | "all"
  | "recent"
  | "favorites"
  | "color"
  | "type"
  | "tag"
  | "deck_usage"
  | "unused"
  | "missing"
  | "printings"
  | "extras"
  | "collector"
  | "trade_binder"
  | "valuable_duplicates"
  | "stale_prices"
  | "missing_prices";

const ownedViews: { id: OwnedView; label: string }[] = [
  { id: "all", label: "All Owned Cards" },
  { id: "recent", label: "Recently Scanned" },
  { id: "favorites", label: "Favorites" },
  { id: "color", label: "By Color Identity" },
  { id: "type", label: "By Card Type" },
  { id: "tag", label: "By Tag" },
  { id: "deck_usage", label: "By Deck Usage" },
  { id: "unused", label: "Unused Owned Cards" },
  { id: "missing", label: "Missing From Decks" },
  { id: "printings", label: "Exact Printings" },
  { id: "extras", label: "Extras / Tokens" },
  { id: "collector", label: "Collector Value" },
  { id: "trade_binder", label: "Trade Binder" },
  { id: "valuable_duplicates", label: "Valuable Duplicates" },
  { id: "stale_prices", label: "Stale Prices" },
  { id: "missing_prices", label: "Missing Prices" },
];

const duplicateFlags: { id: OwnedDuplicateFlag; label: string }[] = [
  { id: "none", label: "None" },
  { id: "needs_review", label: "Needs Review" },
  { id: "multiple_owned", label: "Multiple Owned" },
  { id: "sharing_between_decks", label: "Sharing Between Decks" },
];

const tradeStatuses: { id: CollectorTradeStatus; label: string }[] = [
  { id: "not_for_trade", label: "Not for Trade" },
  { id: "for_trade", label: "For Trade" },
  { id: "possibly_for_trade", label: "Possibly for Trade" },
  { id: "want_to_keep", label: "Want to Keep" },
  { id: "high_priority_keep", label: "High Priority Keep" },
];

const finishOptions: { id: CollectorFinish; label: string }[] = [
  { id: "nonfoil", label: "Nonfoil" },
  { id: "foil", label: "Foil" },
  { id: "etched", label: "Etched" },
  { id: "other", label: "Other" },
];

const conditionOptions = [
  "Unknown",
  "Mint",
  "Near Mint",
  "Lightly Played",
  "Moderately Played",
  "Heavily Played",
  "Damaged",
];

export function OwnedCardsScreen() {
  const { ownedCards, loading } = useOwnedCards();
  const { settings } = useSettings();
  const [view, setView] = useState<OwnedView>("all");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [typeLine, setTypeLine] = useState("Creature");
  const [manaCost, setManaCost] = useState("");
  const [colors, setColors] = useState<CommanderColor[]>([]);
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const [storageLocation, setStorageLocation] = useState("");
  const [favorite, setFavorite] = useState(false);
  const [duplicateFlag, setDuplicateFlag] = useState<OwnedDuplicateFlag>("none");
  const [setCode, setSetCode] = useState("");
  const [collectorNumber, setCollectorNumber] = useState("");
  const [finish, setFinish] = useState<CollectorFinish>("nonfoil");
  const [language, setLanguage] = useState("en");
  const [condition, setCondition] = useState("Unknown");
  const [tradeStatus, setTradeStatus] = useState<CollectorTradeStatus>("not_for_trade");
  const [manualPrice, setManualPrice] = useState("");
  const [manualPriceNote, setManualPriceNote] = useState("");
  const [tradeItems, setTradeItems] = useState<TradeValueItem[]>([]);
  const [tradeSide, setTradeSide] = useState<"mine" | "theirs">("mine");
  const [tradeName, setTradeName] = useState("");
  const [tradeQuantity, setTradeQuantity] = useState(1);
  const [tradeManualValue, setTradeManualValue] = useState("");
  const [priceFilterTimestamp, setPriceFilterTimestamp] = useState(() => Date.now());
  const [message, setMessage] = useState("Ownership supports collector value tracking. Missing markers never mean purchasing.");
  const collectionValue = useMemo(
    () => summarizeCollectionValue(ownedCards, settings.collectorCurrency),
    [ownedCards, settings.collectorCurrency],
  );
  const tradeSummary = useMemo(
    () => compareTradeValues(tradeItems, settings.collectorCurrency),
    [settings.collectorCurrency, tradeItems],
  );

  const visibleCards = useMemo(() => {
    if (view === "favorites") {
      return ownedCards.filter((card) => card.favorite);
    }

    if (view === "recent") {
      return ownedCards.filter((card) => Boolean(card.lastScannedAt));
    }

    if (view === "unused") {
      return ownedCards.filter((card) => Object.keys(card.deckUsage).length === 0);
    }

    if (view === "printings") {
      return ownedCards.filter((card) => card.printings.length > 0);
    }

    if (view === "extras") {
      return ownedCards.filter((card) => card.typeLine?.toLowerCase().includes("token"));
    }

    if (view === "collector") {
      return [...ownedCards].sort((left, right) => {
        const leftValue = selectReferencePrice(left.prices, "nonfoil", left.manualPriceOverride).value ?? Number.NEGATIVE_INFINITY;
        const rightValue = selectReferencePrice(right.prices, "nonfoil", right.manualPriceOverride).value ?? Number.NEGATIVE_INFINITY;
        return rightValue - leftValue || left.name.localeCompare(right.name);
      });
    }

    if (view === "trade_binder") {
      return ownedCards.filter((card) => card.tradeStatus === "for_trade" || card.tradeStatus === "possibly_for_trade");
    }

    if (view === "valuable_duplicates") {
      return ownedCards.filter((card) => {
        const value = selectReferencePrice(card.prices, "nonfoil", card.manualPriceOverride).value;
        return card.quantityOwned > 1 && isHighValueCard(value, settings.collectorHighValueThreshold);
      });
    }

    if (view === "stale_prices") {
      return ownedCards.filter((card) => {
        const fetchedAt = Date.parse(card.prices?.fetchedAt ?? "");
        return Number.isFinite(fetchedAt) && priceFilterTimestamp - fetchedAt > settings.collectorPriceFreshnessDays * 24 * 60 * 60 * 1000;
      });
    }

    if (view === "missing_prices") {
      return ownedCards.filter((card) => selectReferencePrice(card.prices, "nonfoil", card.manualPriceOverride).value === null);
    }

    return ownedCards;
  }, [ownedCards, priceFilterTimestamp, settings.collectorHighValueThreshold, settings.collectorPriceFreshnessDays, view]);

  async function handleAddOwned(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      setMessage("Enter a card name before saving an owned card.");
      return;
    }

    const manualValue = Number(manualPrice);
    const manualPriceOverride =
      Number.isFinite(manualValue) && manualValue >= 0 && manualPrice.trim()
        ? {
            value: manualValue,
            currency: settings.collectorCurrency,
            reason: manualPriceNote.trim() || "Local collector reference value",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        : undefined;

    await upsertOwnedCard({
      name,
      quantityOwned: quantity,
      manaCost,
      typeLine,
      colorIdentity: colors,
      tags: parseTagInput(tags),
      notes,
      favorite,
      storageLocation,
      storage: { name: storageLocation },
      duplicateFlag,
      finish,
      language,
      condition,
      tradeStatus,
      manualPriceOverride,
      printing: {
        name,
        setCode,
        setName: setCode ? `Set ${setCode.toUpperCase()}` : "Local Entry",
        collectorNumber,
        foil: finish === "foil",
        finish,
        language,
        condition,
        tradeStatus,
        manualPriceOverride,
        storageLocation,
        storage: { name: storageLocation },
        quantityOwned: quantity,
      },
    });
    setMessage(`${name.trim()} saved locally in Owned Cards.`);
    setName("");
    setQuantity(1);
    setTags("");
    setNotes("");
    setStorageLocation("");
    setSetCode("");
    setCollectorNumber("");
    setFinish("nonfoil");
    setLanguage("en");
    setCondition("Unknown");
    setTradeStatus("not_for_trade");
    setManualPrice("");
    setManualPriceNote("");
  }

  function addManualTradeItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(tradeManualValue);
    if (!tradeName.trim() || !Number.isFinite(value) || value < 0) {
      setMessage("Enter a trade card name and non-negative manual reference value.");
      return;
    }
    const now = new Date().toISOString();
    setTradeItems((current) => [
      ...current,
      {
        id: `trade-${Date.now()}-${current.length}`,
        side: tradeSide,
        name: tradeName.trim(),
        quantity: Math.max(1, Math.trunc(tradeQuantity)),
        finish: "nonfoil",
        manualPriceOverride: {
          value,
          currency: settings.collectorCurrency,
          reason: "Manual trade comparison value",
          createdAt: now,
          updatedAt: now,
        },
      },
    ]);
    setTradeName("");
    setTradeQuantity(1);
    setTradeManualValue("");
    setMessage("Trade comparison updated with a visibly labeled manual value.");
  }

  async function refreshOwnedCardPrice(
    card: OwnedCard,
    options: { quiet?: boolean } = {},
  ): Promise<"updated" | "unavailable" | "failed"> {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      if (!options.quiet) {
        setMessage(`${card.name} price refresh is unavailable offline. Cached prices remain visible.`);
      }
      return "failed";
    }

    try {
      const resolved = await resolveScryfallCardName(card.name);
      const refreshed = resolved.card;
      const prices = refreshed.prices;
      const selectedFinish =
        card.printings[0]?.finish ??
        (refreshed.foil && !refreshed.nonfoil ? "foil" : "nonfoil");
      const nextPrintings = card.printings.map((printing, index) =>
        index === 0
          ? {
              ...printing,
              oracleId: printing.oracleId || refreshed.oracleId,
              scryfallId: printing.scryfallId || refreshed.id,
              setCode: printing.setCode || refreshed.setCode,
              setName: printing.setName || refreshed.setName,
              collectorNumber: printing.collectorNumber || refreshed.collectorNumber,
              language: printing.language || refreshed.lang,
              finish: printing.finish ?? selectedFinish,
              foil: printing.foil || (printing.finish ?? selectedFinish) === "foil",
              imageUri: printing.imageUri || refreshed.imageUris?.normal || refreshed.imageUris?.small || "",
              prices,
              priceUpdatedAt: prices?.fetchedAt,
              rarity: printing.rarity ?? refreshed.rarity,
              releasedAt: printing.releasedAt ?? refreshed.releasedAt,
            }
          : printing,
      );

      await updateOwnedCard(card.id, {
        oracleId: card.oracleId || refreshed.oracleId,
        scryfallId: refreshed.id,
        manaCost: card.manaCost ?? refreshed.manaCost,
        manaValue: card.manaValue ?? refreshed.manaValue,
        typeLine: card.typeLine ?? refreshed.typeLine,
        oracleText: card.oracleText ?? refreshed.oracleText,
        colorIdentity: card.colorIdentity?.length ? card.colorIdentity : refreshed.colorIdentity,
        imageUri: card.imageUri ?? refreshed.imageUris?.normal ?? refreshed.imageUris?.small,
        legalities: card.legalities ?? refreshed.legalities,
        prices,
        priceUpdatedAt: prices?.fetchedAt,
        printings: nextPrintings,
        rarity: card.rarity ?? refreshed.rarity,
        releasedAt: card.releasedAt ?? refreshed.releasedAt,
      });

      const selected = selectReferencePrice(prices, selectedFinish, card.manualPriceOverride);
      if (prices && selected.value !== null) {
        await recordPriceHistoryPoint({
          oracleId: refreshed.oracleId,
          scryfallId: refreshed.id,
          printingId: card.printings[0]?.id ?? refreshed.id,
          finish: selectedFinish,
          source: prices.source,
          sourceLabel: prices.sourceLabel,
          currency: selected.currency,
          value: selected.value,
          recordedAt: prices.fetchedAt,
        });
        if (!options.quiet) {
          setMessage(`${card.name} reference price refreshed from ${prices.sourceLabel}.`);
        }
        return "updated";
      }

      if (!options.quiet) {
        setMessage(`${card.name} has no supported price from Scryfall.`);
      }
      return "unavailable";
    } catch {
      if (!options.quiet) {
        setMessage(`${card.name} price refresh failed. Cached collector data remains visible.`);
      }
      return "failed";
    }
  }

  async function refreshVisiblePriceReferences() {
    const cardsToRefresh = visibleCards.slice(0, 75);
    if (cardsToRefresh.length === 0) {
      setMessage("No visible owned cards to refresh.");
      return;
    }

    let updated = 0;
    let unavailable = 0;
    let failed = 0;
    for (const card of cardsToRefresh) {
      const result = await refreshOwnedCardPrice(card, { quiet: true });
      if (result === "updated") updated += 1;
      if (result === "unavailable") unavailable += 1;
      if (result === "failed") failed += 1;
    }
    setPriceFilterTimestamp(Date.now());
    setMessage(
      `Price refresh complete: ${updated} updated, ${unavailable} unavailable, ${failed} failed. Source attribution stays with each price.`,
    );
  }

  return (
    <section className="screen feature-screen owned-screen">
      <PageHeader title="Owned Cards">
        <StatusPill tone="cyan">{`${ownedCards.length} local records`}</StatusPill>
      </PageHeader>

      <HolographicPanel className="feature-grid feature-grid--owned">
        <form className="feature-form" onSubmit={handleAddOwned}>
          <h2>Add Owned Card</h2>
          <label>
            Card name
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            Quantity owned
            <input
              min={0}
              type="number"
              value={quantity}
              onChange={(event) => setQuantity(Number(event.target.value))}
            />
          </label>
          <label>
            Mana cost
            <input value={manaCost} onChange={(event) => setManaCost(event.target.value)} placeholder="{2}{G}" />
          </label>
          <label>
            Type line
            <input value={typeLine} onChange={(event) => setTypeLine(event.target.value)} />
          </label>
          <fieldset className="color-checks">
            <legend>Color identity</legend>
            {(["W", "U", "B", "R", "G"] as CommanderColor[]).map((color) => (
              <label key={color}>
                <input
                  checked={colors.includes(color)}
                  type="checkbox"
                  onChange={(event) =>
                    setColors(parseColorIdentityInput(event.target.checked ? [...colors, color] : colors.filter((item) => item !== color)))
                  }
                />
                {color}
              </label>
            ))}
          </fieldset>
          <label>
            Tags
            <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="ramp, favorite binder" />
          </label>
          <label>
            Storage location
            <input
              value={storageLocation}
              onChange={(event) => setStorageLocation(event.target.value)}
              placeholder="Binder 2, blue box..."
            />
          </label>
          <label>
            Duplicate/share flag
            <select
              value={duplicateFlag}
              onChange={(event) => setDuplicateFlag(event.target.value as OwnedDuplicateFlag)}
            >
              {duplicateFlags.map((flag) => (
                <option key={flag.id} value={flag.id}>
                  {flag.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Set code
            <input value={setCode} onChange={(event) => setSetCode(event.target.value)} />
          </label>
          <label>
            Collector number
            <input value={collectorNumber} onChange={(event) => setCollectorNumber(event.target.value)} />
          </label>
          <label>
            Finish
            <select value={finish} onChange={(event) => setFinish(event.target.value as CollectorFinish)}>
              {finishOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Language
            <input value={language} onChange={(event) => setLanguage(event.target.value)} placeholder="en, ja, de..." />
          </label>
          <label>
            Condition
            <select value={condition} onChange={(event) => setCondition(event.target.value)}>
              {conditionOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            Trade status
            <select value={tradeStatus} onChange={(event) => setTradeStatus(event.target.value as CollectorTradeStatus)}>
              {tradeStatuses.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Manual reference value
            <input value={manualPrice} onChange={(event) => setManualPrice(event.target.value)} inputMode="decimal" placeholder="12.50" />
          </label>
          <label>
            Manual value note
            <input value={manualPriceNote} onChange={(event) => setManualPriceNote(event.target.value)} placeholder="Local shop, negotiated trade..." />
          </label>
          <label>
            Notes
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
          <div className="feature-inline">
            <label>
              <input checked={favorite} type="checkbox" onChange={(event) => setFavorite(event.target.checked)} />
              Favorite
            </label>
            <label>
              <input checked={finish === "foil"} type="checkbox" onChange={(event) => setFinish(event.target.checked ? "foil" : "nonfoil")} />
              Foil printing
            </label>
          </div>
          <button type="submit">Save Owned Card</button>
        </form>

        <div className="owned-registry-panel">
          <div className="feature-toolbar">
            <label>
              View / filter
              <select
                value={view}
                onChange={(event) => {
                  setView(event.target.value as OwnedView);
                  setPriceFilterTimestamp(Date.now());
                }}
              >
                {ownedViews.map((ownedView) => (
                  <option key={ownedView.id} value={ownedView.id}>
                    {ownedView.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="feature-status" role="status">
              <LibraryBig aria-hidden="true" />
              <span>{loading ? "Loading owned registry..." : message}</span>
            </div>
          </div>

          <div className="collector-overview" data-testid="collector-value-summary">
            <div>
              <DollarSign aria-hidden="true" />
              <span>Estimated Collection Value</span>
              <strong>{formatCurrency(collectionValue.totalEstimatedValue, collectionValue.currency)}</strong>
            </div>
            <div>
              <span>Priced cards</span>
              <strong>{collectionValue.pricedCardCount}</strong>
            </div>
            <div>
              <span>Cards without current pricing</span>
              <strong>{collectionValue.missingPriceCount}</strong>
            </div>
            <div>
              <span>Last price refresh</span>
              <strong>{collectionValue.lastPriceRefresh ? new Date(collectionValue.lastPriceRefresh).toLocaleString() : "No prices cached"}</strong>
            </div>
            <button type="button" onClick={() => void refreshVisiblePriceReferences()}>
              <RefreshCw aria-hidden="true" /> Refresh Visible Prices
            </button>
          </div>

          <div className="trade-comparison-tool" data-testid="trade-comparison-tool">
            <div className="trade-comparison-tool__summary">
              <Repeat2 aria-hidden="true" />
              <strong>{tradeSummary.summary}</strong>
              <span>
                My side {formatCurrency(tradeSummary.mySideValue, tradeSummary.currency)} · Their side{" "}
                {formatCurrency(tradeSummary.theirSideValue, tradeSummary.currency)} · Difference{" "}
                {formatCurrency(Math.abs(tradeSummary.differenceTowardMe), tradeSummary.currency)}
              </span>
              <small>
                Missing prices: my side {tradeSummary.myMissingPriceCount}, their side{" "}
                {tradeSummary.theirMissingPriceCount}. Manual values do not overwrite market references.
              </small>
            </div>
            <form className="trade-comparison-tool__form" onSubmit={addManualTradeItem}>
              <label>
                Side
                <select value={tradeSide} onChange={(event) => setTradeSide(event.target.value as "mine" | "theirs")}>
                  <option value="mine">My Side</option>
                  <option value="theirs">Their Side</option>
                </select>
              </label>
              <label>
                Card
                <input value={tradeName} onChange={(event) => setTradeName(event.target.value)} />
              </label>
              <label>
                Quantity
                <input min={1} type="number" value={tradeQuantity} onChange={(event) => setTradeQuantity(Number(event.target.value))} />
              </label>
              <label>
                Manual value
                <input inputMode="decimal" value={tradeManualValue} onChange={(event) => setTradeManualValue(event.target.value)} />
              </label>
              <button type="submit">Add Trade Item</button>
            </form>
            {tradeItems.length > 0 ? (
              <ul className="trade-comparison-tool__items">
                {tradeItems.map((item) => (
                  <li key={item.id}>
                    <span>{item.side === "mine" ? "My side" : "Their side"} · {item.quantity} {item.name}</span>
                    <strong>{formatPriceReference(item.prices, item.finish, item.manualPriceOverride)}</strong>
                    <button
                      type="button"
                      onClick={() => setTradeItems((current) => current.filter((candidate) => candidate.id !== item.id))}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="owned-card-list" aria-live="polite">
            {visibleCards.length === 0 ? (
              <div className="feature-empty">
                <ShoppingCart aria-hidden="true" />
                <strong>No owned cards in this view</strong>
                <span>Use the local form or scanner batch review to add cards.</span>
              </div>
            ) : (
              visibleCards.map((card) => (
                <article className="owned-card-row" key={card.id}>
                  <div>
                    <h2>
                      {card.name}
                      {card.favorite ? <Heart aria-label="Favorite" /> : null}
                    </h2>
                    <p>{card.typeLine ?? "Type not set"} · {card.colorIdentity?.join(" ") || "Colorless"}</p>
                    <small>
                      {card.tags.join(", ") || "No tags"} · {card.storageLocation || "No storage location"}
                    </small>
                    <small>Duplicate/share flag: {card.duplicateFlag}</small>
                    <small>
                      Collector: {formatPriceReference(card.prices, card.printings[0]?.finish ?? "nonfoil", card.manualPriceOverride)} ·{" "}
                      {formatPriceFreshness(card.prices)}
                    </small>
                    <small>
                      Trade: {(card.tradeStatus ?? "not_for_trade").replace(/_/g, " ")} · Condition:{" "}
                      {card.printings[0]?.condition ?? "Unknown"} · Finish:{" "}
                      {(card.printings[0]?.finish ?? "nonfoil").replace(/_/g, " ")}
                    </small>
                    {isHighValueCard(selectReferencePrice(card.prices, card.printings[0]?.finish ?? "nonfoil", card.manualPriceOverride).value, settings.collectorHighValueThreshold) ? (
                      <span className="badge">High-value card</span>
                    ) : null}
                  </div>
                  <div className="owned-card-row__quantity" aria-label={`${card.quantityOwned} owned`}>
                    <button
                      type="button"
                      aria-label={`Decrease ${card.name}`}
                      onClick={() =>
                        updateOwnedCard(card.id, {
                          quantityOwned: Math.max(0, card.quantityOwned - 1),
                        })
                      }
                    >
                      <Minus aria-hidden="true" />
                    </button>
                    <strong>{card.quantityOwned}</strong>
                    <button
                      type="button"
                      aria-label={`Increase ${card.name}`}
                      onClick={() =>
                        updateOwnedCard(card.id, {
                          quantityOwned: card.quantityOwned + 1,
                          duplicateFlag: card.quantityOwned + 1 > 1 ? "multiple_owned" : card.duplicateFlag,
                        })
                      }
                    >
                      <Plus aria-hidden="true" />
                    </button>
                  </div>
                  <div className="result-actions">
                    <button
                      type="button"
                      onClick={() => updateOwnedCard(card.id, { favorite: !card.favorite })}
                    >
                      {card.favorite ? "Unfavorite" : "Favorite"}
                    </button>
                    <button type="button" onClick={() => void refreshOwnedCardPrice(card)}>
                      <RefreshCw aria-hidden="true" /> Refresh Price
                    </button>
                    <button type="button" onClick={() => deleteOwnedCard(card.id)}>
                      <Trash2 aria-hidden="true" /> Remove
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </HolographicPanel>
    </section>
  );
}
