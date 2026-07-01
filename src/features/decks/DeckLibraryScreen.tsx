import { Link } from "react-router-dom";
import { ConfirmButton } from "../../components/ConfirmButton";
import { HolographicPanel } from "../../components/HolographicPanel";
import { PageHeader } from "../../components/PageHeader";
import { StatusPill } from "../../components/StatusPill";
import { useDecks } from "../../db/hooks";
import { deleteDeck } from "../../db/repositories";
import {
  formatBracketLock,
  formatCommanderNames,
  getDeckCardCount,
} from "./deckPresentation";

export function DeckLibraryScreen() {
  const { decks, loading } = useDecks();

  return (
    <div className="screen">
      <PageHeader title="Deck Library">
        <Link className="secondary-action" to="/wishlist">
          Wishlist
        </Link>
        <Link className="secondary-action" to="/upgrade-lists">
          Upgrades
        </Link>
        <Link className="secondary-action" to="/collections">
          Collections
        </Link>
        <Link className="secondary-action" to="/create">
          Create Deck
        </Link>
      </PageHeader>

      {loading ? (
        <HolographicPanel>
          <p className="foundation-summary">Loading local decks.</p>
        </HolographicPanel>
      ) : decks.length === 0 ? (
        <HolographicPanel>
          <div className="empty-panel">
            <h2>No decks summoned</h2>
            <p>Create or import your first Commander deck.</p>
            <Link className="primary-action" to="/create">
              Create Deck
            </Link>
          </div>
        </HolographicPanel>
      ) : (
        <div className="deck-list">
          {decks.map((deck) => (
            <HolographicPanel
              as="article"
              className="deck-list-card"
              key={deck.id}
              variant="card"
            >
              <div className="deck-list-card__main">
                <div>
                  <h2>{deck.name}</h2>
                  <p>{formatCommanderNames(deck)}</p>
                </div>
                <div className="deck-list-card__meta">
                  <StatusPill tone="cyan">{deck.status}</StatusPill>
                  <StatusPill tone="violet">
                    {formatBracketLock(deck.bracketLock)}
                  </StatusPill>
                </div>
              </div>
              <dl className="deck-stat-row">
                <div>
                  <dt>Cards</dt>
                  <dd>{getDeckCardCount(deck)}</dd>
                </div>
                <div>
                  <dt>Format</dt>
                  <dd>Commander</dd>
                </div>
              </dl>
              <div className="deck-list-card__actions">
                <Link
                  className="secondary-action"
                  to={`/deck-builder/${deck.id}`}
                >
                  Open Deck
                </Link>
                <ConfirmButton
                  className="danger-action"
                  confirmLabel="Delete deck"
                  onConfirm={() => deleteDeck(deck.id)}
                >
                  Delete
                </ConfirmButton>
              </div>
            </HolographicPanel>
          ))}
        </div>
      )}
    </div>
  );
}
