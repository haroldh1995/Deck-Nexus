import { HolographicPanel } from "../../components/HolographicPanel";
import { PageHeader } from "../../components/PageHeader";
import { StatusPill } from "../../components/StatusPill";
import { useSettings } from "../../app/useSettings";
import { useState } from "react";
import {
  deleteScryfallOfflineCardDatabase,
  downloadScryfallOfflineCardDatabase,
  getScryfallBulkDataMetadata,
} from "../../services/scryfall";
import type {
  Bracket,
  BracketLock,
  ExportFormat,
  HomePerformanceMode,
  OwnershipPreference,
  TextSize,
} from "../../types/domain";

const bracketPermissionControls: {
  key: keyof Pick<
    BracketLock,
    | "allowCombos"
    | "allowTutors"
    | "allowFastMana"
    | "allowStax"
    | "allowMassLandDestruction"
    | "allowExtraTurns"
  >;
  label: string;
}[] = [
  { key: "allowCombos", label: "Allow combos" },
  { key: "allowTutors", label: "Allow tutors" },
  { key: "allowFastMana", label: "Allow fast mana" },
  { key: "allowStax", label: "Allow stax" },
  { key: "allowMassLandDestruction", label: "Allow mass land destruction" },
  { key: "allowExtraTurns", label: "Allow extra turns" },
];

