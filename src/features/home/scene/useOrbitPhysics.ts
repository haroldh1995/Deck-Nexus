import {
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type WheelEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  applyOrbitFriction,
  calculateMagneticSettleStep,
  calculateOrbitTransforms,
  calculateTapTargetStep,
  getPositionSelectedOrbitIndex,
  getPointerDragIntent,
  getRotationForIndex,
  getShortestOrbitTargetRotation,
} from "./orbitMath";
import {
  orbitDragIntentThreshold,
  orbitSnapStrength,
} from "./homeSceneConstants";
import type { HomeHologramCard, ResponsiveSceneScale } from "./homeSceneTypes";

const dragDegreesPerPixel = 0.18;
const longPressDelay = 560;
const clickSuppressMilliseconds = 140;

type OrbitInteractionMode =
  | "idle"
  | "dragging"
  | "inertial"
  | "snapping"
  | "tap_targeting"
  | "route_opening"
  | "resizing"
  | "reduced_motion";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export interface OrbitPhysicsOptions {
  cards: readonly HomeHologramCard[];
  initialFocusedIndex?: number;
  onFocusedIndexChange?: (index: number) => void;
  reducedMotion: boolean;
  scale: ResponsiveSceneScale;
  staticHomeScreen: boolean;
  visible: boolean;
}

