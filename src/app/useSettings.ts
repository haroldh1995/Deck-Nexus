import { createContext, useContext } from "react";
import type { AppSettings } from "../types/domain";
import type { SettingsPatch } from "../db/repositories";

export type SettingsContextValue = {
  settings: AppSettings;
  loading: boolean;
  updateSettings: (patch: SettingsPatch) => Promise<AppSettings>;
};

export const SettingsContext = createContext<SettingsContextValue | undefined>(
  undefined,
);

export function useSettings() {
  const context = useContext(SettingsContext);

  if (!context) {
    throw new Error("useSettings must be used within SettingsProvider");
  }

  return context;
}
