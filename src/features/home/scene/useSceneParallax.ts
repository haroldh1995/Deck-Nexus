import { useEffect, useState } from "react";

export interface SceneParallax {
  x: number;
  y: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function useSceneParallax({
  enabled,
  deviceTiltEnabled,
}: {
  enabled: boolean;
  deviceTiltEnabled: boolean;
}) {
  const [parallax, setParallax] = useState<SceneParallax>({ x: 0, y: 0 });

  useEffect(() => {
    if (!enabled) {
      const frame = window.requestAnimationFrame(() => {
        setParallax({ x: 0, y: 0 });
      });
      return () => {
        window.cancelAnimationFrame(frame);
      };
    }

    let frame = 0;
    let nextX = 0;
    let nextY = 0;

    function handlePointerMove(event: PointerEvent) {
      const width = window.innerWidth || 1;
      const height = window.innerHeight || 1;
      nextX = clamp((event.clientX / width - 0.5) * 2, -1, 1);
      nextY = clamp((event.clientY / height - 0.5) * 2, -1, 1);

      if (frame) {
        return;
      }

      frame = window.requestAnimationFrame(() => {
        frame = 0;
        setParallax({ x: nextX, y: nextY });
      });
    }

    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });

    function handleDeviceOrientation(event: DeviceOrientationEvent) {
      if (!deviceTiltEnabled) {
        return;
      }

      const gamma = typeof event.gamma === "number" ? event.gamma : 0;
      const beta = typeof event.beta === "number" ? event.beta : 0;
      nextX = clamp(gamma / 28, -1, 1);
      nextY = clamp((beta - 35) / 34, -1, 1);

      if (frame) {
        return;
      }

      frame = window.requestAnimationFrame(() => {
        frame = 0;
        setParallax({ x: nextX, y: nextY });
      });
    }

    if (deviceTiltEnabled) {
      window.addEventListener("deviceorientation", handleDeviceOrientation, {
        passive: true,
      });
    }

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("deviceorientation", handleDeviceOrientation);
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [deviceTiltEnabled, enabled]);

  return parallax;
}
