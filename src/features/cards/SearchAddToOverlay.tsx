import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  Check,
  Heart,
  Layers,
  Library,
  PlusCircle,
  ShieldAlert,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import { HolographicPanel } from "../../components/HolographicPanel";
import { db } from "../../db/database";
import type {
  CustomCollection,
  Deck,
  DeckstateScryfallCard,
  UpgradeList,
  WishlistPriority,
} from "../../types/domain";
import type { AddDestination, BuilderSectionId } from "../decks/builderTypes";
import {
  addCardsToCustomCollectionFromSearch,
  addCardsToDeckFromSearch,
  addCardsToUpgradeListFromSearch,
  addCardsToWishlistFromSearch,
  createDeckFromSearch,
  favoriteCardsFromSearch,
  getUniversalDestinations,
  isCommanderEligible,
  rankDecksForCards,
  registerOwnedFromSearch,
  summarizeDeckCompatibility,
  type AddToCardsResult,
  type SearchActionContext,
  type SearchDestinationType,
} from "./searchDestinations";

interface SearchAddToOverlayProps {
  open: boolean;
  cards: DeckstateScryfallCard[];
  context: SearchActionContext;
  currentDeck?: Deck;
  decks: Deck[];
  requestedSection?: BuilderSectionId;
  sourceQuery: string;
  initialDestination?: SearchDestinationType;
  onClose: () => void;
  onComplete: (result: AddToCardsResult) => void;
}

const destinationIcons: Record<SearchDestinationType, typeof Library> = {
  current_deck: Library,
  existing_deck: Library,
  new_deck: PlusCircle,
  owned: Archive,
  wishlist: Heart,
  maybeboard: Layers,
  cuts: ShieldAlert,
  upgrade_list: Sparkles,
  favorites: Star,
  custom_collection: Archive,
  new_custom_collection: PlusCircle,
};

function destinationLabel(destination: SearchDestinationType): string {
  const labels: Record<SearchDestinationType, string> = {
    current_deck: "Current Deck",
    existing_deck: "Another Existing Deck",
    new_deck: "New Deck",
    owned: "Owned Cards",
    wishlist: "Wishlist",
    maybeboard: "Maybeboard",
    cuts: "Cuts",
    upgrade_list: "Upgrade List",
    favorites: "Favorites",
    custom_collection: "Custom Collection",
    new_custom_collection: "New Custom Collection",
  };
  return labels[destination];
}

function formatColors(deck: Deck): string {
  return deck.colorIdentity.length > 0 ? deck.colorIdentity.join("") : "Colorless / unset";
}