export function useOrbitPhysics({
  cards,
  initialFocusedIndex = 0,
  onFocusedIndexChange,
  reducedMotion,
  scale,
  staticHomeScreen,
  visible,
}: OrbitPhysicsOptions) {
  const itemCount = cards.length;
  const initialIndex =
    itemCount <= 0
      ? 0
      : ((initialFocusedIndex % itemCount) + itemCount) % itemCount;
  const initialRotation = getRotationForIndex(initialIndex, itemCount);
  const [focusedIndex, setFocusedIndex] = useState(initialIndex);
  const [dragging, setDragging] = useState(false);
  const [settling, setSettling] = useState(false);
  const [quickActionCardId, setQuickActionCardId] = useState<string | null>(
    null,
  );

  const cardsRef = useRef(cards);
  const scaleRef = useRef(scale);
  const cardElementsRef = useRef(new Map<string, HTMLButtonElement>());
  const lastTransformsRef = useRef<ReturnType<typeof calculateOrbitTransforms>>(
    [],
  );
  const rotationRef = useRef(initialRotation);
  const velocityRef = useRef(0);
  const focusedIndexRef = useRef(initialIndex);
  const focusedIdRef = useRef(cards[initialIndex]?.id ?? "");
  const interactionModeRef = useRef<OrbitInteractionMode>(
    reducedMotion ? "reduced_motion" : "idle",
  );
  const draggingRef = useRef(false);
  const dragIntentActiveRef = useRef(false);
  const settlingRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const lastXRef = useRef(0);
  const lastMoveTimeRef = useRef(0);
  const activePointerIdRef = useRef<number | null>(null);
  const suppressClickUntilRef = useRef(0);
  const longPressTimerRef = useRef<number | null>(null);
  const onFocusedIndexChangeRef = useRef(onFocusedIndexChange);
  const settleTargetIndexRef = useRef<number | null>(null);
  const tapTargetIndexRef = useRef<number | null>(null);
  const tapTargetRotationRef = useRef<number | null>(null);

  useEffect(() => {
    onFocusedIndexChangeRef.current = onFocusedIndexChange;
  }, [onFocusedIndexChange]);

  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    if (reducedMotion && interactionModeRef.current !== "dragging") {
      interactionModeRef.current = "reduced_motion";
    } else if (!reducedMotion && interactionModeRef.current === "reduced_motion") {
      interactionModeRef.current = "idle";
    }
  }, [reducedMotion]);

  const setDraggingState = useCallback((nextDragging: boolean) => {
    if (draggingRef.current === nextDragging) {
      return;
    }

    draggingRef.current = nextDragging;
    setDragging(nextDragging);
  }, []);

  const setSettlingState = useCallback((nextSettling: boolean) => {
    if (settlingRef.current === nextSettling) {
      return;
    }

    settlingRef.current = nextSettling;
    setSettling(nextSettling);
  }, []);

  const applyTransforms = useCallback((rotation: number) => {
    const nextCards = cardsRef.current;
    const nextScale = scaleRef.current;
    if (nextCards.length === 0) {
      return;
    }

    const transforms = calculateOrbitTransforms({
      cards: nextCards,
      rotation,
      scale: nextScale,
    });
    lastTransformsRef.current = transforms;

    for (const transform of transforms) {
      const element = cardElementsRef.current.get(transform.id);
      if (!element) {
        continue;
      }

      const selectedFrontCard =
        transform.id === focusedIdRef.current && transform.frontness > 0.62;
      const zIndex = selectedFrontCard
        ? Math.max(transform.zIndex, 112)
        : transform.zIndex;
      const cardLayerOpacity = 1;

      element.style.transform = `translate3d(calc(-50% + ${transform.x}px), ${transform.y}px, ${transform.z}px) rotateY(${transform.rotationY}deg) rotateX(${transform.rotationX}deg) scale(${transform.scale})`;
      element.style.zIndex = String(zIndex);
      element.style.opacity = String(cardLayerOpacity);
      element.style.pointerEvents = transform.frontness > 0.16 ||
        transform.id === focusedIdRef.current ||
        transform.id === cardsRef.current[tapTargetIndexRef.current ?? -1]?.id
        ? "auto"
        : "none";
      element.style.setProperty("--card-glow", String(transform.glow));
      element.style.setProperty("--card-opacity", String(cardLayerOpacity));
      element.style.setProperty("--card-depth-opacity", String(transform.opacity));
      element.style.setProperty("--card-presence", String(transform.frontness));
      element.dataset.depth = transform.rear ? "rear" : "front";
      element.dataset.cardLayer = transform.rear
        ? "rear-orbit-cards"
        : "front-orbit-cards";
      element.dataset.interactive = element.style.pointerEvents === "auto"
        ? "true"
        : "false";
      element.classList.toggle("is-rear", transform.rear);
      element.classList.toggle("is-near-front", transform.frontness > 0.54);
      element.classList.toggle("is-front-candidate", transform.frontness > 0.78);
      element.classList.toggle(
        "is-tap-target",
        transform.id === cardsRef.current[tapTargetIndexRef.current ?? -1]?.id,
      );
    }
  }, []);

  const commitFocusedIndex = useCallback(
    (nextIndex: number, notify = true) => {
      const count = cardsRef.current.length;
      if (count <= 0) {
        return 0;
      }

      const normalizedIndex = ((nextIndex % count) + count) % count;
      if (normalizedIndex === focusedIndexRef.current) {
        return normalizedIndex;
      }

      focusedIndexRef.current = normalizedIndex;
      focusedIdRef.current = cardsRef.current[normalizedIndex]?.id ?? "";
      setFocusedIndex(normalizedIndex);
      if (notify) {
        onFocusedIndexChangeRef.current?.(normalizedIndex);
      }

      return normalizedIndex;
    },
    [],
  );

  const commitPositionSelectedIndex = useCallback(
    (rotation: number) => {
      commitFocusedIndex(
        getPositionSelectedOrbitIndex({
          currentIndex: focusedIndexRef.current,
          itemCount: cardsRef.current.length,
          rotation,
        }),
      );
    },
    [commitFocusedIndex],
  );

  const registerCardElement = useCallback(
    (cardId: string) => (element: HTMLButtonElement | null) => {
      if (element) {
        cardElementsRef.current.set(cardId, element);
        applyTransforms(rotationRef.current);
      } else {
        cardElementsRef.current.delete(cardId);
      }
    },
    [applyTransforms],
  );

  const focusIndex = useCallback(
    (nextIndex: number) => {
      const count = cardsRef.current.length;
      if (count <= 0) {
        return;
      }

      const normalizedIndex = ((nextIndex % count) + count) % count;
      const targetBaseRotation = getRotationForIndex(normalizedIndex, count);
      const nextRotation = getShortestOrbitTargetRotation({
        currentRotation: rotationRef.current,
        targetRotation: targetBaseRotation,
      });
      velocityRef.current = 0;
      settleTargetIndexRef.current = null;

      if (staticHomeScreen || reducedMotion) {
        rotationRef.current = nextRotation;
        tapTargetIndexRef.current = null;
        tapTargetRotationRef.current = null;
        interactionModeRef.current = reducedMotion
          ? "reduced_motion"
          : "idle";
        commitFocusedIndex(normalizedIndex);
        settleTargetIndexRef.current = null;
        setSettlingState(false);
        applyTransforms(nextRotation);
        return;
      }

      tapTargetIndexRef.current = normalizedIndex;
      tapTargetRotationRef.current = nextRotation;
      interactionModeRef.current = "tap_targeting";
      setSettlingState(true);
      applyTransforms(rotationRef.current);
    },
    [
      applyTransforms,
      commitFocusedIndex,
      reducedMotion,
      setSettlingState,
      staticHomeScreen,
    ],
  );

  const rotateFocus = useCallback(
    (direction: -1 | 1) => {
      focusIndex((tapTargetIndexRef.current ?? focusedIndexRef.current) + direction);
    },
    [focusIndex],
  );

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const beginPointerDrag = useCallback(
    (event: PointerEvent<HTMLElement>, cardId?: string) => {
      activePointerIdRef.current = event.pointerId;
      event.currentTarget.setPointerCapture?.(event.pointerId);

      if (staticHomeScreen) {
        if (cardId) {
          cancelLongPress();
          longPressTimerRef.current = window.setTimeout(() => {
            setQuickActionCardId(cardId);
            longPressTimerRef.current = null;
          }, longPressDelay);
        }
        return;
      }

      dragIntentActiveRef.current = false;
      setDraggingState(false);
      setSettlingState(false);
      tapTargetIndexRef.current = null;
      tapTargetRotationRef.current = null;
      interactionModeRef.current = "idle";
      startXRef.current = event.clientX;
      startYRef.current = event.clientY;
      lastXRef.current = event.clientX;
      lastMoveTimeRef.current = performance.now();
      velocityRef.current = 0;
      settleTargetIndexRef.current = null;
      cancelLongPress();

      if (cardId) {
        longPressTimerRef.current = window.setTimeout(() => {
          setQuickActionCardId(cardId);
          longPressTimerRef.current = null;
        }, longPressDelay);
      }
    },
    [cancelLongPress, setDraggingState, setSettlingState, staticHomeScreen],
  );

  const movePointerDrag = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (staticHomeScreen || cardsRef.current.length <= 0) {
        return;
      }
      if (activePointerIdRef.current !== event.pointerId) {
        return;
      }

      const intent = getPointerDragIntent({
        currentX: event.clientX,
        currentY: event.clientY,
        startX: startXRef.current,
        startY: startYRef.current,
        threshold: orbitDragIntentThreshold,
      });

      if (!dragIntentActiveRef.current && intent === "tap") {
        return;
      }

      if (!dragIntentActiveRef.current) {
        dragIntentActiveRef.current = true;
        setDraggingState(true);
        interactionModeRef.current = "dragging";
        tapTargetIndexRef.current = null;
        tapTargetRotationRef.current = null;
        cancelLongPress();
      }

      event.preventDefault();
      const now = performance.now();
      const dx = event.clientX - lastXRef.current;
      const dt = Math.max(now - lastMoveTimeRef.current, 8);
      const nextVelocity = clamp((dx * dragDegreesPerPixel) / dt, -0.9, 0.9);
      const nextRotation = rotationRef.current + dx * dragDegreesPerPixel;

      lastXRef.current = event.clientX;
      lastMoveTimeRef.current = now;
      rotationRef.current = nextRotation;
      velocityRef.current = reducedMotion ? 0 : nextVelocity;
      applyTransforms(nextRotation);
      commitPositionSelectedIndex(nextRotation);
    },
    [
      applyTransforms,
      cancelLongPress,
      commitPositionSelectedIndex,
      reducedMotion,
      setDraggingState,
      staticHomeScreen,
    ],
  );

  const endPointerDrag = useCallback(
    (event?: PointerEvent<HTMLElement>) => {
      if (
        event &&
        activePointerIdRef.current !== null &&
        activePointerIdRef.current !== event.pointerId
      ) {
        return;
      }

      cancelLongPress();
      event?.currentTarget.releasePointerCapture?.(event.pointerId);
      const hadActivePointer = activePointerIdRef.current !== null;
      activePointerIdRef.current = null;

      if (!hadActivePointer) {
        return;
      }

      if (dragIntentActiveRef.current) {
        suppressClickUntilRef.current = performance.now() +
          clickSuppressMilliseconds;
      }

      dragIntentActiveRef.current = false;
      setDraggingState(false);
      if (!staticHomeScreen) {
        interactionModeRef.current =
          Math.abs(velocityRef.current) > 0.002 && !reducedMotion
            ? "inertial"
            : "snapping";
        setSettlingState(true);
      }
    },
    [
      cancelLongPress,
      reducedMotion,
      setDraggingState,
      setSettlingState,
      staticHomeScreen,
    ],
  );

  const isClickSuppressed = useCallback(
    () => performance.now() < suppressClickUntilRef.current,
    [],
  );

  const getCardIndexAtPoint = useCallback((event: MouseEvent<HTMLElement>) => {
    const candidates = lastTransformsRef.current
      .map((transform, index) => {
        if (transform.frontness <= 0.16) {
          return null;
        }

        const element = cardElementsRef.current.get(transform.id);
        if (!element) {
          return null;
        }

        const rect = element.getBoundingClientRect();
        if (rect.width <= 1 || rect.height <= 1) {
          return null;
        }

        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const xDistance = Math.abs(event.clientX - centerX) /
          Math.max(rect.width / 2, 1);
        const yDistance = Math.abs(event.clientY - centerY) /
          Math.max(rect.height / 2, 1);

        if (xDistance > 1.08 || yDistance > 1.08) {
          return null;
        }

        return {
          index,
          score: Math.hypot(xDistance, yDistance) - transform.frontness * 0.18,
          zIndex: transform.zIndex,
        };
      })
      .filter((candidate): candidate is {
        index: number;
        score: number;
        zIndex: number;
      } => Boolean(candidate));

    candidates.sort((a, b) => a.score - b.score || b.zIndex - a.zIndex);
    return candidates[0]?.index ?? null;
  }, []);

  const beginRouteOpening = useCallback(() => {
    velocityRef.current = 0;
    tapTargetIndexRef.current = null;
    tapTargetRotationRef.current = null;
    settleTargetIndexRef.current = null;
    interactionModeRef.current = "route_opening";
    setSettlingState(false);
  }, [setSettlingState]);

  const getActivationIndex = useCallback(
    () => tapTargetIndexRef.current ?? focusedIndexRef.current,
    [],
  );

  const handleWheel = useCallback(
    (event: WheelEvent<HTMLElement>) => {
      if (staticHomeScreen || reducedMotion) {
        return;
      }

      const horizontalIntent =
        Math.abs(event.deltaX) > Math.abs(event.deltaY) || event.shiftKey;
      if (!horizontalIntent) {
        return;
      }

      event.preventDefault();
      cancelLongPress();

      const delta = event.deltaX || event.deltaY;
      const nextRotation = rotationRef.current - delta * 0.08;
      rotationRef.current = nextRotation;
      velocityRef.current = clamp(-delta * 0.0025, -0.68, 0.68);
      settleTargetIndexRef.current = null;
      tapTargetIndexRef.current = null;
      tapTargetRotationRef.current = null;
      interactionModeRef.current = "inertial";
      applyTransforms(nextRotation);
      commitPositionSelectedIndex(nextRotation);
      setSettlingState(true);
    },
    [
      applyTransforms,
      cancelLongPress,
      commitPositionSelectedIndex,
      reducedMotion,
      setSettlingState,
      staticHomeScreen,
    ],
  );

  const handleKeyDown = useCallback(
    (
      event: KeyboardEvent<HTMLElement>,
      openFocused: () => void,
      closeOverlay?: () => void,
    ) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        rotateFocus(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        rotateFocus(1);
      } else if (event.key === "Home") {
        event.preventDefault();
        focusIndex(0);
      } else if (event.key === "End") {
        event.preventDefault();
        focusIndex(cardsRef.current.length - 1);
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openFocused();
      } else if (event.key === "Escape") {
        setQuickActionCardId(null);
        closeOverlay?.();
      }
    },
    [focusIndex, rotateFocus],
  );

  useLayoutEffect(() => {
    if (cards.length <= 0) {
      return;
    }

    const focusedId = focusedIdRef.current;
    const nextIndex = focusedId
      ? cards.findIndex((card) => card.id === focusedId)
      : focusedIndexRef.current;
    const normalizedIndex = nextIndex >= 0
      ? nextIndex
      : Math.min(focusedIndexRef.current, cards.length - 1);

    focusedIndexRef.current = normalizedIndex;
    focusedIdRef.current = cards[normalizedIndex]?.id ?? "";
    setFocusedIndex(normalizedIndex);
    rotationRef.current = getRotationForIndex(normalizedIndex, cards.length);
    velocityRef.current = 0;
    settleTargetIndexRef.current = null;
    tapTargetIndexRef.current = null;
    tapTargetRotationRef.current = null;
    interactionModeRef.current = "resizing";
    applyTransforms(rotationRef.current);
    interactionModeRef.current = reducedMotion ? "reduced_motion" : "idle";
  }, [applyTransforms, cards, reducedMotion]);

  useLayoutEffect(() => {
    applyTransforms(rotationRef.current);
  }, [applyTransforms, scale]);

  useEffect(() => {
    let frame = 0;
    let previousTime = performance.now();

    function tick(now: number) {
      const dt = Math.min(now - previousTime, 34);
      previousTime = now;

      if (visible && !staticHomeScreen && cardsRef.current.length > 0) {
        const currentVelocity = velocityRef.current;
        let nextRotation = rotationRef.current;
        let nextVelocity = currentVelocity;
        let didUpdateTransform = false;

        if (!dragIntentActiveRef.current) {
          if (
            interactionModeRef.current === "tap_targeting" &&
            tapTargetIndexRef.current !== null &&
            tapTargetRotationRef.current !== null
          ) {
            const targetIndex = tapTargetIndexRef.current;
            const targetRotation = tapTargetRotationRef.current;
            const targetStep = calculateTapTargetStep({
              currentRotation: nextRotation,
              deltaMilliseconds: dt,
              reducedMotion,
              targetRotation,
            });

            nextRotation = targetStep.settled
              ? targetRotation
              : targetStep.nextRotation;
            nextVelocity = 0;
            didUpdateTransform = true;
            commitPositionSelectedIndex(nextRotation);

            if (targetStep.settled) {
              commitFocusedIndex(targetIndex);
              tapTargetIndexRef.current = null;
              tapTargetRotationRef.current = null;
              interactionModeRef.current = reducedMotion
                ? "reduced_motion"
                : "idle";
              setSettlingState(false);
            }
          } else if (Math.abs(currentVelocity) > 0.002 && !reducedMotion) {
            interactionModeRef.current = "inertial";
            nextRotation += currentVelocity * dt;
            nextVelocity = applyOrbitFriction({
              deltaMilliseconds: dt,
              velocity: currentVelocity,
            });
            didUpdateTransform = true;
            commitPositionSelectedIndex(nextRotation);
            setSettlingState(true);
          } else if (settlingRef.current) {
            interactionModeRef.current = reducedMotion
              ? "reduced_motion"
              : "snapping";
            const nearestIndex =
              settleTargetIndexRef.current ??
              getPositionSelectedOrbitIndex({
                currentIndex: focusedIndexRef.current,
                itemCount: cardsRef.current.length,
                rotation: nextRotation,
              });
            const targetRotation = getRotationForIndex(
              nearestIndex,
              cardsRef.current.length,
            );
            const settleStep = calculateMagneticSettleStep({
              currentRotation: nextRotation,
              strength: reducedMotion ? 0.42 : orbitSnapStrength,
              targetRotation,
            });
            nextRotation = settleStep.nextRotation;
            nextVelocity = 0;
            didUpdateTransform = true;
            commitPositionSelectedIndex(nextRotation);

            if (settleStep.settled) {
              nextRotation = targetRotation;
              settleTargetIndexRef.current = null;
              commitFocusedIndex(nearestIndex);
              interactionModeRef.current = reducedMotion
                ? "reduced_motion"
                : "idle";
              setSettlingState(false);
            }
          } else if (!reducedMotion) {
            interactionModeRef.current = "idle";
          }
        }

        if (didUpdateTransform) {
          rotationRef.current = nextRotation;
          velocityRef.current = nextVelocity;
          applyTransforms(nextRotation);
        }
      }

      frame = window.requestAnimationFrame(tick);
    }

    frame = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [
    applyTransforms,
    commitPositionSelectedIndex,
    commitFocusedIndex,
    reducedMotion,
    setSettlingState,
    staticHomeScreen,
    visible,
  ]);

  useEffect(() => cancelLongPress, [cancelLongPress]);

  return {
    focusedIndex,
    dragging,
    settling,
    quickActionCardId,
    setQuickActionCardId,
    registerCardElement,
    focusIndex,
    rotateFocus,
    beginPointerDrag,
    movePointerDrag,
    endPointerDrag,
    isClickSuppressed,
    getCardIndexAtPoint,
    getActivationIndex,
    beginRouteOpening,
    handleWheel,
    handleKeyDown,
  };
}
