import { useEffect, useState } from "react";
import type { Deck, OwnedCard } from "../types/domain";
import { listDecks, listOwnedCards } from "./repositories";

export function useDecks() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function refreshDecks() {
      const nextDecks = await listDecks();
      if (mounted) {
        setDecks(nextDecks);
        setLoading(false);
      }
    }

    void refreshDecks();

    window.addEventListener("deck-nexus:decks-updated", refreshDecks);
    return () => {
      mounted = false;
      window.removeEventListener("deck-nexus:decks-updated", refreshDecks);
    };
  }, []);

  return { decks, loading };
}

export function useOwnedCards() {
  const [ownedCards, setOwnedCards] = useState<OwnedCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function refreshOwnedCards() {
      const nextOwnedCards = await listOwnedCards();
      if (mounted) {
        setOwnedCards(nextOwnedCards);
        setLoading(false);
      }
    }

    void refreshOwnedCards();

    window.addEventListener("deck-nexus:owned-updated", refreshOwnedCards);
    window.addEventListener("deck-nexus:scanner-updated", refreshOwnedCards);
    return () => {
      mounted = false;
      window.removeEventListener("deck-nexus:owned-updated", refreshOwnedCards);
      window.removeEventListener("deck-nexus:scanner-updated", refreshOwnedCards);
    };
  }, []);

  return { ownedCards, loading };
}
