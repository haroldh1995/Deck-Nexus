import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  BookOpen,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Filter,
  ImageIcon,
  Library,
  PlusCircle,
  RotateCcw,
  Search,
  ShoppingCart,
  Square,
  Wifi,
  WifiOff,
} from "lucide-react";
import { HolographicPanel } from "../../components/HolographicPanel";
import { PageHeader } from "../../components/PageHeader";
import { StatusPill } from "../../components/StatusPill";
import { db } from "../../db/database";
import { useDecks, useOwnedCards } from "../../db/hooks";
import { updateScanRecord } from "../../db/repositories";
import type { Deck, DeckCard, DeckstateScryfallCard, OwnedCard } from "../../types/domain";
import { isWithinCommanderColorIdentity } from "../../utils/colorIdentity";
import type { BuilderSectionId } from "../decks/builderTypes";
import { classifyCardSection } from "../decks/cardClassification";
import { type SearchScope, type SearchView } from "./cardSearch";
import { SearchAddToOverlay } from "./SearchAddToOverlay";
import {
  applySearchUndoTransaction,
  getPrimarySearchAction,
  type AddToCardsResult,
  type SearchActionContext,
  type SearchDestinationType,
} from "./searchDestinations";
import {
  autocompleteScryfallCards,
  getCachedAutocompleteSuggestions,
  getCachedScryfallSearch,
  getNamedScryfallCard,
  isAdvancedScryfallQuery,
  pickCardImage,
  resolveScryfallCardName,
  scryfallCardToManualInput,
  searchScryfallCards,
  shouldAutocomplete,
  type ScryfallSearchOptions,
  type ScryfallSearchResultPage,
} from "../../services/scryfall";

const searchScopes: { id: SearchScope; label: string }[] = [
  { id: "all", label: "All Cards" },
  { id: "owned", label: "Owned Cards" },
  { id: "current_deck", label: "Current Deck" },
  { id: "maybeboard", label: "Maybeboard" },
  { id: "cuts", label: "Cuts" },
  { id: "commander_candidates", label: "Commander Candidates" },
  { id: "cached_only", label: "Cached Cards Only" },
];

type SearchContext = SearchActionContext;

interface DecoratedCardResult {
  card: DeckstateScryfallCard;
  badges: string[];
  ownedQuantity: number;
  inDeck: boolean;
  duplicate: boolean;
  legalInCommanderIdentity: boolean;
  recommendedSection: BuilderSectionId;
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timeout);
  }, [delayMs, value]);

  return debounced;
}

function typeFilterFromSection(section: string | null): string {
  if (section === "creatures") return "Creature";
  if (section === "instants") return "Instant";
  if (section === "sorceries") return "Sorcery";
  if (section === "artifacts") return "Artifact";
  if (section === "enchantments") return "Enchantment";
  if (section === "lands") return "Land";
  if (section === "otherPermanents") return "Planeswalker";
  if (section === "commander") return "Legendary Creature";
  return "";
}

function sectionFromParam(section: string | null): BuilderSectionId | undefined {
  const sections: BuilderSectionId[] = [
    "commander",
    "creatures",
    "instants",
    "sorceries",
    "artifacts",
    "enchantments",
    "otherPermanents",
    "lands",
  ];
  return sections.find((candidate) => candidate === section);
}