export function SearchAddToOverlay({
  open,
  cards,
  context,
  currentDeck,
  decks,
  requestedSection,
  sourceQuery,
  initialDestination,
  onClose,
  onComplete,
}: SearchAddToOverlayProps) {
  const [destination, setDestination] = useState<SearchDestinationType>(
    initialDestination ?? (currentDeck ? "current_deck" : "wishlist"),
  );
  const [deckId, setDeckId] = useState(currentDeck?.id ?? decks[0]?.id ?? "");
  const [deckDestination, setDeckDestination] = useState<AddDestination>("main");
  const [allowConflicts, setAllowConflicts] = useState(false);
  const [ownedQuantity, setOwnedQuantity] = useState(1);
  const [wishlistQuantity, setWishlistQuantity] = useState(1);
  const [wishlistPriority, setWishlistPriority] = useState<WishlistPriority>("normal");
  const [newDeckName, setNewDeckName] = useState(cards[0] ? `${cards[0].name} Deck` : "New Commander Deck");
  const [newDeckRole, setNewDeckRole] = useState<"commander" | "main" | "maybeboard" | "inspiration">("commander");
  const [commanderId, setCommanderId] = useState(cards[0]?.id ?? "");
  const [upgradeLists, setUpgradeLists] = useState<UpgradeList[]>([]);
  const [upgradeListId, setUpgradeListId] = useState("");
  const [upgradeListName, setUpgradeListName] = useState("Search Upgrades");
  const [collections, setCollections] = useState<CustomCollection[]>([]);
  const [collectionId, setCollectionId] = useState("");
  const [collectionName, setCollectionName] = useState("Search Collection");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    const resetTimer = window.setTimeout(() => {
      setDestination(initialDestination ?? (currentDeck ? "current_deck" : "wishlist"));
      setDeckId(currentDeck?.id ?? decks[0]?.id ?? "");
      setCommanderId(cards[0]?.id ?? "");
      setNewDeckName(cards[0] ? `${cards[0].name} Deck` : "New Commander Deck");
      setAllowConflicts(false);
      setError("");
    }, 0);

    void Promise.all([
      db.upgradeLists.where("archived").equals(0).toArray().catch(() => db.upgradeLists.toArray()),
      db.customCollections.where("archived").equals(0).toArray().catch(() => db.customCollections.toArray()),
    ]).then(([loadedLists, loadedCollections]) => {
      setUpgradeLists(loadedLists);
      setCollections(loadedCollections);
      setUpgradeListId(loadedLists[0]?.id ?? "");
      setCollectionId(loadedCollections[0]?.id ?? "");
    });

    return () => window.clearTimeout(resetTimer);
  }, [cards, currentDeck, decks, initialDestination, open]);

  const options = useMemo(
    () => getUniversalDestinations({ context, hasCurrentDeck: Boolean(currentDeck) }),
    [context, currentDeck],
  );
  const selectedDeck = decks.find((deck) => deck.id === deckId);
  const deckChoices = useMemo(() => rankDecksForCards(decks, cards), [cards, decks]);
  const targetDeck =
    destination === "current_deck" ? currentDeck : destination === "new_deck" ? undefined : selectedDeck;
  const conflictSummary = targetDeck ? summarizeDeckCompatibility(targetDeck, cards) : undefined;
  const selectedCommander = cards.find((card) => card.id === commanderId);
  const commanderEligible = selectedCommander ? isCommanderEligible(selectedCommander) : false;

  if (!open) {
    return null;
  }

  async function confirmAction() {
    setBusy(true);
    setError("");
    try {
      let result: AddToCardsResult;

      if (destination === "current_deck" || destination === "existing_deck" || destination === "maybeboard" || destination === "cuts") {
        const deck =
          destination === "current_deck"
            ? currentDeck
            : decks.find((candidate) => candidate.id === deckId);
        if (!deck) {
          throw new Error("Choose a deck destination first.");
        }
        const resolvedDestination: AddDestination =
          destination === "maybeboard" ? "maybeboard" : destination === "cuts" ? "cuts" : deckDestination;
        result = await addCardsToDeckFromSearch({
          deck,
          cards,
          destination: resolvedDestination,
          requestedSection,
          sourceQuery,
          allowConflicts,
        });
      } else if (destination === "new_deck") {
        if (newDeckRole === "commander" && selectedCommander && !commanderEligible) {
          throw new Error(`${selectedCommander.name} is not Commander eligible. Choose Main Deck, Maybeboard, Inspiration, or another commander.`);
        }
        result = await createDeckFromSearch({
          cards,
          deckName: newDeckName,
          role: newDeckRole,
          commanderId,
          sourceQuery,
        });
      } else if (destination === "owned") {
        result = await registerOwnedFromSearch({ cards, quantity: ownedQuantity });
      } else if (destination === "wishlist") {
        result = await addCardsToWishlistFromSearch({
          cards,
          quantity: wishlistQuantity,
          priority: wishlistPriority,
          sourceQuery,
          intendedDeckId: currentDeck?.id,
        });
      } else if (destination === "upgrade_list") {
        result = await addCardsToUpgradeListFromSearch({
          cards,
          listId: upgradeListId || undefined,
          listName: upgradeListName,
          relatedDeckId: currentDeck?.id,
          sourceQuery,
        });
      } else if (destination === "custom_collection" || destination === "new_custom_collection") {
        result = await addCardsToCustomCollectionFromSearch({
          cards,
          collectionId: destination === "custom_collection" ? collectionId || undefined : undefined,
          collectionName,
          sourceQuery,
        });
      } else {
        result = await favoriteCardsFromSearch({ cards, sourceQuery });
      }

      onComplete(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Add To action failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="builder-modal-backdrop add-to-backdrop" role="presentation">
      <HolographicPanel className="add-to-dialog" role="dialog" aria-modal="true" aria-label="Add selected cards to a destination">
        <div className="builder-modal__header">
          <div>
            <p className="page-header__sigil">Add To...</p>
            <h2>{cards.length} selected card{cards.length === 1 ? "" : "s"}</h2>
          </div>
          <button type="button" className="search-icon-button" onClick={onClose} aria-label="Close Add To">
            <X aria-hidden="true" />
          </button>
        </div>

        <div className="add-to-preview" aria-label="Selected card preview">
          {cards.slice(0, 4).map((card) => (
            <span key={card.id}>{card.name}</span>
          ))}
          {cards.length > 4 ? <span>+{cards.length - 4} more</span> : null}
        </div>

        <div className="add-to-grid" aria-label="Destination choices">
          {options.map((option) => {
            const Icon = destinationIcons[option.id];
            const unavailable = option.id === "current_deck" && !currentDeck;
            return (
              <button
                key={option.id}
                type="button"
                className={destination === option.id ? "add-to-destination is-active" : "add-to-destination"}
                disabled={unavailable}
                onClick={() => {
                  setDestination(option.id);
                  if (option.id === "maybeboard") setDeckDestination("maybeboard");
                  if (option.id === "cuts") setDeckDestination("cuts");
                  if (option.id === "current_deck" || option.id === "existing_deck") setDeckDestination("main");
                }}
              >
                <Icon aria-hidden="true" />
                <span>{option.label}</span>
                <small>{option.description}</small>
              </button>
            );
          })}
        </div>

        <div className="add-to-config">
          {(destination === "existing_deck" || destination === "maybeboard" || destination === "cuts") && (
            <label>
              Deck destination
              <select value={deckId} onChange={(event) => setDeckId(event.target.value)}>
                {deckChoices.map((choice) => (
                  <option key={choice.deck.id} value={choice.deck.id}>
                    {choice.deck.name} - {formatColors(choice.deck)} - {choice.currentCount}/100 - {choice.compatibleCount} fit
                  </option>
                ))}
              </select>
            </label>
          )}

          {(destination === "current_deck" || destination === "existing_deck") && (
            <label>
              Deck placement
              <select value={deckDestination} onChange={(event) => setDeckDestination(event.target.value as AddDestination)}>
                <option value="main">Main Deck / Correct Section</option>
                <option value="maybeboard">Maybeboard</option>
                <option value="cuts">Cuts</option>
              </select>
            </label>
          )}

          {conflictSummary ? (
            <div className="add-to-review" role="status">
              <strong>{targetDeck?.name}</strong>
              <span>{conflictSummary.compatible.length} compatible</span>
              <span>{conflictSummary.outsideIdentity.length} outside identity</span>
              <span>{conflictSummary.duplicates.length} duplicate conflicts</span>
              <span>{conflictSummary.overLimit ? "Would exceed 100" : "Count review passed"}</span>
              {conflictSummary.warnings.length > 0 ? (
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={allowConflicts}
                    onChange={(event) => setAllowConflicts(event.target.checked)}
                  />
                  Add anyway with explicit warning override
                </label>
              ) : null}
            </div>
          ) : null}

          {destination === "new_deck" ? (
            <>
              <label>
                Deck name
                <input value={newDeckName} onChange={(event) => setNewDeckName(event.target.value)} />
              </label>
              <label>
                Use selected cards as
                <select value={newDeckRole} onChange={(event) => setNewDeckRole(event.target.value as typeof newDeckRole)}>
                  <option value="commander">Use one as Commander</option>
                  <option value="main">Add to Main Deck</option>
                  <option value="maybeboard">Add all to Maybeboard</option>
                  <option value="inspiration">Save as Inspiration Shell</option>
                </select>
              </label>
              {newDeckRole === "commander" ? (
                <label>
                  Commander candidate
                  <select value={commanderId} onChange={(event) => setCommanderId(event.target.value)}>
                    {cards.map((card) => (
                      <option key={card.id} value={card.id}>
                        {card.name}{isCommanderEligible(card) ? "" : " - not Commander legal"}
                      </option>
                    ))}
                  </select>
                  {selectedCommander && !commanderEligible ? (
                    <small className="add-to-warning">{selectedCommander.name} cannot be silently assigned as Commander.</small>
                  ) : null}
                </label>
              ) : null}
            </>
          ) : null}

          {destination === "owned" ? (
            <label>
              Quantity to register
              <input
                type="number"
                min="1"
                value={ownedQuantity}
                onChange={(event) => setOwnedQuantity(Math.max(1, Number(event.target.value) || 1))}
              />
            </label>
          ) : null}

          {destination === "wishlist" ? (
            <>
              <label>
                Desired quantity
                <input
                  type="number"
                  min="1"
                  value={wishlistQuantity}
                  onChange={(event) => setWishlistQuantity(Math.max(1, Number(event.target.value) || 1))}
                />
              </label>
              <label>
                Priority
                <select value={wishlistPriority} onChange={(event) => setWishlistPriority(event.target.value as WishlistPriority)}>
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="essential">Essential</option>
                </select>
              </label>
            </>
          ) : null}

          {destination === "upgrade_list" ? (
            <>
              {upgradeLists.length > 0 ? (
                <label>
                  Upgrade list
                  <select value={upgradeListId} onChange={(event) => setUpgradeListId(event.target.value)}>
                    <option value="">Create new list</option>
                    {upgradeLists.map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {!upgradeListId ? (
                <label>
                  New list name
                  <input value={upgradeListName} onChange={(event) => setUpgradeListName(event.target.value)} />
                </label>
              ) : null}
            </>
          ) : null}

          {(destination === "custom_collection" || destination === "new_custom_collection") ? (
            <>
              {destination === "custom_collection" && collections.length > 0 ? (
                <label>
                  Collection
                  <select value={collectionId} onChange={(event) => setCollectionId(event.target.value)}>
                    <option value="">Create new collection</option>
                    {collections.map((collection) => (
                      <option key={collection.id} value={collection.id}>
                        {collection.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {(destination === "new_custom_collection" || !collectionId) ? (
                <label>
                  New collection name
                  <input value={collectionName} onChange={(event) => setCollectionName(event.target.value)} />
                </label>
              ) : null}
            </>
          ) : null}
        </div>

        <div className="add-to-confirm">
          <p>
            Confirm adding {cards.length} card{cards.length === 1 ? "" : "s"} to {destinationLabel(destination)}.
            Search will stay open and no prices or marketplace data will be stored.
          </p>
          {error ? <p className="add-to-warning" role="alert">{error}</p> : null}
          <div className="form-actions">
            <button type="button" onClick={() => void confirmAction()} disabled={busy}>
              <Check aria-hidden="true" /> {busy ? "Saving..." : "Confirm"}
            </button>
            <button type="button" onClick={onClose} disabled={busy}>
              Cancel
            </button>
          </div>
        </div>
      </HolographicPanel>
    </div>
  );
}
