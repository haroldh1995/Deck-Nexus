import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { defaultAppSettings } from "../data/defaults";
import type { AppSettings } from "../types/domain";
import {
  ensureAppSettings,
  type SettingsPatch,
  updateAppSettings,
} from "../db/repositories";
import { SettingsContext } from "./useSettings";

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaultAppSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadSettings() {
      const nextSettings = await ensureAppSettings();
      if (mounted) {
        setSettings(nextSettings);
        setLoading(false);
      }
    }

    void loadSettings();

    const refreshSettings = () => {
      void loadSettings();
    };

    window.addEventListener("deck-nexus:settings-updated", refreshSettings);
    return () => {
      mounted = false;
      window.removeEventListener(
        "deck-nexus:settings-updated",
        refreshSettings,
      );
    };
  }, []);

  const updateSettings = useCallback(async (patch: SettingsPatch) => {
    setSettings((current) => ({
      ...current,
      ...patch,
      localFirstMode: true,
      updatedAt: new Date().toISOString(),
    }));
    const nextSettings = await updateAppSettings(patch);
    setSettings(nextSettings);
    return nextSettings;
  }, []);

  const value = useMemo(
    () => ({
      settings,
      loading,
      updateSettings,
    }),
    [loading, settings, updateSettings],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}
