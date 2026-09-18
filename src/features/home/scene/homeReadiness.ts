import { useLayoutEffect, useState, type RefObject } from "react";
import { primeStaticImages } from "../../../app/imageReadiness";
import { criticalHomeAssets } from "../../../app/staticAssets";
import type { HomeHologramCard } from "./homeSceneTypes";

export const homeCardRequiredSelectors = Object.freeze([
  ".home-orbit-card__surface",
  ".home-orbit-card__icon-shell",
  ".home-orbit-card__copy strong",
  ".home-orbit-card__copy small",
  ".home-orbit-card__action",
]);

let staticPreparation: Promise<void> | null = null;
let staticPreparationComplete = false;

function waitForFonts() {
  if (typeof document === "undefined" || !document.fonts?.ready) {
    return Promise.resolve();
  }

  return document.fonts.ready.then(() => undefined);
}

function verifyCardDefinition(card: HomeHologramCard) {
  return Boolean(
    card.id &&
      card.route &&
      card.label &&
      card.subtitle &&
      card.actionLabel &&
      card.icon &&
      card.visualGlyph,
  );
}

export function verifyHomeCardManifest(cards: readonly HomeHologramCard[]) {
  return cards.length > 0 && cards.every(verifyCardDefinition);
}

export function verifyHomeCardDom(
  root: HTMLElement | null,
  cards: readonly HomeHologramCard[],
) {
  if (!root || !verifyHomeCardManifest(cards)) {
    return false;
  }

  const renderedCards = [...root.querySelectorAll<HTMLElement>(".home-orbit-card")];
  if (renderedCards.length !== cards.length) {
    return false;
  }

  return cards.every((card) => {
    const element = renderedCards.find(
      (candidate) => candidate.dataset.cardId === card.id,
    );
    return Boolean(
      element &&
        element.dataset.staticReady === "true" &&
        homeCardRequiredSelectors.every((selector) => element.querySelector(selector)),
    );
  });
}

export function prepareHomeStaticAssets() {
  if (staticPreparationComplete) {
    return Promise.resolve();
  }

  if (staticPreparation) {
    return staticPreparation;
  }

  // Unit tests assert the DOM contract directly. Browser E2E tests exercise the
  // real image/font barrier against the production build.
  if (import.meta.env.MODE === "test") {
    staticPreparationComplete = true;
    return Promise.resolve();
  }

  staticPreparation = Promise.all([
    primeStaticImages(criticalHomeAssets),
    waitForFonts(),
  ])
    .then(() => {
      staticPreparationComplete = true;
    })
    .finally(() => {
      staticPreparation = null;
    });

  return staticPreparation;
}

export function resetHomeReadinessForTests() {
  staticPreparation = null;
  staticPreparationComplete = false;
}

export function useHomeAtomicReadiness({
  cards,
  sceneRef,
}: {
  cards: readonly HomeHologramCard[];
  sceneRef: RefObject<HTMLElement | null>;
}) {
  const [ready, setReady] = useState(import.meta.env.MODE === "test");
  const [error, setError] = useState<Error | null>(null);

  useLayoutEffect(() => {
    let active = true;
    let firstFrame = 0;
    let revealFrame = 0;

    void prepareHomeStaticAssets()
      .then(() => {
        if (!active) {
          return;
        }

        firstFrame = window.requestAnimationFrame(() => {
          revealFrame = window.requestAnimationFrame(() => {
            if (!active) {
              return;
            }

            if (!verifyHomeCardDom(sceneRef.current, cards)) {
              setError(new Error("Home static card manifest is incomplete."));
              return;
            }

            setError(null);
            setReady(true);
          });
        });
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason
              : new Error("Home static assets could not be prepared."),
          );
        }
      });

    return () => {
      active = false;
      if (firstFrame) {
        window.cancelAnimationFrame(firstFrame);
      }
      if (revealFrame) {
        window.cancelAnimationFrame(revealFrame);
      }
    };
  }, [cards, sceneRef]);

  return { error, ready };
}
