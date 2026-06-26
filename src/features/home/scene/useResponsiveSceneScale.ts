import { useEffect, useMemo, useState } from "react";
import { calculateResponsiveSceneScale } from "./orbitMath";

function getViewportSize() {
  if (typeof window === "undefined") {
    return { width: 390, height: 844 };
  }

  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

export function useResponsiveSceneScale() {
  const [viewport, setViewport] = useState(getViewportSize);

  useEffect(() => {
    let frame = 0;

    function handleResize() {
      if (frame) {
        return;
      }

      frame = window.requestAnimationFrame(() => {
        frame = 0;
        setViewport(getViewportSize());
      });
    }

    window.addEventListener("resize", handleResize, { passive: true });
    return () => {
      window.removeEventListener("resize", handleResize);
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, []);

  return useMemo(() => calculateResponsiveSceneScale(viewport), [viewport]);
}
