import { useEffect, useMemo, useState } from "react";
import { homeIntroSessionKey } from "./homeSceneConstants";
import type { HologramIntroMode } from "./homeSceneTypes";

export function getHomeIntroMode({
  reducedMotion,
  sessionPlayed,
}: {
  reducedMotion: boolean;
  sessionPlayed: boolean;
}): HologramIntroMode {
  if (reducedMotion) {
    return "reduced";
  }

  return sessionPlayed ? "return" : "full";
}

export function useHomeIntro(reducedMotion: boolean): HologramIntroMode {
  const sessionPlayed = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }

    const played = window.sessionStorage.getItem(homeIntroSessionKey) === "true";
    window.sessionStorage.setItem(homeIntroSessionKey, "true");
    return played;
  }, []);

  const [introMode, setIntroMode] = useState(() =>
    getHomeIntroMode({ reducedMotion, sessionPlayed }),
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.sessionStorage.setItem(homeIntroSessionKey, "true");

    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        setIntroMode(reducedMotion ? "reduced" : "return");
      }
    }

    window.addEventListener("pageshow", handlePageShow);
    return () => {
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [reducedMotion]);

  return introMode;
}
