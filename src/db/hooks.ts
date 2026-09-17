import { useEffect, useState, useSyncExternalStore } from "react";
import {
  getResidentDecks,
  getResidentFavorites,
  getResidentOwnedCards,
  hasResidentDecks,
  hasResidentFavorites,
  hasResidentOwnedCards,
  hydrateResidentDecks,
  hydrateResidentFavorites,
  hydrateResidentOwnedCards,
  refreshResidentDecks,
  refreshResidentFavorites,
  refreshResidentOwnedCards,
  subscribeResidentDecks,
  subscribeResidentFavorites,
  subscribeResidentOwnedCards,
} from "./residentData";

export function useDecks() {
  const [loading, setLoading] = useState(() => !hasResidentDecks());
  const decks = useSyncExternalStore(
    subscribeResidentDecks,
    getResidentDecks,
    getResidentDecks,
  );

  useEffect(() => {
    let mounted = true;

    void hydrateResidentDecks()
      .catch(() => undefined)
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    const refresh = () => {
      void refreshResidentDecks().catch(() => undefined);
    };

    window.addEventListener("deck-nexus:decks-updated", refresh);
    return () => {
      mounted = false;
      window.removeEventListener("deck-nexus:decks-updated", refresh);
    };
  }, []);

  return { decks, loading };
}

export function useOwnedCards() {
  const [loading, setLoading] = useState(() => !hasResidentOwnedCards());
  const ownedCards = useSyncExternalStore(
    subscribeResidentOwnedCards,
    getResidentOwnedCards,
    getResidentOwnedCards,
  );

  useEffect(() => {
    let mounted = true;

    void hydrateResidentOwnedCards()
      .catch(() => undefined)
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    const refresh = () => {
      void refreshResidentOwnedCards().catch(() => undefined);
    };

    window.addEventListener("deck-nexus:owned-updated", refresh);
    window.addEventListener("deck-nexus:scanner-updated", refresh);
    return () => {
      mounted = false;
      window.removeEventListener("deck-nexus:owned-updated", refresh);
      window.removeEventListener("deck-nexus:scanner-updated", refresh);
    };
  }, []);

  return { ownedCards, loading };
}

export function useFavorites() {
  const [loading, setLoading] = useState(() => !hasResidentFavorites());
  const favorites = useSyncExternalStore(
    subscribeResidentFavorites,
    getResidentFavorites,
    getResidentFavorites,
  );

  useEffect(() => {
    let mounted = true;

    void hydrateResidentFavorites()
      .catch(() => undefined)
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    const refresh = () => {
      void refreshResidentFavorites().catch(() => undefined);
    };

    window.addEventListener("deck-nexus:favorites-updated", refresh);
    return () => {
      mounted = false;
      window.removeEventListener("deck-nexus:favorites-updated", refresh);
    };
  }, []);

  return { favorites, loading };
}
