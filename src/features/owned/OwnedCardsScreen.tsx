import { useMemo, useState } from "react";
import { Heart, LibraryBig, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { HolographicPanel } from "../../components/HolographicPanel";
import { PageHeader } from "../../components/PageHeader";
import { StatusPill } from "../../components/StatusPill";
import { useOwnedCards } from "../../db/hooks";
import { deleteOwnedCard, updateOwnedCard, upsertOwnedCard } from "../../db/repositories";
import type { CommanderColor, OwnedDuplicateFlag } from "../../types/domain";
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
  | "extras";

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
];

const duplicateFlags: { id: OwnedDuplicateFlag; label: string }[] = [
  { id: "none", label: "None" },
  { id: "needs_review", label: "Needs Review" },
  { id: "multiple_owned", label: "Multiple Owned" },
  { id: "sharing_between_decks", label: "Sharing Between Decks" },
];

export function OwnedCardsScreen() {
  const { ownedCards, loading } = useOwnedCards();
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
  const [foil, setFoil] = useState(false);
  const [message, setMessage] = useState("Ownership is planning-only. Missing markers never mean purchasing.");

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

    return ownedCards;
  }, [ownedCards, view]);

  async function handleAddOwned(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      setMessage("Enter a card name before saving an owned card.");
      return;
    }

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
      duplicateFlag,
      printing: {
        name,
        setCode,
        setName: setCode ? `Set ${setCode.toUpperCase()}` : "Local Entry",
        collectorNumber,
        foil,
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
    setFoil(false);
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
            Notes
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
          <div className="feature-inline">
            <label>
              <input checked={favorite} type="checkbox" onChange={(event) => setFavorite(event.target.checked)} />
              Favorite
            </label>
            <label>
              <input checked={foil} type="checkbox" onChange={(event) => setFoil(event.target.checked)} />
              Foil printing
            </label>
          </div>
          <button type="submit">Save Owned Card</button>
        </form>

        <div className="owned-registry-panel">
          <div className="feature-toolbar">
            <label>
              View / filter
              <select value={view} onChange={(event) => setView(event.target.value as OwnedView)}>
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