export function SettingsScreen() {
  const { settings, updateSettings } = useSettings();
  const [scryfallStatus, setScryfallStatus] = useState("Scryfall cache is ready.");
  const [scryfallBusy, setScryfallBusy] = useState(false);
  const bracketLock = settings.defaultBracketLock;

  async function refreshScryfallBulkMetadata() {
    setScryfallBusy(true);
    try {
      const records = await getScryfallBulkDataMetadata();
      setScryfallStatus(`${records.length} Scryfall bulk-data records refreshed.`);
      await updateSettings({ scryfallCacheUpdatedAt: new Date().toISOString() });
    } catch (error) {
      setScryfallStatus(error instanceof Error ? error.message : "Unable to refresh Scryfall metadata.");
    } finally {
      setScryfallBusy(false);
    }
  }

  async function downloadOfflineCardDatabase() {
    setScryfallBusy(true);
    try {
      const result = await downloadScryfallOfflineCardDatabase({ type: "default_cards" });
      await updateSettings({
        scryfallOfflineDatabaseDownloaded: true,
        scryfallOfflineDatabaseSize: result.compressedSize,
        scryfallOfflineDatabaseUpdatedAt: result.updatedAt ?? new Date().toISOString(),
        scryfallCacheUpdatedAt: new Date().toISOString(),
      });
      setScryfallStatus(`${result.cardCount} Scryfall cards cached for offline search.`);
    } catch (error) {
      setScryfallStatus(error instanceof Error ? error.message : "Offline database download failed.");
    } finally {
      setScryfallBusy(false);
    }
  }

  async function deleteOfflineCardDatabase() {
    setScryfallBusy(true);
    try {
      await deleteScryfallOfflineCardDatabase();
      await updateSettings({
        scryfallOfflineDatabaseDownloaded: false,
        scryfallOfflineDatabaseSize: undefined,
        scryfallOfflineDatabaseUpdatedAt: undefined,
        scryfallCacheUpdatedAt: new Date().toISOString(),
      });
      setScryfallStatus("Scryfall offline cache deleted. Decks and owned cards were preserved.");
    } catch (error) {
      setScryfallStatus(error instanceof Error ? error.message : "Unable to delete Scryfall cache.");
    } finally {
      setScryfallBusy(false);
    }
  }

  return (
    <div className="screen">
      <PageHeader title="Settings">
        <StatusPill tone="cyan">Local First</StatusPill>
      </PageHeader>

      <div className="settings-grid">
        <HolographicPanel>
          <div className="settings-section">
            <h2>Interface</h2>
            <label className="toggle-row">
              <input
                checked={settings.reducedMotion}
                onChange={(event) =>
                  void updateSettings({ reducedMotion: event.target.checked })
                }
                type="checkbox"
              />
              <span>Reduced motion</span>
            </label>
            <label className="toggle-row">
              <input
                checked={settings.staticHomeScreen}
                onChange={(event) =>
                  void updateSettings({
                    staticHomeScreen: event.target.checked,
                  })
                }
                type="checkbox"
              />
              <span>Static home screen</span>
            </label>
            <label className="toggle-row">
              <input
                checked={settings.highContrast}
                onChange={(event) =>
                  void updateSettings({ highContrast: event.target.checked })
                }
                type="checkbox"
              />
              <span>High contrast</span>
            </label>
            <label className="toggle-row">
              <input
                checked={settings.deviceTiltParallax}
                onChange={(event) =>
                  void updateSettings({
                    deviceTiltParallax: event.target.checked,
                  })
                }
                type="checkbox"
              />
              <span>Device tilt parallax</span>
            </label>
            <label>
              Glow intensity
              <input
                max="1.35"
                min="0.55"
                onChange={(event) =>
                  void updateSettings({
                    glowIntensity: Number(event.target.value),
                  })
                }
                step="0.05"
                type="range"
                value={settings.glowIntensity}
              />
            </label>
            <label>
              Home performance mode
              <select
                onChange={(event) =>
                  void updateSettings({
                    homePerformanceMode: event.target
                      .value as HomePerformanceMode,
                  })
                }
                value={settings.homePerformanceMode}
              >
                <option value="full">Full arcane</option>
                <option value="balanced">Balanced arcane</option>
                <option value="performance">Performance mode</option>
              </select>
            </label>
            <label>
              Text size
              <select
                onChange={(event) =>
                  void updateSettings({
                    textSize: event.target.value as TextSize,
                  })
                }
                value={settings.textSize}
              >
                <option value="compact">Compact</option>
                <option value="normal">Normal</option>
                <option value="large">Large</option>
              </select>
            </label>
          </div>
        </HolographicPanel>

        <HolographicPanel>
          <div className="settings-section">
            <h2>Local Data</h2>
            <label className="toggle-row is-locked">
              <input checked disabled type="checkbox" />
              <span>Local-first mode enabled</span>
            </label>
            <label className="toggle-row">
              <input
                checked={settings.scannerBatchPersistence}
                onChange={(event) =>
                  void updateSettings({
                    scannerBatchPersistence: event.target.checked,
                  })
                }
                type="checkbox"
              />
              <span>Persist scanner batches</span>
            </label>
            <label>
              Default export format
              <select
                onChange={(event) =>
                  void updateSettings({
                    defaultExportFormat: event.target.value as ExportFormat,
                  })
                }
                value={settings.defaultExportFormat}
              >
                <option value="plain_text">Plain text</option>
                <option value="json">JSON</option>
                <option value="csv">CSV</option>
              </select>
            </label>
            <label>
              Default ownership preference
              <select
                onChange={(event) =>
                  void updateSettings({
                    defaultOwnershipPreference: event.target
                      .value as OwnershipPreference,
                  })
                }
                value={settings.defaultOwnershipPreference}
              >
                <option value="owned_first">Owned first</option>
                <option value="owned_only">Owned only</option>
                <option value="allow_missing">Allow missing cards</option>
              </select>
            </label>
          </div>
        </HolographicPanel>

        <HolographicPanel>
          <div className="settings-section">
            <h2>Scryfall Data</h2>
            <label className="toggle-row">
              <input
                checked={settings.scryfallLiveSearchEnabled}
                onChange={(event) =>
                  void updateSettings({
                    scryfallLiveSearchEnabled: event.target.checked,
                  })
                }
                type="checkbox"
              />
              <span>Use live Scryfall search when online</span>
            </label>
            <label className="toggle-row">
              <input
                checked={settings.scryfallBulkDownloadWifiOnly}
                onChange={(event) =>
                  void updateSettings({
                    scryfallBulkDownloadWifiOnly: event.target.checked,
                  })
                }
                type="checkbox"
              />
              <span>Prefer Wi-Fi for offline card database downloads</span>
            </label>
            <p className="settings-note">
              Card data and images are provided by Scryfall. Deckstate stores cached card
              records locally for speed and offline use, but it does not store or display
              prices or marketplace links.
            </p>
            <p className="settings-note">
              Offline database:{" "}
              {settings.scryfallOfflineDatabaseDownloaded
                ? `downloaded${settings.scryfallOfflineDatabaseUpdatedAt ? ` on ${new Date(settings.scryfallOfflineDatabaseUpdatedAt).toLocaleDateString()}` : ""}`
                : "not downloaded"}
            </p>
            {settings.scryfallOfflineDatabaseSize ? (
              <p className="settings-note">
                Download size: {(settings.scryfallOfflineDatabaseSize / 1024 / 1024).toFixed(1)} MB compressed.
              </p>
            ) : null}
            <p className="settings-note" role="status">
              {scryfallStatus}
            </p>
            <div className="form-actions">
              <button type="button" disabled={scryfallBusy} onClick={() => void refreshScryfallBulkMetadata()}>
                Refresh Bulk Metadata
              </button>
              <button type="button" disabled={scryfallBusy} onClick={() => void downloadOfflineCardDatabase()}>
                {settings.scryfallOfflineDatabaseDownloaded ? "Update Offline Card Database" : "Download Offline Card Database"}
              </button>
              <button type="button" disabled={scryfallBusy} onClick={() => void deleteOfflineCardDatabase()}>
                Delete Offline Card Database
              </button>
            </div>
          </div>
        </HolographicPanel>

        <HolographicPanel className="settings-grid__wide">
          <div className="settings-section">
            <h2>Default Bracket Lock</h2>
            <div className="form-grid">
              <label className="toggle-row">
                <input
                  checked={bracketLock.enabled}
                  onChange={(event) =>
                    void updateSettings({
                      defaultBracketLock: {
                        ...bracketLock,
                        enabled: event.target.checked,
                      },
                    })
                  }
                  type="checkbox"
                />
                <span>Enable by default</span>
              </label>
              <label>
                Bracket
                <select
                  onChange={(event) =>
                    void updateSettings({
                      defaultBracketLock: {
                        ...bracketLock,
                        bracket: event.target.value as Bracket,
                      },
                    })
                  }
                  value={bracketLock.bracket}
                >
                  <option value="bracket_1">Bracket 1</option>
                  <option value="bracket_2">Bracket 2</option>
                  <option value="bracket_3">Bracket 3</option>
                  <option value="bracket_4">Bracket 4</option>
                  <option value="bracket_5">Bracket 5</option>
                  <option value="custom">Custom</option>
                </select>
              </label>
            </div>

            <div className="permission-grid">
              {bracketPermissionControls.map((control) => (
                <label className="toggle-row" key={control.key}>
                  <input
                    checked={bracketLock[control.key]}
                    onChange={(event) =>
                      void updateSettings({
                        defaultBracketLock: {
                          ...bracketLock,
                          [control.key]: event.target.checked,
                        },
                      })
                    }
                    type="checkbox"
                  />
                  <span>{control.label}</span>
                </label>
              ))}
            </div>
          </div>
        </HolographicPanel>
      </div>
    </div>
  );
}
