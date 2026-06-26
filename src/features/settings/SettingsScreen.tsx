import { HolographicPanel } from "../../components/HolographicPanel";
import { PageHeader } from "../../components/PageHeader";
import { StatusPill } from "../../components/StatusPill";
import { useSettings } from "../../app/useSettings";
import type {
  Bracket,
  BracketLock,
  ExportFormat,
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
  const bracketLock = settings.defaultBracketLock;

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
