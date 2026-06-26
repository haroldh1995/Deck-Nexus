import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { HolographicPanel } from "../../components/HolographicPanel";
import { PageHeader } from "../../components/PageHeader";
import { StatusPill } from "../../components/StatusPill";
import { getDeck } from "../../db/repositories";
import type { Deck } from "../../types/domain";
import {
  formatBracketLock,
  formatCommanderNames,
  getDeckCardCount,
} from "./deckPresentation";

export function DeckBuilderScreen() {
  const { deckId } = useParams();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [loading, setLoading] = useState(Boolean(deckId));

  useEffect(() => {
    let mounted = true;

    async function loadDeck() {
      if (!deckId) {
        setLoading(false);
        return;
      }

      const nextDeck = await getDeck(deckId);
      if (mounted) {
        setDeck(nextDeck ?? null);
        setLoading(false);
      }
    }

    void loadDeck();

    return () => {
      mounted = false;
    };
  }, [deckId]);

  if (!deckId) {
    return (
      <div className="screen screen--narrow">
        <PageHeader title="Deck Builder">
          <StatusPill tone="violet">Prompt 2</StatusPill>
        </PageHeader>
        <HolographicPanel>
          <p className="foundation-summary">
            The Deck Builder route is ready. Full card editing and deck
            construction will be built in the next prompt.
          </p>
        </HolographicPanel>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="screen screen--narrow">
        <PageHeader title="Deck Builder" />
        <HolographicPanel>
          <p className="foundation-summary">Loading local deck.</p>
        </HolographicPanel>
      </div>
    );
  }

  if (!deck) {
    return (
      <div className="screen screen--narrow">
        <PageHeader title="Deck Builder" />
        <HolographicPanel>
          <div className="empty-panel">
            <h2>Deck not found</h2>
            <p>This local deck record is not available in IndexedDB.</p>
            <Link className="secondary-action" to="/library">
              Back to Library
            </Link>
          </div>
        </HolographicPanel>
      </div>
    );
  }

  return (
    <div className="screen">
      <PageHeader title={deck.name}>
        <StatusPill tone="cyan">Deck Builder</StatusPill>
      </PageHeader>

      <HolographicPanel>
        <div className="builder-foundation">
          <div>
            <h2>{formatCommanderNames(deck)}</h2>
            <p>
              Builder foundation route for this local Commander deck. Full deck
              editing is intentionally deferred to Prompt 2.
            </p>
          </div>
          <dl className="deck-stat-row">
            <div>
              <dt>Cards</dt>
              <dd>{getDeckCardCount(deck)}</dd>
            </div>
            <div>
              <dt>Bracket</dt>
              <dd>{formatBracketLock(deck.bracketLock)}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{deck.status}</dd>
            </div>
          </dl>
          <Link className="secondary-action" to="/library">
            Back to Library
          </Link>
        </div>
      </HolographicPanel>
    </div>
  );
}
