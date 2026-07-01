import {
  type KeyboardEvent,
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
  getNearestOrbitIndex,
  getPointerDragIntent,
  getRotationForIndex,
} from "./orbitMath";
import {
  orbitDragIntentThreshold,
  orbitSnapStrength,
} from "./homeSceneConstants";
import type { HomeHologramCard, ResponsiveSceneScale } from "./homeSceneTypes";

const dragDegreesPerPixel = 0.18;
const idleDegreesPerMillisecond = 0.0011;
const longPressDelay = 560;

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
  const rotationRef = useRef(initialRotation);
  const velocityRef = useRef(0);
  const focusedIndexRef = useRef(initialIndex);
  const focusedIdRef = useRef(cards[initialIndex]?.id ?? "");
  const draggingRef = useRef(false);
  const dragIntentActiveRef = useRef(false);
  const settlingRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const lastXRef = useRef(0);
  const lastMoveTimeRef = useRef(0);
  const suppressClickRef = useRef(false);
  const longPressTimerRef = useRef<number | null>(null);
  const onFocusedIndexChangeRef = useRef(onFocusedIndexChange);
  const settleTargetIndexRef = useRef<number | null>(null);

  useEffect(() => {
    onFocusedIndexChangeRef.current = onFocusedIndexChange;
  }, [onFocusedIndexChange]);

  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

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

    for (const transform of transforms) {
      const element = cardElementsRef.current.get(transform.id);
      if (!element) {
        continue;
      }

      element.style.transform = `translate3d(calc(-50% + ${transform.x}px), ${transform.y}px, ${transform.z}px) rotateY(${transform.rotationY}deg) rotateX(${transform.rotationX}deg) scale(${transform.scale})`;
      element.style.zIndex = String(transform.zIndex);
      element.style.opacity = String(transform.opacity);
      element.style.setProperty("--card-glow", String(transform.glow));
      element.style.setProperty("--card-opacity", String(transform.opacity));
      element.style.setProperty("--card-presence", String(transform.frontness));
      element.dataset.depth = transform.rear ? "rear" : "front";
      element.classList.toggle("is-rear", transform.rear);
      element.classList.toggle("is-near-front", transform.frontness > 0.54);
      element.classList.toggle("is-front-candidate", transform.frontness > 0.78);
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
      if (cardsRef.current.length <= 0) {
        return;
      }

      const normalizedIndex = commitFocusedIndex(nextIndex);
      const nextRotation = getRotationForIndex(
        normalizedIndex,
        cardsRef.current.length,
      );
      velocityRef.current = 0;

      if (staticHomeScreen || reducedMotion) {
        rotationRef.current = nextRotation;
        settleTargetIndexRef.current = null;
        setSettlingState(false);
        applyTransforms(nextRotation);
        return;
      }

      settleTargetIndexRef.current = normalizedIndex;
      setSettlingState(true);
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
      focusIndex(focusedIndexRef.current + direction);
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

      event.currentTarget.setPointerCapture?.(event.pointerId);
      dragIntentActiveRef.current = false;
      setDraggingState(false);
      setSettlingState(false);
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
      commitFocusedIndex(
        getNearestOrbitIndex(nextRotation, cardsRef.current.length),
      );
    },
    [
      applyTransforms,
      cancelLongPress,
      commitFocusedIndex,
      reducedMotion,
      setDraggingState,
      staticHomeScreen,
    ],
  );

  const endPointerDrag = useCallback(
    (event?: PointerEvent<HTMLElement>) => {
      cancelLongPress();
      event?.currentTarget.releasePointerCapture?.(event.pointerId);

      if (dragIntentActiveRef.current) {
        suppressClickRef.current = true;
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 120);
      }

      dragIntentActiveRef.current = false;
      setDraggingState(false);
      if (!staticHomeScreen) {
        setSettlingState(true);
      }
    },
    [cancelLongPress, setDraggingState, setSettlingState, staticHomeScreen],
  );

  const isClickSuppressed = useCallback(() => suppressClickRef.current, []);

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
      applyTransforms(nextRotation);
      commitFocusedIndex(
        getNearestOrbitIndex(nextRotation, cardsRef.current.length),
      );
      setSettlingState(true);
    },
    [
      applyTransforms,
      cancelLongPress,
      commitFocusedIndex,
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
      } else if (event.key === "Enter") {
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
    applyTransforms(rotationRef.current);
  }, [applyTransforms, cards]);

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

        if (!dragIntentActiveRef.current) {
          if (Math.abs(currentVelocity) > 0.002 && !reducedMotion) {
            nextRotation += currentVelocity * dt;
            nextVelocity = applyOrbitFriction({
              deltaMilliseconds: dt,
              velocity: currentVelocity,
            });
            setSettlingState(true);
          } else if (settlingRef.current) {
            const nearestIndex =
              settleTargetIndexRef.current ??
              getNearestOrbitIndex(nextRotation, cardsRef.current.length);
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
            commitFocusedIndex(nearestIndex);

            if (settleStep.settled) {
              nextRotation = targetRotation;
              settleTargetIndexRef.current = null;
              setSettlingState(false);
            }
          } else if (!reducedMotion) {
            nextRotation += idleDegreesPerMillisecond * dt;
            const nearestIndex = getNearestOrbitIndex(
              nextRotation,
              cardsRef.current.length,
            );
            commitFocusedIndex(nearestIndex);
          }
        }

        rotationRef.current = nextRotation;
        velocityRef.current = nextVelocity;
        applyTransforms(nextRotation);
      }

      frame = window.requestAnimationFrame(tick);
    }

    frame = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [
    applyTransforms,
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
    handleWheel,
    handleKeyDown,
  };
}
