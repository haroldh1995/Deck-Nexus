import { useEffect, useMemo } from "react";
import { primeStaticImages } from "../../app/imageReadiness";
import { criticalHomeAssets } from "../../app/staticAssets";
import { useSettings } from "../../app/useSettings";
import { useDecks, useFavorites } from "../../db/hooks";
import type { HomeOrbitItem } from "../../types/navigation";
import "../../styles/homeHologram.css";
import { buildHomeOrbitItems, moveHomeOrbitItem } from "./homeOrbit";
import { buildHomeHologramCards } from "./scene/homeSceneContent";
import { HomeHologramScene } from "./scene/HomeHologramScene";

export function HomeScreen() {
  const { settings, updateSettings } = useSettings();
  const { decks } = useDecks();
  const { favorites } = useFavorites();

  useEffect(() => {
    void primeStaticImages(criticalHomeAssets).catch(() => undefined);
  }, []);

  const orbitItems = useMemo(
    () =>
      buildHomeOrbitItems(
        favorites,
        settings.homeOrbitOrder,
        settings.homeOrbitHiddenIds,
      ),
    [favorites, settings.homeOrbitHiddenIds, settings.homeOrbitOrder],
  );

  const menuItems = useMemo(
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

  async function saveMenuOrder(nextOrderIds: string[], nextHiddenIds: string[]) {
    await updateSettings({
      homeOrbitHiddenIds: nextHiddenIds,
      homeOrbitOrder: nextOrderIds,
    });
  }

  return (
    <HomeHologramScene
      cards={hologramCards}
      deckState={{
        deckCount: decks.length,
        hasDecks: decks.length > 0,
        mostRecentDeckName: mostRecentDeck?.name,
      }}
      hiddenItemIds={settings.homeOrbitHiddenIds}
      menuItems={menuItems}
      onMoveCard={(cardId, direction) => void moveCard(cardId, direction)}
      onSaveMenuOrder={saveMenuOrder}
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