function getDeckCards(deck?: Deck): DeckCard[] {
  return deck ? [...deck.cards, ...deck.maybeboard, ...deck.cuts] : [];
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function getOwnedQuantity(card: DeckstateScryfallCard, ownedCards: readonly OwnedCard[]): number {
  return ownedCards
    .filter(
      (owned) =>
        owned.oracleId === card.oracleId ||
        owned.scryfallId === card.id ||
        normalizeName(owned.name) === normalizeName(card.name),
    )
    .reduce((total, owned) => total + owned.quantityOwned, 0);
}

function isBasicLand(typeLine: string): boolean {
  return typeLine.toLowerCase().includes("basic land");
}

function decorateResults(
  cards: readonly DeckstateScryfallCard[],
  context: { deck?: Deck; ownedCards: readonly OwnedCard[]; manualSearch?: boolean },
): DecoratedCardResult[] {
  const deckNames = new Set(getDeckCards(context.deck).map((card) => normalizeName(card.name)));

  return cards.map((card) => {
    const ownedQuantity = getOwnedQuantity(card, context.ownedCards);
    const inDeck = deckNames.has(normalizeName(card.name));
    const legalInCommanderIdentity =
      !context.deck ||
      context.deck.colorIdentity.length === 0 ||
      isWithinCommanderColorIdentity(context.deck.colorIdentity, card.colorIdentity);
    const commanderLegal = card.legalities.commander === "legal";
    const duplicate = inDeck && !isBasicLand(card.typeLine);
    const badges = [
      ownedQuantity > 0 ? "Owned" : "Missing",
      inDeck ? "In Deck" : "",
      legalInCommanderIdentity ? "Legal" : "Outside Identity",
      commanderLegal ? "Commander Legal" : "Not Commander Legal",
      duplicate ? "Duplicate" : "",
      context.manualSearch ? "Manual Search Result" : "",
    ].filter(Boolean);

    return {
      card,
      badges,
      ownedQuantity,
      inDeck,
      duplicate,
      legalInCommanderIdentity,
      recommendedSection: classifyCardSection(card.typeLine),
    };
  });
}

function applyLocalScope(
  results: readonly DecoratedCardResult[],
  scope: SearchScope,
  deck?: Deck,
): DecoratedCardResult[] {
  if (scope === "owned") {
    return results.filter((result) => result.ownedQuantity > 0);
  }

  if (scope === "current_deck") {
    return results.filter((result) => result.inDeck);
  }

  if (scope === "maybeboard") {
    const names = new Set(deck?.maybeboard.map((card) => normalizeName(card.name)) ?? []);
    return results.filter((result) => names.has(normalizeName(result.card.name)));
  }

  if (scope === "cuts") {
    const names = new Set(deck?.cuts.map((card) => normalizeName(card.name)) ?? []);
    return results.filter((result) => names.has(normalizeName(result.card.name)));
  }

  return [...results];
}

function readHistory(): string[] {
  if (typeof localStorage === "undefined") {
    return [];
  }

  try {
    return JSON.parse(localStorage.getItem("deckstate:search-history") ?? "[]") as string[];
  } catch {
    return [];
  }
}

function writeHistory(query: string) {
  if (typeof localStorage === "undefined" || !query.trim()) {
    return;
  }

  const next = [query.trim(), ...readHistory().filter((item) => item !== query.trim())].slice(0, 8);
  localStorage.setItem("deckstate:search-history", JSON.stringify(next));
}

export function CardSearchScreen() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { decks } = useDecks();
  const { ownedCards } = useOwnedCards();
  const initialDeckId = searchParams.get("deckId") ?? "";
  const requestedSection = sectionFromParam(searchParams.get("section"));
  const context = (searchParams.get("context") as SearchContext | null) ?? (initialDeckId ? "deck" : "global");
  const batchId = searchParams.get("batchId") ?? "";
  const scanRecordId = searchParams.get("recordId") ?? "";
  const importResultId = searchParams.get("importResultId") ?? "";
  const importLine = searchParams.get("rawLine") ?? "";
  const [deckId, setDeckId] = useState(initialDeckId);
  const [rawInput, setRawInput] = useState(searchParams.get("q") ?? "");
  const debouncedInput = useDebouncedValue(rawInput, 230);
  const [committedQuery, setCommittedQuery] = useState(searchParams.get("q") ?? "");
  const [exactPhrase, setExactPhrase] = useState("");
  const [typeText, setTypeText] = useState(typeFilterFromSection(searchParams.get("section")));
  const [oracleText, setOracleText] = useState("");
  const [keyword, setKeyword] = useState("");
  const [scope, setScope] = useState<SearchScope>(context === "owned" ? "owned" : "all");
  const [view, setView] = useState<SearchView>("compact");
  const [filterOpen, setFilterOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [highlightedSuggestion, setHighlightedSuggestion] = useState(-1);
  const [loadingAutocomplete, setLoadingAutocomplete] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [status, setStatus] = useState("Live Scryfall search is ready.");
  const [page, setPage] = useState<ScryfallSearchResultPage | null>(null);
  const [selectedCard, setSelectedCard] = useState<DeckstateScryfallCard | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedCardsById, setSelectedCardsById] = useState<Record<string, DeckstateScryfallCard>>({});
  const [addToCards, setAddToCards] = useState<DeckstateScryfallCard[]>([]);
  const [addToDestination, setAddToDestination] = useState<SearchDestinationType | undefined>();
  const [addToOpen, setAddToOpen] = useState(false);
  const [lastAction, setLastAction] = useState<AddToCardsResult | null>(null);
  const [fuzzyNotice, setFuzzyNotice] = useState("");
  const [history, setHistory] = useState<string[]>(() => readHistory());
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const addToTriggerRef = useRef<HTMLButtonElement | null>(null);
  const overlayScrollRef = useRef(0);
  const searchAbortRef = useRef<AbortController | null>(null);
  const autocompleteAbortRef = useRef<AbortController | null>(null);
  const searchGeneration = useRef(0);
  const autocompleteGeneration = useRef(0);
  const deck = decks.find((candidate) => candidate.id === deckId);
  const advanced = isAdvancedScryfallQuery(rawInput);

  const searchOptions = useMemo<ScryfallSearchOptions>(
    () => ({
      query: committedQuery || rawInput,
      exactPhrase,
      typeText,
      oracleText,
      keyword,
      commanderIdentity: deck?.colorIdentity,
      commanderLegal: scope === "commander_candidates" || context === "commander",
      commanderCandidates: scope === "commander_candidates" || context === "commander",
      cachedOnly: scope === "cached_only",
      unique: "cards",
      sort: "name",
      direction: "auto",
    }),
    [committedQuery, context, deck?.colorIdentity, exactPhrase, keyword, oracleText, rawInput, scope, typeText],
  );

  const results = useMemo(() => {
    const next = decorateResults(page?.cards ?? [], { deck, ownedCards, manualSearch: true });
    return applyLocalScope(next, scope, deck);
  }, [deck, ownedCards, page, scope]);
  const selectedCards = useMemo(() => Object.values(selectedCardsById), [selectedCardsById]);
  const primaryAction = useMemo(
    () => getPrimarySearchAction({ context, hasCurrentDeck: Boolean(deck) }),
    [context, deck],
  );

  const visibleSuggestions = useMemo(() => {
    if (!rawInput.trim()) {
      return history;
    }

    if (!shouldAutocomplete(rawInput) || advanced) {
      return [];
    }

    return suggestions;
  }, [advanced, history, rawInput, suggestions]);

  useEffect(() => {
    const query = debouncedInput.trim();
    const generation = autocompleteGeneration.current + 1;
    autocompleteGeneration.current = generation;
    autocompleteAbortRef.current?.abort();

    if (!suggestionsOpen || !shouldAutocomplete(query) || isAdvancedScryfallQuery(query)) {
      return;
    }

    const controller = new AbortController();
    autocompleteAbortRef.current = controller;

    void (async () => {
      const cached = await getCachedAutocompleteSuggestions(query);
      if (cached && generation === autocompleteGeneration.current) {
        setSuggestions(cached.suggestions.slice(0, 10));
      }

      const live = await autocompleteScryfallCards({ query, signal: controller.signal });
      if (generation === autocompleteGeneration.current && !controller.signal.aborted) {
        setSuggestions(live.suggestions.slice(0, 10));
        setStatus(live.source === "live" ? "Live Scryfall predictions loaded." : "Offline card-name predictions.");
      }
    })()
      .catch(() => {
        if (generation === autocompleteGeneration.current) {
          setStatus("Autocomplete is using cached card data.");
        }
      })
      .finally(() => {
        if (generation === autocompleteGeneration.current) {
          setLoadingAutocomplete(false);
        }
      });

    return () => controller.abort();
  }, [debouncedInput, history, suggestionsOpen]);

  async function commitSearch(query = rawInput, options: { exactLookup?: boolean; pageUrl?: string; pageNumber?: number } = {}) {
    const trimmed = query.trim();
    if (!trimmed && !typeText && !oracleText && !keyword && !exactPhrase) {
      setStatus("Enter a card name, Scryfall query, type, keyword, or rules text.");
      return;
    }

    const generation = searchGeneration.current + 1;
    searchGeneration.current = generation;
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    setCommittedQuery(trimmed);
    setRawInput(trimmed);
    setSuggestionsOpen(false);
    setHighlightedSuggestion(-1);
    setLoadingSearch(true);
    setFuzzyNotice("");
    writeHistory(trimmed);
    setHistory(readHistory());

    try {
      if (options.exactLookup) {
        const card = await getNamedScryfallCard({ exact: trimmed, priority: "high" }, controller.signal);
        const exactPage: ScryfallSearchResultPage = {
          cards: [card],
          query: trimmed,
          page: 1,
          totalCards: 1,
          hasMore: false,
          warnings: [],
          source: "live",
        };
        if (generation === searchGeneration.current) {
          setPage(exactPage);
          setStatus("Exact Scryfall card resolved.");
        }
        return;
      }

      const requestedOptions: ScryfallSearchOptions = {
        ...searchOptions,
        query: trimmed || searchOptions.query,
        pageUrl: options.pageUrl,
        page: options.pageNumber ?? 1,
        cachedOnly: scope === "cached_only",
      };
      const cached = await getCachedScryfallSearch(requestedOptions);
      if (cached && generation === searchGeneration.current) {
        setPage(cached);
        setStatus(cached.source === "cache" ? "Cached Scryfall results shown while live results refresh." : "Offline card data.");
      }

      const live = await searchScryfallCards(requestedOptions, controller.signal);
      if (generation === searchGeneration.current && !controller.signal.aborted) {
        setPage(live);
        setStatus(
          live.source === "live"
            ? "Live Scryfall results loaded."
            : "Offline card data shown from cache.",
        );
      }
    } catch (error) {
      if (generation === searchGeneration.current) {
        setStatus(error instanceof Error ? error.message : "Search failed.");
      }
    } finally {
      if (generation === searchGeneration.current) {
        setLoadingSearch(false);
        inputRef.current?.focus({ preventScroll: true });
      }
    }
  }

  async function fuzzyLookup() {
    const typed = rawInput.trim();
    if (!typed) {
      return;
    }

    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    setLoadingSearch(true);
    try {
      const resolved = await resolveScryfallCardName(typed, controller.signal);
      setPage({
        cards: [resolved.card],
        query: typed,
        page: 1,
        totalCards: 1,
        hasMore: false,
        warnings: [],
        source: "live",
      });
      setFuzzyNotice(resolved.fuzzy ? `Showing the closest match for '${typed}'.` : "");
      setStatus(resolved.fuzzy ? "Fuzzy Scryfall match loaded." : "Exact Scryfall card resolved.");
    } finally {
      setLoadingSearch(false);
      inputRef.current?.focus({ preventScroll: true });
    }
  }

  async function selectSuggestion(suggestion: string) {
    setRawInput(suggestion);
    setSuggestionsOpen(false);
    await commitSearch(suggestion, { exactLookup: true });
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (suggestionsOpen && visibleSuggestions.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlightedSuggestion((current) => Math.min(current + 1, visibleSuggestions.length - 1));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlightedSuggestion((current) => Math.max(current - 1, -1));
        return;
      }
      if (event.key === "Enter" && highlightedSuggestion >= 0) {
        event.preventDefault();
        void selectSuggestion(visibleSuggestions[highlightedSuggestion]);
        return;
      }
    }

    if (event.key === "Escape") {
      setSuggestionsOpen(false);
      setHighlightedSuggestion(-1);
    }
  }

  function toggleSelected(card: DeckstateScryfallCard) {
    setSelectionMode(true);
    setSelectedCardsById((current) => {
      const next = { ...current };
      if (next[card.id]) {
        delete next[card.id];
      } else {
        next[card.id] = card;
      }
      return next;
    });
  }

  function selectAllVisible() {
    setSelectionMode(true);
    setSelectedCardsById((current) => {
      const next = { ...current };
      for (const result of results) {
        next[result.card.id] = result.card;
      }
      return next;
    });
  }

  function clearSelection() {
    setSelectedCardsById({});
    setSelectionMode(false);
  }

  function openAddTo(
    cards: DeckstateScryfallCard[],
    destination?: SearchDestinationType,
    trigger?: HTMLButtonElement | null,
  ) {
    if (cards.length === 0) {
      setStatus("Select at least one card before opening Add To.");
      return;
    }

    overlayScrollRef.current = resultsRef.current?.scrollTop ?? 0;
    addToTriggerRef.current = trigger ?? null;
    setAddToCards(cards);
    setAddToDestination(destination);
    setAddToOpen(true);
  }

  function closeAddTo() {
    setAddToOpen(false);
    window.setTimeout(() => {
      if (resultsRef.current) {
        resultsRef.current.scrollTop = overlayScrollRef.current;
      }
      addToTriggerRef.current?.focus({ preventScroll: true });
      inputRef.current?.focus({ preventScroll: true });
    }, 0);
  }

  function completeAddTo(result: AddToCardsResult) {
    setLastAction(result);
    setStatus(result.message);
    setAddToOpen(false);
    window.setTimeout(() => {
      if (resultsRef.current) {
        resultsRef.current.scrollTop = overlayScrollRef.current;
      }
      inputRef.current?.focus({ preventScroll: true });
    }, 0);
  }

  async function undoLastAction() {
    if (!lastAction?.undo) {
      return;
    }

    const message = await applySearchUndoTransaction(lastAction.undo);
    setLastAction(null);
    setStatus(message);
  }

  function handlePrimaryAction(
    result: DecoratedCardResult,
    trigger: HTMLButtonElement | null,
  ) {
    if (primaryAction.kind === "scanner") {
      void selectForScannerCorrection(result.card);
      return;
    }
    if (primaryAction.kind === "import") {
      void selectForImportCorrection(result.card);
      return;
    }
    if (primaryAction.kind === "destination" && primaryAction.destination) {
      openAddTo([result.card], primaryAction.destination, trigger);
      return;
    }
    setSelectedCard(result.card);
  }

  async function selectForScannerCorrection(card: DeckstateScryfallCard) {
    if (!scanRecordId) {
      return;
    }

    await updateScanRecord(scanRecordId, {
      scryfallId: card.id,
      oracleId: card.oracleId,
      name: card.name,
      rawText: card.name,
      typeLine: card.typeLine,
      colorIdentity: card.colorIdentity,
      status: "confirmed",
      confidence: 1,
      possibleMatches: [card.name],
    });
    setStatus(`${card.name} selected for scanner correction.`);
    if (batchId) {
      navigate(`/scan?batchId=${batchId}&review=1`);
    }
  }

  async function selectForImportCorrection(card: DeckstateScryfallCard) {
    if (!importResultId) {
      setStatus(`${card.name} selected for import correction.`);
      return;
    }

    const importResult = await db.importResults.get(importResultId);
    if (importResult) {
      const input = scryfallCardToManualInput({ card, ownedQuantity: 0, destination: "main" });
      const resolvedCard: DeckCard = {
        ...scryfallCardToManualInput({ card, ownedQuantity: 0, destination: "main" }),
        id: `import-${card.id}-${Date.now()}`,
        deckId: importResult.deckId ?? `import-${importResult.id}`,
        scryfallId: input.scryfallId ?? card.id,
        oracleId: input.oracleId ?? card.oracleId,
        quantity: 1,
        section: "main",
        categories: [],
        roleTags: input.roleTags,
        customTags: input.customTags,
        notes: input.notes ?? "",
        protected: false,
        ownedQuantityAtAdd: 0,
        missingQuantity: 1,
        addedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await db.importResults.put({
        ...importResult,
        status: "needs_review",
        resolvedCards: [...importResult.resolvedCards, resolvedCard],
        unresolvedImports: importResult.unresolvedImports.filter((line) => line !== importLine),
      });
    }
    setStatus(`${card.name} selected for import correction.`);
  }

  const sourcePill = page?.source === "offline" ? "Offline card data" : page?.source === "cache" ? "Cached card data" : "Live Scryfall";

  return (
    <section className="screen feature-screen card-search-screen search-viewport">
      <PageHeader title="Card Search">
        <StatusPill tone={page?.source === "offline" ? "amber" : "cyan"}>
          {page?.source === "offline" ? <WifiOff aria-hidden="true" /> : <Wifi aria-hidden="true" />} {sourcePill}
        </StatusPill>
      </PageHeader>

      <HolographicPanel className="search-command-panel">
        <form
          className="search-command-panel__form"
          onSubmit={(event) => {
            event.preventDefault();
            void commitSearch(rawInput);
          }}
        >
          <label className="search-combobox" htmlFor="scryfall-search-input">
            <span>Search Scryfall cards</span>
            <div className="search-input-row">
              <Search aria-hidden="true" />
              <input
                ref={inputRef}
                id="scryfall-search-input"
                aria-label="Search Scryfall cards"
                aria-autocomplete="list"
                aria-controls="scryfall-autocomplete-list"
                aria-expanded={suggestionsOpen}
                aria-activedescendant={
                  highlightedSuggestion >= 0 ? `scryfall-suggestion-${highlightedSuggestion}` : undefined
                }
                autoCapitalize="none"
                autoComplete="off"
                placeholder="Sol Ring, atraxa prae, t:creature legal:commander..."
                role="combobox"
                value={rawInput}
                onBlur={() => {
                  window.setTimeout(() => setSuggestionsOpen(false), 120);
                }}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setRawInput(nextValue);
                  setSuggestionsOpen(true);
                  setLoadingAutocomplete(shouldAutocomplete(nextValue) && !isAdvancedScryfallQuery(nextValue));
                }}
                onFocus={() => {
                  setSuggestionsOpen(true);
                  if (!rawInput.trim()) {
                    setSuggestions(history);
                  }
                }}
                onKeyDown={onSearchKeyDown}
              />
              {rawInput ? (
                <button
                  type="button"
                  className="search-icon-button"
                  aria-label="Clear search"
                  onClick={() => {
                    setRawInput("");
                    setSuggestions(history);
                    inputRef.current?.focus({ preventScroll: true });
                  }}
                >
                  x
                </button>
              ) : null}
            </div>
          </label>

          {suggestionsOpen && (visibleSuggestions.length > 0 || loadingAutocomplete || !rawInput.trim()) ? (
            <div
              id="scryfall-autocomplete-list"
              className="autocomplete-panel"
              role="listbox"
              aria-label={rawInput.trim() ? "Scryfall card-name suggestions" : "Recent searches"}
            >
              <div className="autocomplete-panel__meta" role="status">
                {loadingAutocomplete ? "Loading suggestions..." : rawInput.trim() ? `${visibleSuggestions.length} suggestions` : "Recent searches"}
              </div>
              {visibleSuggestions.map((suggestion, index) => (
                <button
                  id={`scryfall-suggestion-${index}`}
                  key={`${suggestion}-${index}`}
                  type="button"
                  role="option"
                  aria-selected={index === highlightedSuggestion}
                  className={index === highlightedSuggestion ? "is-highlighted" : ""}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => void selectSuggestion(suggestion)}
                >
                  <span>{suggestion}</span>
                </button>
              ))}
              {visibleSuggestions.length === 0 && !loadingAutocomplete ? <p>No suggestions yet.</p> : null}
            </div>
          ) : null}

          <div className="search-command-panel__actions">
            <button type="submit" disabled={loadingSearch}>
              <Search aria-hidden="true" /> Search
            </button>
            <button type="button" onClick={() => void fuzzyLookup()} disabled={loadingSearch || !rawInput.trim()}>
              Did you mean?
            </button>
            <button type="button" onClick={() => setFilterOpen(true)}>
              <Filter aria-hidden="true" /> Filters
            </button>
          </div>
        </form>
      </HolographicPanel>

      <div className="search-status-row" role="status" aria-live="polite">
        <span>{advanced ? "Advanced Scryfall query" : "Predictive name search"}</span>
        <strong>{status}</strong>
        <span>{loadingSearch ? "Refreshing..." : `${results.length} shown`}</span>
      </div>

      <HolographicPanel className="search-selection-toolbar">
        <div>
          <strong>{selectionMode ? `${selectedCards.length} selected` : "Search actions"}</strong>
          <span>Use Add To... to save cards without leaving Search.</span>
        </div>
        <div className="search-selection-toolbar__actions">
          <button
            type="button"
            onClick={() => setSelectionMode((current) => !current)}
            aria-pressed={selectionMode}
          >
            {selectionMode ? <CheckSquare aria-hidden="true" /> : <Square aria-hidden="true" />}
            Selection Mode
          </button>
          <button type="button" onClick={selectAllVisible} disabled={results.length === 0}>
            Select Visible
          </button>
          <button type="button" onClick={clearSelection} disabled={selectedCards.length === 0}>
            Clear
          </button>
          <button
            type="button"
            onClick={(event) => openAddTo(selectedCards, undefined, event.currentTarget)}
            disabled={selectedCards.length === 0}
          >
            <PlusCircle aria-hidden="true" /> Add To...
          </button>
        </div>
      </HolographicPanel>

      {fuzzyNotice ? (
        <HolographicPanel className="search-fuzzy-notice">
          <AlertTriangle aria-hidden="true" />
          <span>{fuzzyNotice}</span>
          <button type="button" onClick={() => void commitSearch(rawInput)}>
            Search Original Text
          </button>
        </HolographicPanel>
      ) : null}

      {lastAction ? (
        <HolographicPanel className="search-action-confirmation" role="status" aria-live="polite">
          <span>{lastAction.message}</span>
          {lastAction.undo ? (
            <button type="button" onClick={() => void undoLastAction()}>
              <RotateCcw aria-hidden="true" /> Undo
            </button>
          ) : null}
          {lastAction.viewRoute ? (
            <button type="button" onClick={() => navigate(lastAction.viewRoute ?? "/")}>
              View Destination
            </button>
          ) : null}
        </HolographicPanel>
      ) : null}

      <div ref={resultsRef} className={`search-results search-results--${view}`} aria-busy={loadingSearch}>
        {loadingSearch && results.length === 0
          ? Array.from({ length: 6 }, (_, index) => <div className="search-result-skeleton" key={index} />)
          : null}
        {results.map((result) => {
          const selected = Boolean(selectedCardsById[result.card.id]);

          return (
          <HolographicPanel
            as="article"
            variant="card"
            className={selected ? "search-result-card is-selected" : "search-result-card"}
            key={result.card.id}
          >
            {selectionMode ? (
              <button
                type="button"
                className="search-select-card"
                aria-pressed={selected}
                aria-label={`${selected ? "Deselect" : "Select"} ${result.card.name}`}
                onClick={() => toggleSelected(result.card)}
              >
                {selected ? <CheckSquare aria-hidden="true" /> : <Square aria-hidden="true" />}
              </button>
            ) : null}
            <div className="result-art" aria-hidden="true">
              {pickCardImage(result.card.imageUris, view === "compact" ? "small" : "normal") ? (
                <img src={pickCardImage(result.card.imageUris, view === "compact" ? "small" : "normal")} alt="" loading="lazy" />
              ) : (
                <ImageIcon />
              )}
            </div>
            <div className="result-copy">
              <h2>{result.card.name}</h2>
              <p>{result.card.manaCost || "No mana cost"} - {result.card.typeLine}</p>
              <small>{result.card.oracleText || "Rules text unavailable."}</small>
              <div className="badge-row" aria-label={`${result.card.name} search badges`}>
                {result.badges.map((badge) => (
                  <span
                    key={badge}
                    className={badge.includes("Outside") || badge.includes("Not Commander") ? "badge badge--warn" : "badge"}
                  >
                    {badge === "Missing" ? <ShoppingCart aria-hidden="true" /> : null}
                    {badge}
                  </span>
                ))}
                <span className="badge">Set {result.card.setCode.toUpperCase()} #{result.card.collectorNumber}</span>
              </div>
            </div>
            <div className="result-actions">
              <button
                type="button"
                onClick={(event) => handlePrimaryAction(result, event.currentTarget)}
              >
                {primaryAction.label}
              </button>
              <button
                type="button"
                onClick={(event) => openAddTo([result.card], undefined, event.currentTarget)}
              >
                <PlusCircle aria-hidden="true" /> Add To...
              </button>
              {deck ? (
                <button
                  type="button"
                  onClick={(event) => openAddTo([result.card], "maybeboard", event.currentTarget)}
                >
                  Maybeboard
                </button>
              ) : null}
              <button type="button" onClick={() => setSelectedCard(result.card)}>
                View Card
              </button>
            </div>
          </HolographicPanel>
          );
        })}
      </div>

      <div className="search-pagination">
        <button
          type="button"
          disabled={!page || page.page <= 1 || loadingSearch}
          onClick={() => void commitSearch(committedQuery, { pageNumber: Math.max(1, (page?.page ?? 1) - 1) })}
        >
          <ChevronLeft aria-hidden="true" /> Previous
        </button>
        <span>Page {page?.page ?? 1}{page?.totalCards ? ` - ${page.totalCards} Scryfall matches` : ""}</span>
        <button
          type="button"
          disabled={!page?.hasMore || !page.nextPage || loadingSearch}
          onClick={() => void commitSearch(committedQuery, { pageUrl: page?.nextPage, pageNumber: (page?.page ?? 1) + 1 })}
        >
          Next <ChevronRight aria-hidden="true" />
        </button>
      </div>

      {filterOpen ? (
        <div className="builder-modal-backdrop" role="presentation">
          <div className="builder-modal search-filter-modal" role="dialog" aria-modal="true" aria-label="Search filters">
            <div className="builder-modal__header">
              <h2>
                <Filter aria-hidden="true" /> Search Filters
              </h2>
              <button type="button" onClick={() => setFilterOpen(false)} aria-label="Close filters">
                x
              </button>
            </div>
            <div className="feature-controls--wide">
              <label>
                Exact phrase
                <input value={exactPhrase} onChange={(event) => setExactPhrase(event.target.value)} />
              </label>
              <label>
                Type or subtype
                <input value={typeText} onChange={(event) => setTypeText(event.target.value)} placeholder="Creature, Aura, Equipment" />
              </label>
              <label>
                Oracle text
                <input value={oracleText} onChange={(event) => setOracleText(event.target.value)} placeholder="draw a card" />
              </label>
              <label>
                Keyword ability
                <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Flying, ward, trample" />
              </label>
              <label>
                Scope
                <select value={scope} onChange={(event) => setScope(event.target.value as SearchScope)}>
                  {searchScopes.map((searchScope) => (
                    <option key={searchScope.id} value={searchScope.id}>
                      {searchScope.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Deck context
                <select value={deckId} onChange={(event) => setDeckId(event.target.value)}>
                  <option value="">No deck selected</option>
                  {decks.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Result view
                <select value={view} onChange={(event) => setView(event.target.value as SearchView)}>
                  <option value="compact">Compact</option>
                  <option value="image">Image/Card Tile</option>
                  <option value="grid">Grid</option>
                </select>
              </label>
            </div>
            <div className="form-actions">
              <button
                type="button"
                onClick={() => {
                  setFilterOpen(false);
                  void commitSearch(rawInput);
                }}
              >
                Apply Filters
              </button>
              <button type="button" onClick={() => setFilterOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <SearchAddToOverlay
        open={addToOpen}
        cards={addToCards}
        context={context}
        currentDeck={deck}
        decks={decks}
        requestedSection={requestedSection}
        sourceQuery={committedQuery || rawInput}
        initialDestination={addToDestination}
        onClose={closeAddTo}
        onComplete={completeAddTo}
      />

      {selectedCard ? (
        <div className="builder-modal-backdrop" role="presentation">
          <div className="builder-modal" role="dialog" aria-modal="true" aria-label={`${selectedCard.name} details`}>
            <div className="builder-modal__header">
              <h2>
                <Library aria-hidden="true" /> {selectedCard.name}
              </h2>
              <button type="button" onClick={() => setSelectedCard(null)} aria-label="Close card detail">
                x
              </button>
            </div>
            <div className="card-detail card-detail--scryfall">
              {pickCardImage(selectedCard.imageUris, "normal") ? (
                <img src={pickCardImage(selectedCard.imageUris, "normal")} alt="" loading="lazy" />
              ) : null}
              <p>
                <strong>Mana cost:</strong> {selectedCard.manaCost ?? "None"}
              </p>
              <p>
                <strong>Type:</strong> {selectedCard.typeLine}
              </p>
              <p>
                <strong>Rules:</strong> {selectedCard.oracleText || "Rules text unavailable."}
              </p>
              <p>
                <strong>Color identity:</strong>{" "}
                {selectedCard.colorIdentity.length > 0 ? selectedCard.colorIdentity.join(" ") : "Colorless"}
              </p>
              <p>
                <strong>Commander legality:</strong> {selectedCard.legalities.commander ?? "unknown"}
              </p>
              <p>
                <strong>Printing:</strong> {selectedCard.setName} #{selectedCard.collectorNumber}
              </p>
              <p className="scryfall-attribution">
                <BookOpen aria-hidden="true" /> Card data and images provided by Scryfall. Deckstate is not endorsed by Scryfall.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
