import { useEffect, useMemo, useState } from "react";

export type ViewportOrientation = "portrait" | "landscape";

export interface ViewportMetrics {
  layoutWidth: number;
  layoutHeight: number;
  visualWidth: number;
  visualHeight: number;
  orientation: ViewportOrientation;
  aspectRatio: number;
  keyboardLikelyOpen: boolean;
  standalone: boolean;
}

const defaultMetrics: ViewportMetrics = {
  layoutWidth: 390,
  layoutHeight: 844,
  visualWidth: 390,
  visualHeight: 844,
  orientation: "portrait",
  aspectRatio: 390 / 844,
  keyboardLikelyOpen: false,
  standalone: false,
};

function roughlyEqual(a: number, b: number, epsilon = 2) {
  return Math.abs(a - b) <= epsilon;
}

function getStandaloneState(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS exposes this legacy flag for home-screen PWAs.
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

export function readViewportMetrics(): ViewportMetrics {
  if (typeof window === "undefined") {
    return defaultMetrics;
  }

  const layoutWidth = Math.max(1, window.innerWidth || defaultMetrics.layoutWidth);
  const layoutHeight = Math.max(1, window.innerHeight || defaultMetrics.layoutHeight);
  const visualViewport = window.visualViewport;
  const visualWidth = Math.max(1, visualViewport?.width ?? layoutWidth);
  const visualHeight = Math.max(1, visualViewport?.height ?? layoutHeight);
  const aspectRatio = visualWidth / visualHeight;
  const orientation: ViewportOrientation =
    aspectRatio > 1.08 ? "landscape" : "portrait";

  return {
    layoutWidth,
    layoutHeight,
    visualWidth,
    visualHeight,
    orientation,
    aspectRatio,
    keyboardLikelyOpen: visualHeight < layoutHeight * 0.76,
    standalone: getStandaloneState(),
  };
}

export function metricsChanged(
  previous: ViewportMetrics,
  next: ViewportMetrics,
): boolean {
  return (
    previous.orientation !== next.orientation ||
    previous.keyboardLikelyOpen !== next.keyboardLikelyOpen ||
    previous.standalone !== next.standalone ||
    !roughlyEqual(previous.layoutWidth, next.layoutWidth) ||
    !roughlyEqual(previous.layoutHeight, next.layoutHeight) ||
    !roughlyEqual(previous.visualWidth, next.visualWidth) ||
    !roughlyEqual(previous.visualHeight, next.visualHeight)
  );
}

export function useViewportMetrics(): ViewportMetrics {
  const [metrics, setMetrics] = useState(readViewportMetrics);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let frame = 0;
    let debounceTimer = 0;

    function scheduleRead() {
      if (debounceTimer) {
        window.clearTimeout(debounceTimer);
      }

      debounceTimer = window.setTimeout(() => {
        if (frame) {
          return;
        }

        frame = window.requestAnimationFrame(() => {
          frame = 0;
          setMetrics((current) => {
            const next = readViewportMetrics();
            return metricsChanged(current, next) ? next : current;
          });
        });
      }, 64);
    }

    window.addEventListener("resize", scheduleRead, { passive: true });
    window.addEventListener("orientationchange", scheduleRead, {
      passive: true,
    });
    window.visualViewport?.addEventListener("resize", scheduleRead, {
      passive: true,
    });
    window.visualViewport?.addEventListener("scroll", scheduleRead, {
      passive: true,
    });

    return () => {
      window.removeEventListener("resize", scheduleRead);
      window.removeEventListener("orientationchange", scheduleRead);
      window.visualViewport?.removeEventListener("resize", scheduleRead);
      window.visualViewport?.removeEventListener("scroll", scheduleRead);

      if (debounceTimer) {
        window.clearTimeout(debounceTimer);
      }

      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, []);

  return useMemo(() => metrics, [metrics]);
}
