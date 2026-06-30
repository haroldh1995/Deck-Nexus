import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Library, Search, ShieldAlert, ShoppingCart, Sparkles } from "lucide-react";
import { HolographicPanel } from "../../components/HolographicPanel";
import { PageHeader } from "../../components/PageHeader";
import { StatusPill } from "../../components/StatusPill";
import { useDecks, useOwnedCards } from "../../db/hooks";
import { addDeckCard, upsertOwnedCard } from "../../db/repositories";
import type { CatalogCard } from "../../data/cardCatalog";
import type { AddDestination, ManualCardInput } from "../decks/builderTypes";
import { evaluateAddCardRules } from "../decks/commanderRules";
import {
  catalogCardToManualInput,
  searchCards,
  type CardSearchResult,
  type SearchScope,
  type SearchView,
} from "./cardSearch";

const searchScopes: { id: SearchScope; label: string }[] = [
  { id: "all", label: "All Cards" },
  { id: "owned", label: "Owned Cards" },
  { id: "current_deck", label: "Current Deck" },
  { id: "maybeboard", label: "Maybeboard" },
  { id: "cuts", label: "Cuts" },
  { id: "commander_candidates", label: "Commander Candidates" },
  { id: "cached_only", label: "Cached Cards Only" },
];

function typeFilterFromSection(section: string | null): string {
  if (section === "creatures") return "Creature";
  if (section === "instants") return "Instant";
  if (section === "sorceries") return "Sorcery";
  if (section === "artifacts") return "Artifact";
  if (section === "enchantments") return "Enchantment";
  if (section === "lands") return "Land";
  if (section === "otherPermanents") return "Planeswalker";
  return "";
}

