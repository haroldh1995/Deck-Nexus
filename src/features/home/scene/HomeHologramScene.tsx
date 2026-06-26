import { type CSSProperties, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppIcon } from "../../../components/AppIcon";
import {
  calculateOrbitTransforms,
  getCardOverlapIntensity,
  getFocusedTransform,
} from "./orbitMath";
import { homeReferenceImage } from "./homeSceneConstants";
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
import { HomeSceneFallbackNav } from "./HomeSceneFallbackNav";
import { OrbitCard } from "./OrbitCard";
import { useHomeIntro } from "./useHomeIntro";
import { useOrbitPhysics } from "./useOrbitPhysics";
import { useResponsiveSceneScale } from "./useResponsiveSceneScale";
import { useSceneParallax } from "./useSceneParallax";
import { useSceneVisibility } from "./useSceneVisibility";

export function HomeHologramScene({
  cards,
  deckState,
  settings,
  onMoveCard,
}: {
  cards: readonly HomeHologramCard[];
  deckState: HomeSceneDeckState;
  settings: HomeSceneSettings;
  onMoveCard: (cardId: string, direction: -1 | 1) => void;
}) {
  const navigate = useNavigate();
  const sceneScale = useResponsiveSceneScale();
  const visible = useSceneVisibility();
  const staticHome = settings.staticHomeScreen || settings.reducedMotion;
  const introMode = useHomeIntro(settings.reducedMotion);
  const parallax = useSceneParallax({
    deviceTiltEnabled: settings.deviceTiltParallax,
    enabled: !settings.reducedMotion && !settings.staticHomeScreen,
  });
  const orbit = useOrbitPhysics({
    itemCount: cards.length,
    reducedMotion: settings.reducedMotion,
    staticHomeScreen: staticHome,
    visible,
  });
  const statusCopy = getHomeStatusCopy(deckState);
  const {
    clearDistortion,
    dragging,
    settling,
    markDistortion,
  } = orbit;

  const transforms = useMemo(
    () =>
      calculateOrbitTransforms({
        cards,
        rotation: orbit.rotation,
        scale: sceneScale,
      }),
    [cards, orbit.rotation, sceneScale],
  );

  const transformById = useMemo(
    () => new Map(transforms.map((transform) => [transform.id, transform])),
    [transforms],
  );

  const focusedCard = cards[orbit.focusedIndex] ?? cards[0];
  const focusedTransform = getFocusedTransform(transforms);

  useEffect(() => {
    if (!focusedTransform || (!dragging && !settling)) {
      clearDistortion();
      return;
    }

    const distortedIds = transforms
      .filter((transform) => transform.id !== focusedTransform.id)
      .filter(
        (transform) =>
          getCardOverlapIntensity(focusedTransform, transform) > 0.12,
      )
      .map((transform) => transform.id);

    markDistortion(distortedIds);
  }, [
    clearDistortion,
    dragging,
    focusedTransform,
    markDistortion,
    settling,
    transforms,
  ]);

  function openCard(card: HomeHologramCard) {
    orbit.setQuickActionCardId(null);
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
      <section
        aria-label="Deck Nexus holographic command hub"
        className={sceneClassName}
        data-high-contrast={settings.highContrast}
        data-intro={introMode}
        data-performance={settings.homePerformanceMode}
        data-reduced-motion={settings.reducedMotion}
        data-testid="home-hologram-scene"
        onKeyDown={(event) =>
          orbit.handleKeyDown(event, () => {
            if (focusedCard) {
              openCard(focusedCard);
            }
          })
        }
        onPointerCancel={(event) => orbit.endPointerDrag(event)}
        onPointerMove={(event) => orbit.movePointerDrag(event)}
        onPointerUp={(event) => orbit.endPointerDrag(event)}
        onWheel={orbit.handleWheel}
        style={
          {
            "--home-scene-scale": sceneScale.sceneScale,
            "--home-card-width": `${sceneScale.cardWidth}px`,
            "--home-card-height": `${sceneScale.cardHeight}px`,
            "--home-upper-ring-scale": sceneScale.upperRingScale,
            "--home-lower-ring-scale": sceneScale.lowerRingScale,
            "--home-beam-width": `${sceneScale.beamWidth}px`,
            "--home-parallax-x": parallax.x,
            "--home-parallax-y": parallax.y,
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

        <div className="orbit-stage">
          {cards.map((card, index) => {
            const transform = transformById.get(card.id);
            if (!transform) {
              return null;
            }

            return (
              <OrbitCard
                card={card}
                distorted={orbit.distortedIds.has(card.id)}
                focused={focusedCard?.id === card.id}
                index={index}
                key={card.id}
                onClick={() => handleCardClick(card, index)}
                onPointerDown={(event) =>
                  orbit.beginPointerDrag(event, card.id)
                }
                reducedMotion={settings.reducedMotion}
                transform={transform}
              />
            );
          })}
        </div>

        <CentralCrystalAssembly
          active={Math.abs(orbit.velocity) > 0.004}
          onResetFocus={() => orbit.focusIndex(0)}
        />

        <div className="home-core-status" aria-live="polite">
          <h1>{statusCopy.title}</h1>
          <p>{statusCopy.detail}</p>
          <small>{statusCopy.status}</small>
          {!deckState.hasDecks ? (
            <div className="home-core-status__actions">
              <Link to="/create">
                <AppIcon name="sparkles" />
                Create Deck
              </Link>
              <Link to="/import">
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
          {focusedCard ? `${focusedCard.label} focused` : "Command orbit ready"}
        </div>
      </section>

      <HomeSceneFallbackNav
        cards={cards}
        onMoveSelected={(direction) => {
          if (focusedCard) {
            onMoveCard(focusedCard.id, direction);
          }
        }}
        onSelect={(id) => {
          const index = cards.findIndex((card) => card.id === id);
          if (index >= 0) {
            orbit.focusIndex(index);
          }
        }}
        selectedId={focusedCard?.id ?? cards[0]?.id ?? ""}
        staticHomeScreen={staticHome}
      />
    </div>
  );
}
