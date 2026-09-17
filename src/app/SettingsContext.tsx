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
  type SettingsPatch,
  updateAppSettings,
} from "../db/repositories";
import {
  getResidentSettings,
  hydrateResidentSettings,
  refreshResidentSettings,
  setResidentSettings,
} from "../db/residentData";
import { SettingsContext } from "./useSettings";

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(
    () => getResidentSettings() ?? defaultAppSettings,
  );
  const [loading, setLoading] = useState(() => !getResidentSettings());

  useEffect(() => {
    let mounted = true;

    void hydrateResidentSettings()
      .then((nextSettings) => {
        if (mounted) {
          setSettings(nextSettings);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    const refreshSettings = () => {
      void refreshResidentSettings()
        .then((nextSettings) => {
          if (mounted) {
            setSettings(nextSettings);
          }
        })
        .catch(() => undefined);
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
    const currentSettings = getResidentSettings() ?? defaultAppSettings;
    const optimisticSettings: AppSettings = {
      ...currentSettings,
      ...patch,
      localFirstMode: true,
      updatedAt: new Date().toISOString(),
    };
    setSettings(optimisticSettings);
    setResidentSettings(optimisticSettings);
    const nextSettings = await updateAppSettings(patch);
    setResidentSettings(nextSettings);
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