export function CardSearchScreen() {
  const [searchParams] = useSearchParams();
  const { decks } = useDecks();
  const { ownedCards } = useOwnedCards();
  const initialDeckId = searchParams.get("deckId") ?? "";
  const requestedSection = searchParams.get("section");
  const [deckId, setDeckId] = useState(initialDeckId);
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [exactPhrase, setExactPhrase] = useState("");
  const [typeText, setTypeText] = useState(typeFilterFromSection(requestedSection));
  const [oracleText, setOracleText] = useState("");
  const [keyword, setKeyword] = useState("");
  const [scope, setScope] = useState<SearchScope>("all");
  const [view, setView] = useState<SearchView>("compact");
  const [message, setMessage] = useState("Manual search results are local cached data in this build.");
  const [pendingWarning, setPendingWarning] = useState<{
    result: CardSearchResult;
    input: ManualCardInput;
    warning: string;
  } | null>(null);
  const [selectedCard, setSelectedCard] = useState<CatalogCard | null>(null);
  const deck = decks.find((candidate) => candidate.id === deckId);
  const results = useMemo(
    () =>
      searchCards(
        { query, exactPhrase, typeText, oracleText, keyword, scope },
        { deck, ownedCards, manualSearch: true },
      ),
    [deck, exactPhrase, keyword, oracleText, ownedCards, query, scope, typeText],
  );

  async function addResultToDeck(result: CardSearchResult, destination: AddDestination) {
    if (!deck) {
      setMessage("Choose a deck before adding a card to a deck zone.");
      return;
    }

    const input = catalogCardToManualInput({
      card: result.card,
      ownedQuantity: result.ownedQuantity,
      destination,
      requestedSection:
        requestedSection === "commander" ||
        requestedSection === "creatures" ||
        requestedSection === "instants" ||
        requestedSection === "sorceries" ||
        requestedSection === "artifacts" ||
        requestedSection === "enchantments" ||
        requestedSection === "otherPermanents" ||
        requestedSection === "lands"
          ? requestedSection
          : undefined,
    });
    const ruleResult = evaluateAddCardRules({
      deck,
      input,
      mode: "guided",
    });
    const firstWarning = ruleResult.warnings[0];

    if (destination === "main" && firstWarning) {
      setPendingWarning({ result, input, warning: firstWarning.message });
      return;
    }

    await addDeckCard(deck.id, input, destination);
    setMessage(`${result.card.name} added to ${destination === "main" ? "Main Deck" : destination}.`);
  }

  async function addOwned(card: CatalogCard) {
    await upsertOwnedCard({
      name: card.name,
      quantityOwned: 1,
      oracleId: card.oracleId,
      scryfallId: card.scryfallId,
      manaCost: card.manaCost,
      typeLine: card.typeLine,
      oracleText: card.oracleText,
      colorIdentity: card.colorIdentity,
      tags: card.roles,
      duplicateFlag: "none",
      printing: {
        name: card.name,
        oracleId: card.oracleId,
        scryfallId: card.scryfallId,
        quantityOwned: 1,
      },
    });
    setMessage(`${card.name} added to Owned Cards.`);
  }

  async function confirmPending(destination: AddDestination) {
    if (!pendingWarning || !deck) {
      return;
    }

    await addDeckCard(
      deck.id,
      {
        ...pendingWarning.input,
        destination,
      },
      destination,
    );
    setMessage(
      destination === "main"
        ? `${pendingWarning.result.card.name} added after manual warning override.`
        : `${pendingWarning.result.card.name} sent to Maybeboard.`,
    );
    setPendingWarning(null);
  }

  return (
    <section className="screen feature-screen card-search-screen">
      <PageHeader title="Card Search">
        <StatusPill tone="cyan">Manual Override Search</StatusPill>
      </PageHeader>

      <HolographicPanel className="feature-grid feature-grid--search">
        <div className="feature-controls feature-controls--wide">
          <label>
            Search card name
            <input
              aria-label="Search card name"
              placeholder="Partial, single word, multi-word, or exact card name"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label>
            Exact phrase
            <input
              aria-label="Exact phrase"
              placeholder="Exact rules/name phrase"
              value={exactPhrase}
              onChange={(event) => setExactPhrase(event.target.value)}
            />
          </label>
          <label>
            Type or subtype
            <input
              aria-label="Type or subtype search"
              placeholder="Creature, Aura, Equipment, Land..."
              value={typeText}
              onChange={(event) => setTypeText(event.target.value)}
            />
          </label>
          <label>
            Oracle text
            <input
              aria-label="Oracle rules text search"
              placeholder="Draw, exile, treasure, proliferate..."
              value={oracleText}
              onChange={(event) => setOracleText(event.target.value)}
            />
          </label>
          <label>
            Keyword / role
            <input
              aria-label="Keyword ability search"
              placeholder="Flying, ramp, tutor, voltron..."
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
          </label>
          <label>
            Scope
            <select
              aria-label="Search scope"
              value={scope}
              onChange={(event) => setScope(event.target.value as SearchScope)}
            >
              {searchScopes.map((searchScope) => (
                <option key={searchScope.id} value={searchScope.id}>
                  {searchScope.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Deck context
            <select
              aria-label="Deck context"
              value={deckId}
              onChange={(event) => setDeckId(event.target.value)}
            >
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
            <select
              aria-label="Result view"
              value={view}
              onChange={(event) => setView(event.target.value as SearchView)}
            >
              <option value="compact">Compact</option>
              <option value="image">Image/Card Tile</option>
              <option value="grid">Grid</option>
            </select>
          </label>
        </div>
      </HolographicPanel>

      <div className="feature-status" role="status">
        <Search aria-hidden="true" />
        <span>{message}</span>
        <strong>{results.length} results</strong>
      </div>

      <div className={`search-results search-results--${view}`}>
        {results.map((result) => (
          <HolographicPanel
            as="article"
            variant="card"
            className="search-result-card"
            key={result.card.id}
          >
            <div className="result-art" aria-hidden="true">
              <Sparkles />
            </div>
            <div className="result-copy">
              <h2>{result.card.name}</h2>
              <p>{result.card.typeLine}</p>
              <small>{result.card.oracleText}</small>
              <div className="badge-row" aria-label={`${result.card.name} search badges`}>
                {result.badges.map((badge) => (
                  <span key={badge} className={badge.includes("Outside") || badge.includes("Banned") ? "badge badge--warn" : "badge"}>
                    {badge === "Missing" ? <ShoppingCart aria-hidden="true" /> : null}
                    {badge}
                  </span>
                ))}
              </div>
            </div>
            <div className="result-actions">
              <button type="button" onClick={() => addResultToDeck(result, "main")}>
                Add to Main
              </button>
              <button type="button" onClick={() => addResultToDeck(result, "maybeboard")}>
                Add to Maybeboard
              </button>
              <button type="button" onClick={() => addOwned(result.card)}>
                Add Owned
              </button>
              <button type="button" onClick={() => setSelectedCard(result.card)}>
                Details
              </button>
            </div>
          </HolographicPanel>
        ))}
      </div>

      {pendingWarning ? (
        <div className="builder-modal-backdrop" role="presentation">
          <div className="builder-modal builder-modal--compact" role="alertdialog" aria-modal="true">
            <div className="builder-modal__header">
              <h2>
                <ShieldAlert aria-hidden="true" /> Commander Rule Warning
              </h2>
              <button type="button" onClick={() => setPendingWarning(null)} aria-label="Cancel add">
                x
              </button>
            </div>
            <p className="foundation-summary">{pendingWarning.warning}</p>
            <div className="form-actions">
              <button type="button" onClick={() => confirmPending("main")}>
                Add Anyway
              </button>
              <button type="button" onClick={() => confirmPending("maybeboard")}>
                Send to Maybeboard
              </button>
              <button type="button" onClick={() => setPendingWarning(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
            <div className="card-detail">
              <p>
                <strong>Mana cost:</strong> {selectedCard.manaCost ?? "None"}
              </p>
              <p>
                <strong>Type:</strong> {selectedCard.typeLine}
              </p>
              <p>
                <strong>Rules:</strong> {selectedCard.oracleText}
              </p>
              <p>
                <strong>Color identity:</strong>{" "}
                {selectedCard.colorIdentity.length > 0 ? selectedCard.colorIdentity.join(" ") : "Colorless"}
              </p>
              <p>
                <strong>Bracket impact:</strong> {selectedCard.bracketImpact.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
