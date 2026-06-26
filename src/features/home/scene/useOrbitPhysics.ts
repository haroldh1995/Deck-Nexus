import {
  type KeyboardEvent,
  type PointerEvent,
  type WheelEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  getNearestOrbitIndex,
  getRotationForIndex,
  normalizeAngle,
  shortestAngleDistance,
} from "./orbitMath";
import { orbitSnapStrength } from "./homeSceneConstants";

const dragDegreesPerPixel = 0.18;
const idleDegreesPerMillisecond = 0.0011;
const dragIntentThreshold = 7;
const longPressDelay = 560;

export interface OrbitPhysicsOptions {
  itemCount: number;
  reducedMotion: boolean;
  staticHomeScreen: boolean;
  visible: boolean;
}

export function useOrbitPhysics({
  itemCount,
  reducedMotion,
  staticHomeScreen,
  visible,
}: OrbitPhysicsOptions) {
  const [rotation, setRotation] = useState(0);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [settling, setSettling] = useState(false);
  const [velocity, setVelocity] = useState(0);
  const [distortedIds, setDistortedIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [quickActionCardId, setQuickActionCardId] = useState<string | null>(
    null,
  );

  const rotationRef = useRef(rotation);
  const velocityRef = useRef(velocity);
  const focusedIndexRef = useRef(focusedIndex);
  const draggingRef = useRef(false);
  const settlingRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const lastXRef = useRef(0);
  const lastMoveTimeRef = useRef(0);
  const lastVisualCommitRef = useRef(0);
  const suppressClickRef = useRef(false);
  const longPressTimerRef = useRef<number | null>(null);

  useEffect(() => {
    rotationRef.current = rotation;
  }, [rotation]);

  useEffect(() => {
    velocityRef.current = velocity;
  }, [velocity]);

  useEffect(() => {
    focusedIndexRef.current = focusedIndex;
  }, [focusedIndex]);

  useEffect(() => {
    settlingRef.current = settling;
  }, [settling]);

  const focusedRotation = useMemo(
    () => getRotationForIndex(focusedIndex, itemCount),
    [focusedIndex, itemCount],
  );

  const focusIndex = useCallback(
    (nextIndex: number) => {
      if (itemCount <= 0) {
        return;
      }

      const normalizedIndex = ((nextIndex % itemCount) + itemCount) %
        itemCount;
      const nextRotation = getRotationForIndex(normalizedIndex, itemCount);
      focusedIndexRef.current = normalizedIndex;
      rotationRef.current = nextRotation;
      velocityRef.current = 0;
      settlingRef.current = false;
      setFocusedIndex(normalizedIndex);
      setRotation(nextRotation);
      setVelocity(0);
      setSettling(false);
    },
    [itemCount],
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

  const clearDistortion = useCallback(() => {
    setDistortedIds((current) => (current.size === 0 ? current : new Set()));
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
      draggingRef.current = false;
      setDragging(false);
      settlingRef.current = false;
      setSettling(false);
      startXRef.current = event.clientX;
      startYRef.current = event.clientY;
      lastXRef.current = event.clientX;
      lastMoveTimeRef.current = performance.now();
      velocityRef.current = 0;
      setVelocity(0);
      cancelLongPress();

      if (cardId) {
        longPressTimerRef.current = window.setTimeout(() => {
          setQuickActionCardId(cardId);
          longPressTimerRef.current = null;
        }, longPressDelay);
      }
    },
    [cancelLongPress, staticHomeScreen],
  );

  const movePointerDrag = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (staticHomeScreen) {
        return;
      }

      const dxFromStart = event.clientX - startXRef.current;
      const dyFromStart = event.clientY - startYRef.current;
      const distance = Math.hypot(dxFromStart, dyFromStart);

      if (!draggingRef.current && distance < dragIntentThreshold) {
        return;
      }

      if (!draggingRef.current) {
        draggingRef.current = true;
        setDragging(true);
        cancelLongPress();
      }

      event.preventDefault();
      const now = performance.now();
      const dx = event.clientX - lastXRef.current;
      const dt = Math.max(now - lastMoveTimeRef.current, 8);
      const nextVelocity = (dx * dragDegreesPerPixel) / dt;
      const nextRotation = rotationRef.current + dx * dragDegreesPerPixel;

      lastXRef.current = event.clientX;
      lastMoveTimeRef.current = now;
      rotationRef.current = nextRotation;
      velocityRef.current = nextVelocity;
      setRotation(nextRotation);
      setVelocity(nextVelocity);
      setFocusedIndex(getNearestOrbitIndex(nextRotation, itemCount));
    },
    [cancelLongPress, itemCount, staticHomeScreen],
  );

  const endPointerDrag = useCallback(
    (event?: PointerEvent<HTMLElement>) => {
      cancelLongPress();
      event?.currentTarget.releasePointerCapture?.(event.pointerId);

      if (draggingRef.current) {
        suppressClickRef.current = true;
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 120);
      }

      draggingRef.current = false;
      setDragging(false);
      settlingRef.current = true;
      setSettling(true);
    },
    [cancelLongPress],
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
      velocityRef.current = -delta * 0.0025;
      setRotation(nextRotation);
      setVelocity(velocityRef.current);
      setFocusedIndex(getNearestOrbitIndex(nextRotation, itemCount));
      settlingRef.current = true;
      setSettling(true);
    },
    [cancelLongPress, itemCount, reducedMotion, staticHomeScreen],
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
      } else if (event.key === "Enter") {
        event.preventDefault();
        openFocused();
      } else if (event.key === "Escape") {
        setQuickActionCardId(null);
        closeOverlay?.();
      }
    },
    [rotateFocus],
  );

  const markDistortion = useCallback((ids: Iterable<string>) => {
    const nextIds = new Set(ids);
    setDistortedIds((current) => {
      if (
        current.size === nextIds.size &&
        [...current].every((id) => nextIds.has(id))
      ) {
        return current;
      }

      return nextIds;
    });
  }, []);

  useEffect(() => {
    let frame = 0;
    let previousTime = performance.now();

    function tick(now: number) {
      const dt = Math.min(now - previousTime, 34);
      previousTime = now;

      if (visible && !staticHomeScreen) {
        const currentVelocity = velocityRef.current;
        let nextRotation = rotationRef.current;
        let nextVelocity = currentVelocity;

        if (!draggingRef.current) {
          if (Math.abs(currentVelocity) > 0.002 && !reducedMotion) {
            nextRotation += currentVelocity * dt;
            nextVelocity = currentVelocity * Math.pow(0.945, dt / 16.67);
          } else if (settlingRef.current) {
            const nearestIndex = getNearestOrbitIndex(nextRotation, itemCount);
            const targetRotation = getRotationForIndex(nearestIndex, itemCount);
            const snapDelta = shortestAngleDistance(
              normalizeAngle(nextRotation),
              normalizeAngle(targetRotation),
            );
            const snapStrength = reducedMotion ? 0.4 : orbitSnapStrength;
            nextRotation += snapDelta * snapStrength;
            nextVelocity = 0;
            focusedIndexRef.current = nearestIndex;
            setFocusedIndex(nearestIndex);

            if (Math.abs(snapDelta) < 0.1) {
              settlingRef.current = false;
              setSettling(false);
            }
          } else {
            nextRotation += reducedMotion ? 0 : idleDegreesPerMillisecond * dt;
            const nearestIndex = getNearestOrbitIndex(nextRotation, itemCount);
            if (nearestIndex !== focusedIndexRef.current) {
              focusedIndexRef.current = nearestIndex;
              setFocusedIndex(nearestIndex);
            }
          }
        }

        rotationRef.current = nextRotation;
        velocityRef.current = nextVelocity;
        const interactiveMotion =
          draggingRef.current ||
          Math.abs(nextVelocity) > 0.002 ||
          settlingRef.current;
        const commitInterval = interactiveMotion ? 16 : 1800;
        const shouldCommit = now - lastVisualCommitRef.current >=
          commitInterval;

        if (shouldCommit) {
          lastVisualCommitRef.current = now;
          setRotation(nextRotation);
          setVelocity(nextVelocity);
        }

        if (Math.abs(nextVelocity) > 0.002) {
          settlingRef.current = true;
          setSettling(true);
        }
      }

      frame = window.requestAnimationFrame(tick);
    }

    frame = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [itemCount, reducedMotion, staticHomeScreen, visible]);

  useEffect(() => cancelLongPress, [cancelLongPress]);

  return {
    rotation,
    focusedIndex,
    focusedRotation,
    dragging,
    settling,
    velocity,
    distortedIds,
    quickActionCardId,
    setQuickActionCardId,
    focusIndex,
    rotateFocus,
    beginPointerDrag,
    movePointerDrag,
    endPointerDrag,
    isClickSuppressed,
    handleWheel,
    handleKeyDown,
    markDistortion,
    clearDistortion,
  };
}
