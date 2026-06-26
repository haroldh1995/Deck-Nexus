import { useEffect, useState } from "react";
import type { Deck } from "../types/domain";
import { listDecks } from "./repositories";

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
