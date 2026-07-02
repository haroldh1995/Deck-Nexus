import {
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { preloadAppRoute } from "../../../app/routePreloaders";
import { AppIcon } from "../../../components/AppIcon";
import type { HomeOrbitItem } from "../../../types/navigation";
import {
  getRotationForIndex,
} from "./orbitMath";
import {
  homeFocusedCardStorageKey,
  homeReferenceImage,
} from "./homeSceneConstants";
import { getHomeStatusCopy } from "./homeSceneContent";
import type {
  HomeHologramCard,
  HomeSceneDeckState,
  HomeSceneSettings,
} from "./homeSceneTypes";
import { CentralBeamAssembly } from "./CentralBeam";
import { CentralCrystalAssembly } from "./CentralCrystal";
import {
  LowerProjectionAssembly,
  UpperProjectionAssembly,
} from "./ArcaneRings";
import { HologramParticlesCanvas } from "./HologramParticlesCanvas";
import { HomeMenuCustomizationOverlay } from "./HomeMenuCustomizationOverlay";
import { OrbitCard } from "./OrbitCard";
import { useHomeIntro } from "./useHomeIntro";
import { useOrbitPhysics } from "./useOrbitPhysics";
import { useResponsiveSceneScale } from "./useResponsiveSceneScale";
import { useSceneParallax } from "./useSceneParallax";
import { useSceneVisibility } from "./useSceneVisibility";

export function HomeHologramScene({
  cards,
  deckState,
  hiddenItemIds,
  menuItems,
  settings,
  onMoveCard,
  onSaveMenuOrder,
}: {
  cards: readonly HomeHologramCard[];
  deckState: HomeSceneDeckState;
  hiddenItemIds: readonly string[];
  menuItems: readonly HomeOrbitItem[];
  settings: HomeSceneSettings;
  onMoveCard: (cardId: string, direction: -1 | 1) => void;
  onSaveMenuOrder: (
    nextOrderIds: string[],
    nextHiddenIds: string[],
  ) => Promise<void>;
}) {
  const navigate = useNavigate();
  const gearButtonRef = useRef<HTMLButtonElement>(null);
  const persistFocusFrameRef = useRef(0);
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const sceneScale = useResponsiveSceneScale();
  const visible = useSceneVisibility();
  const staticHome = settings.staticHomeScreen;
  const { introMode, markIntroPlayed } = useHomeIntro(settings.reducedMotion);
  const registerParallaxSurface = useSceneParallax({
    deviceTiltEnabled: settings.deviceTiltParallax,
    enabled: !settings.reducedMotion && !settings.staticHomeScreen,
  });
  const initialFocusedIndex = useMemo(() => {
    if (typeof window === "undefined") {
      return 0;
    }

    const savedCardId = window.localStorage.getItem(homeFocusedCardStorageKey);
    if (!savedCardId) {
      return 0;
    }

    const savedIndex = cards.findIndex((card) => card.id === savedCardId);
    return savedIndex >= 0 ? savedIndex : 0;
  }, [cards]);
  const persistFocusedIndex = useCallback(
    (index: number) => {
      const card = cards[index];
      if (!card || typeof window === "undefined") {
        return;
      }

      if (persistFocusFrameRef.current) {
        window.cancelAnimationFrame(persistFocusFrameRef.current);
      }

      persistFocusFrameRef.current = window.requestAnimationFrame(() => {
        persistFocusFrameRef.current = 0;
        window.localStorage.setItem(homeFocusedCardStorageKey, card.id);
      });
    },
    [cards],
  );
  const orbit = useOrbitPhysics({
    cards,
    initialFocusedIndex,
    onFocusedIndexChange: persistFocusedIndex,
    reducedMotion: settings.reducedMotion,
    scale: sceneScale,
    staticHomeScreen: staticHome,
    visible,
  });
  const statusCopy = getHomeStatusCopy(deckState);
  const controlsPortal = typeof document === "undefined" ? null : document.body;
  const focusedCard = cards[orbit.focusedIndex] ?? cards[0];
  const renderOrbitCards = () =>
    cards.map((card, index) => {
      return (
        <OrbitCard
          card={card}
          cardRef={orbit.registerCardElement(card.id)}
          focused={focusedCard?.id === card.id}
          index={index}
          key={card.id}
          onClick={() => handleCardClick(card, index)}
          reducedMotion={settings.reducedMotion}
          total={cards.length}
        />
      );
    });

  useEffect(() => {
    return () => {
      if (persistFocusFrameRef.current) {
        window.cancelAnimationFrame(persistFocusFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!focusedCard || cards.length <= 0 || typeof window === "undefined") {
      return;
    }

    const preloadVisibleRoutes = () => {
      const routeIndexes = new Set([
        orbit.focusedIndex,
        (orbit.focusedIndex + 1) % cards.length,
        (orbit.focusedIndex - 1 + cards.length) % cards.length,
      ]);

      for (const index of routeIndexes) {
        const route = cards[index]?.route;
        if (route) {
          preloadAppRoute(route);
        }
      }
    };

    if (typeof window.requestIdleCallback === "function") {
      const idleHandle = window.requestIdleCallback(preloadVisibleRoutes, {
        timeout: 700,
      });
      return () => window.cancelIdleCallback(idleHandle);
    }

    const timer = window.setTimeout(preloadVisibleRoutes, 180);
    return () => window.clearTimeout(timer);
  }, [cards, focusedCard, orbit.focusedIndex]);

  function openCard(card: HomeHologramCard) {
    orbit.beginRouteOpening();
    orbit.setQuickActionCardId(null);
    markIntroPlayed();
    navigate(card.route);
  }

  function handleCardClick(card: HomeHologramCard, index: number) {
    if (orbit.isClickSuppressed()) {
      return;
    }

    if (focusedCard?.id === card.id) {
      openCard(card);
      return;
    }

    orbit.focusIndex(index);
  }

  function handleSceneClickCapture(event: MouseEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    const protectedAction = target.closest<HTMLElement>(
      ".home-core-status__actions a, .home-quick-actions button",
    );
    if (protectedAction) {
      return;
    }

    const directCardElement = target.closest<HTMLElement>(".home-orbit-card");
    const directCardId = directCardElement?.dataset.cardId;
    const directIndex = directCardId
      ? cards.findIndex((card) => card.id === directCardId)
      : -1;
    const tappedIndex = directIndex >= 0
      ? directIndex
      : orbit.getCardIndexAtPoint(event);
    if (tappedIndex === null) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const tappedCard = cards[tappedIndex];
    if (!tappedCard || orbit.isClickSuppressed()) {
      return;
    }

    if (focusedCard?.id === tappedCard.id) {
      openCard(tappedCard);
      return;
    }

    orbit.focusIndex(tappedIndex);
  }

  function handleScenePointerDown(event: PointerEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    const cardElement = target.closest<HTMLElement>(".home-orbit-card");
    const protectedAction = target.closest<HTMLElement>(
      ".home-core-status__actions a, .home-quick-actions button",
    );
    if (!cardElement && protectedAction) {
      return;
    }

    orbit.beginPointerDrag(event, cardElement?.dataset.cardId);
  }

  function closeCustomizer() {
    setCustomizerOpen(false);
    window.requestAnimationFrame(() => {
      gearButtonRef.current?.focus();
    });
  }

  async function saveMenuOrder(
    nextOrderIds: string[],
    nextHiddenIds: string[],
  ) {
    await onSaveMenuOrder(nextOrderIds, nextHiddenIds);
    closeCustomizer();
  }

  const sceneClassName = [
    "home-hologram-scene",
    staticHome ? "nexus-orbit--static home-hologram-scene--static" : "",
    `home-hologram-scene--intro-${introMode}`,
    settings.reducedMotion ? "home-hologram-scene--reduced" : "",
    orbit.dragging || orbit.settling ? "home-hologram-scene--interacting" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="home-screen home-screen--hologram">
      {controlsPortal
        ? createPortal(
            <>
              <button
                aria-label="Customize Home menu"
                className="home-menu-gear"
                onClick={() => setCustomizerOpen(true)}
                ref={gearButtonRef}
                title="Customize Home menu"
                type="button"
              >
                <AppIcon name="settings" />
              </button>

              {customizerOpen ? (
                <HomeMenuCustomizationOverlay
                  hiddenItemIds={hiddenItemIds}
                  items={menuItems}
                  onCancel={closeCustomizer}
                  onSave={saveMenuOrder}
                />
              ) : null}
            </>,
            controlsPortal,
          )
        : null}

      <section
        aria-label="Deck Nexus holographic command hub"
        className={sceneClassName}
        data-high-contrast={settings.highContrast}
        data-intro={introMode}
        data-orbit-system="chamber"
        data-performance={settings.homePerformanceMode}
        data-reduced-motion={settings.reducedMotion}
        data-testid="home-hologram-scene"
        ref={registerParallaxSurface}
        onKeyDown={(event) =>
          orbit.handleKeyDown(event, () => {
            const activationCard = cards[orbit.getActivationIndex()] ??
              focusedCard;
            if (activationCard) {
              openCard(activationCard);
            }
          })
        }
        onClickCapture={handleSceneClickCapture}
        onPointerCancel={(event) => orbit.endPointerDrag(event)}
        onPointerDown={handleScenePointerDown}
        onPointerMove={(event) => orbit.movePointerDrag(event)}
        onPointerUp={(event) => orbit.endPointerDrag(event)}
        onWheel={orbit.handleWheel}
        style={
          {
            "--home-scene-scale": sceneScale.sceneScale,
            "--home-card-width": `${sceneScale.cardWidth}px`,
            "--home-card-height": `${sceneScale.cardHeight}px`,
            "--home-orbit-center-y": `${sceneScale.centerY}px`,
            "--home-orbit-radius-x": `${sceneScale.radiusX}px`,
            "--home-orbit-radius-z": `${sceneScale.radiusZ}px`,
            "--home-upper-ring-scale": sceneScale.upperRingScale,
            "--home-lower-ring-scale": sceneScale.lowerRingScale,
            "--home-beam-width": `${sceneScale.beamWidth}px`,
            "--home-parallax-x": 0,
            "--home-parallax-y": 0,
            "--home-glow-intensity": settings.glowIntensity,
          } as CSSProperties
        }
        tabIndex={0}
      >
        <img
          alt=""
          aria-hidden="true"
          className="home-reference-layer"
          decoding="async"
          loading="eager"
          src={homeReferenceImage}
        />
        <div className="cosmic-void-layer" aria-hidden="true" />
        <div className="distant-nebula-layer" aria-hidden="true" />
        <HologramParticlesCanvas
          performanceMode={settings.homePerformanceMode}
          reducedMotion={settings.reducedMotion}
          visible={visible}
        />
        <div className="rear-mist-layer" aria-hidden="true" />

        <UpperProjectionAssembly />
        <CentralBeamAssembly />

        <div className="orbit-path" aria-hidden="true" />
        <div className="rear-orbit-fog" aria-hidden="true" />

        <div
          className="orbit-stage orbit-stage--continuous"
          data-initial-rotation={getRotationForIndex(initialFocusedIndex, cards.length)}
          data-testid="orbit-layer-active"
        >
          {renderOrbitCards()}
        </div>

        <CentralCrystalAssembly
          active={orbit.dragging || orbit.settling}
        />

        <div className="home-core-status" aria-live="polite">
          <h1>{statusCopy.title}</h1>
          <p>{statusCopy.detail}</p>
          <small>{statusCopy.status}</small>
          {!deckState.hasDecks ? (
            <div className="home-core-status__actions">
              <Link onClick={markIntroPlayed} to="/create">
                <AppIcon name="sparkles" />
                Create Deck
              </Link>
              <Link onClick={markIntroPlayed} to="/import">
                <AppIcon name="import" />
                Import Deck
              </Link>
            </div>
          ) : null}
        </div>

        <LowerProjectionAssembly />
        <div className="foreground-mist-layer" aria-hidden="true" />
        <div className="interaction-glow-layer" aria-hidden="true" />

        {orbit.quickActionCardId ? (
          <div className="home-quick-actions" role="menu">
            {(() => {
              const quickCard = cards.find(
                (card) => card.id === orbit.quickActionCardId,
              );
              if (!quickCard) {
                return null;
              }

              const quickIndex = cards.findIndex(
                (card) => card.id === quickCard.id,
              );

              return (
                <>
                  <strong>{quickCard.label}</strong>
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => openCard(quickCard)}
                  >
                    Open
                  </button>
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      orbit.focusIndex(quickIndex);
                      orbit.setQuickActionCardId(null);
                    }}
                  >
                    Focus
                  </button>
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => onMoveCard(quickCard.id, -1)}
                  >
                    Move earlier
                  </button>
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => onMoveCard(quickCard.id, 1)}
                  >
                    Move later
                  </button>
                </>
              );
            })()}
          </div>
        ) : null}

        <div className="sr-only" aria-live="polite">
          {focusedCard
            ? `${focusedCard.label} selected, ${orbit.focusedIndex + 1} of ${
                cards.length
              }.`
            : "Command orbit ready"}
        </div>
      </section>

      <nav
        aria-label="Home command destinations"
        className="home-screen-reader-nav"
      >
        {cards.map((card) => (
          <Link
            aria-label={card.actionLabel}
            data-testid={`screen-reader-card-${card.id}`}
            key={card.id}
            to={card.route}
          >
            {card.label}
          </Link>
        ))}
      </nav>

    </div>
  );
}
