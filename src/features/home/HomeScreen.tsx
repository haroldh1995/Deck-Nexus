import { useEffect, useMemo, useState } from "react";
import { useSettings } from "../../app/useSettings";
import { useDecks } from "../../db/hooks";
import { listFavorites } from "../../db/repositories";
import type { FavoriteItem } from "../../types/domain";
import type { HomeOrbitItem } from "../../types/navigation";
import "../../styles/homeHologram.css";
import { buildHomeOrbitItems, moveHomeOrbitItem } from "./homeOrbit";
import { buildHomeHologramCards } from "./scene/homeSceneContent";
import { HomeHologramScene } from "./scene/HomeHologramScene";

export function HomeScreen() {
  const { settings, updateSettings } = useSettings();
  const { decks } = useDecks();
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);

  useEffect(() => {
    let mounted = true;

    async function refreshFavorites() {
      const nextFavorites = await listFavorites();
      if (mounted) {
        setFavorites(nextFavorites);
      }
    }

    void refreshFavorites();
    window.addEventListener("deck-nexus:favorites-updated", refreshFavorites);

    return () => {
      mounted = false;
      window.removeEventListener(
        "deck-nexus:favorites-updated",
        refreshFavorites,
      );
    };
  }, []);

  const orbitItems = useMemo(
    () => buildHomeOrbitItems(favorites, settings.homeOrbitOrder),
    [favorites, settings.homeOrbitOrder],
  );

  const hologramCards = useMemo(
    () => buildHomeHologramCards(orbitItems),
    [orbitItems],
  );

  const mostRecentDeck = useMemo(
    () =>
      [...decks].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      )[0],
    [decks],
  );

  async function persistOrbitOrder(nextItems: HomeOrbitItem[]) {
    await updateSettings({
      homeOrbitOrder: nextItems.map((item) => item.id),
    });
  }

  async function moveCard(cardId: string, direction: -1 | 1) {
    const nextItems = moveHomeOrbitItem(orbitItems, cardId, direction);
    await persistOrbitOrder(nextItems);
  }

  return (
    <HomeHologramScene
      cards={hologramCards}
      deckState={{
        deckCount: decks.length,
        hasDecks: decks.length > 0,
        mostRecentDeckName: mostRecentDeck?.name,
      }}
      onMoveCard={(cardId, direction) => void moveCard(cardId, direction)}
      settings={{
        deviceTiltParallax: settings.deviceTiltParallax,
        glowIntensity: settings.glowIntensity,
        highContrast: settings.highContrast,
        homePerformanceMode: settings.homePerformanceMode,
        reducedMotion: settings.reducedMotion,
        staticHomeScreen: settings.staticHomeScreen,
        textSize: settings.textSize,
      }}
    />
  );
}
