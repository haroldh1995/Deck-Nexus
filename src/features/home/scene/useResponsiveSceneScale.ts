import { useMemo } from "react";
import { useViewportMetrics } from "../../../hooks/useViewportMetrics";
import { calculateResponsiveSceneScale } from "./orbitMath";

export function useResponsiveSceneScale() {
  const viewport = useViewportMetrics();

  return useMemo(
    () =>
      calculateResponsiveSceneScale({
        height: viewport.visualHeight,
        width: viewport.visualWidth,
      }),
    [viewport.visualHeight, viewport.visualWidth],
  );
}
