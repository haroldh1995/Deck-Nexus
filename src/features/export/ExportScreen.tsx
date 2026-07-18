import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { HolographicPanel } from "../../components/HolographicPanel";
import { PageHeader } from "../../components/PageHeader";
import { StatusPill } from "../../components/StatusPill";
import {
  createArenaDeckExport,
  createCollectionSnapshot,
  createDeckSnapshot,
  createDownloadBlob,
  createEcosystemExportPackage,
  createEcosystemZipPackage,
  createProfileSnapshot,
  serializeCompressedJson,
  serializePrettyJson,
  serializePrimaryJson,
} from "../../ecosystem";
import {
  ensureAppSettings,
  createFullBackupPackage,
  listDecks,
  listOwnedCards,
  restoreFullBackupPackage,
} from "../../db/repositories";
import type { AppSettings, BackupPackage, Deck, OwnedCard } from "../../types/domain";
import { BoardStateValidationPanel } from "./BoardStateValidationPanel";
import { ImmutableSnapshotsPanel } from "./ImmutableSnapshotsPanel";

function safeFileName(value: string): string {
  return value
    .trim()
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "deck-nexus";
}

function downloadFile(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ExportScreen() {
  const [searchParams] = useSearchParams();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [ownedCards, setOwnedCards] = useState<OwnedCard[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [selectedDeckId, setSelectedDeckId] = useState(searchParams.get("deckId") ?? "");
  const [message, setMessage] = useState("Canonical snapshot exports are local-only and ready.");

  useEffect(() => {
    let active = true;
    void Promise.all([listDecks(), listOwnedCards(), ensureAppSettings()]).then(
      ([loadedDecks, loadedOwnedCards, loadedSettings]) => {
        if (!active) {
          return;
        }
        setDecks(loadedDecks);
        setOwnedCards(loadedOwnedCards);
        setSettings(loadedSettings);
        if (!selectedDeckId && loadedDecks[0]) {
          setSelectedDeckId(loadedDecks[0].id);
        }
      },
    );
    return () => {
      active = false;
    };
  }, [selectedDeckId]);

  const selectedDeck = useMemo(
    () => decks.find((deck) => deck.id === selectedDeckId),
    [decks, selectedDeckId],
  );
  const selectedSnapshot = useMemo(
    () =>
      selectedDeck
        ? createDeckSnapshot(selectedDeck, { ownedCards, exportFormat: "primary_json" })
        : undefined,
    [ownedCards, selectedDeck],
  );
  const collectionSnapshot = useMemo(
    () => createCollectionSnapshot(ownedCards),
    [ownedCards],
  );
  const profileSnapshot = useMemo(
    () => createProfileSnapshot(settings ?? undefined),
    [settings],
  );
  const packageSnapshot = useMemo(
    () =>
      createEcosystemExportPackage({
        deckSnapshot: selectedSnapshot,
        collectionSnapshot,
        profileSnapshot,
      }),
    [collectionSnapshot, profileSnapshot, selectedSnapshot],
  );

  function exportJson(pretty: boolean): void {
    const snapshot = selectedSnapshot ?? collectionSnapshot;
    const content = pretty
      ? serializePrettyJson(snapshot)
      : serializePrimaryJson(snapshot);
    const fileBase = selectedDeck
      ? `${safeFileName(selectedDeck.name)}-snapshot`
      : "deck-nexus-collection-snapshot";
    downloadFile(
      `${fileBase}${pretty ? ".pretty" : ""}.json`,
      createDownloadBlob(content, "application/json"),
    );
    setMessage(`${pretty ? "Pretty" : "Primary"} JSON export generated.`);
  }

  function exportZip(): void {
    const bytes = createEcosystemZipPackage(packageSnapshot);
    downloadFile(
      "deck-nexus-ecosystem-export.zip",
      createDownloadBlob(bytes, "application/zip"),
    );
    setMessage("ZIP package generated with manifest, metadata, deck, collection, and profile snapshots.");
  }

  async function exportCompressedJson(): Promise<void> {
    const bytes = await serializeCompressedJson(selectedSnapshot ?? collectionSnapshot);
    downloadFile(
      `${selectedDeck ? safeFileName(selectedDeck.name) : "deck-nexus"}-snapshot.json.gz`,
      createDownloadBlob(bytes, "application/gzip"),
    );
    setMessage("Compressed JSON export generated.");
  }

  function exportArena(mode: "all" | "owned_only" | "optimal"): void {
    if (!selectedSnapshot) {
      setMessage("Choose a deck before exporting Arena text.");
      return;
    }
    const arenaText = createArenaDeckExport(selectedSnapshot, mode);
    downloadFile(
      `${safeFileName(selectedSnapshot.deckName)}-${mode}.txt`,
      createDownloadBlob(arenaText, "text/plain"),
    );
    setMessage("Arena deck export generated from the canonical snapshot.");
  }

  async function copyArena(): Promise<void> {
    if (!selectedSnapshot) {
      setMessage("Choose a deck before copying Arena text.");
      return;
    }
    const arenaText = createArenaDeckExport(selectedSnapshot);
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(arenaText);
      setMessage("Arena deck copied from the canonical snapshot.");
    } else {
      setMessage("Clipboard is unavailable in this browser; use Export Arena Deck instead.");
    }
  }

  async function exportFullBackup(): Promise<void> {
    try {
      const backup = await createFullBackupPackage();
      downloadFile(
        `deck-nexus-full-backup-${backup.createdAt.slice(0, 10)}.json`,
        createDownloadBlob(serializePrettyJson(backup), "application/json"),
      );
      setMessage("Local backup file generated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Backup could not be generated.");
    }
  }

  async function restoreBackup(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      const parsed = JSON.parse(await file.text()) as BackupPackage;
      const result = await restoreFullBackupPackage(parsed);
      setMessage(
        `Restore reviewed ${result.restoredRecords} record${result.restoredRecords === 1 ? "" : "s"}; ${result.conflictRecords} conflict${result.conflictRecords === 1 ? "" : "s"} kept untouched.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Backup could not be restored.");
    }
  }

  return (
    <div className="screen">
      <PageHeader title="Export">
        <StatusPill tone="cyan">Snapshot Ready</StatusPill>
      </PageHeader>

      <div className="settings-grid">
        <HolographicPanel>
          <div className="settings-section">
            <h2>Canonical Snapshot</h2>
            <p className="settings-note">
              Deck Nexus exports local deck, collection, and profile data without gameplay
              state, BoardState networking, Hub identity, prices, or marketplace data.
            </p>
            <label>
              Deck
              <select
                value={selectedDeckId}
                onChange={(event) => setSelectedDeckId(event.target.value)}
              >
                {decks.length === 0 ? <option value="">No local decks</option> : null}
                {decks.map((deck) => (
                  <option key={deck.id} value={deck.id}>
                    {deck.name}
                  </option>
                ))}
              </select>
            </label>
            <p className="settings-note" role="status">
              {message}
            </p>
            <div className="form-actions">
              <button type="button" onClick={() => exportJson(false)}>
                Export Primary JSON
              </button>
              <button type="button" onClick={() => exportJson(true)}>
                Export Pretty JSON
              </button>
              <button type="button" onClick={() => void exportCompressedJson()}>
                Export Compressed JSON
              </button>
              <button type="button" onClick={exportZip}>
                Export Ecosystem ZIP
              </button>
            </div>
          </div>
        </HolographicPanel>

        <HolographicPanel>
          <div className="settings-section">
            <h2>MTG Arena</h2>
            <p className="settings-note">
              Arena text is generated from the same canonical deck snapshot.
            </p>
            <div className="form-actions">
              <button type="button" onClick={() => void copyArena()}>
                Copy Arena Deck
              </button>
              <button type="button" onClick={() => exportArena("all")}>
                Export Arena Deck
              </button>
              <button type="button" onClick={() => exportArena("optimal")}>
                Export Optimal Deck
              </button>
              <button type="button" onClick={() => exportArena("owned_only")}>
                Export Owned-Only Deck
              </button>
            </div>
          </div>
        </HolographicPanel>

        <HolographicPanel>
          <div className="settings-section">
            <h2>Compatibility</h2>
            <p className="settings-note">
              Schema: {selectedSnapshot?.schemaVersion ?? collectionSnapshot.schemaVersion}
            </p>
            <p className="settings-note">
              Snapshot checksum: {selectedSnapshot?.checksum ?? collectionSnapshot.checksum}
            </p>
            <p className="settings-note">
              BoardState bridge validation and Hub networking are not connected yet.
            </p>
          </div>
        </HolographicPanel>

        <HolographicPanel>
          <div className="settings-section">
            <h2>Backup & Restore</h2>
            <p className="settings-note">
              Local backups include decks, collection records, settings, snapshots,
              BoardState validation history, and handoff history. Cloud providers are not connected.
            </p>
            <div className="form-actions">
              <button type="button" data-testid="export-full-backup" onClick={() => void exportFullBackup()}>
                Export Full Backup
              </button>
              <label className="file-action">
                Restore Backup JSON
                <input
                  accept="application/json,.json"
                  aria-label="Restore backup JSON"
                  data-testid="restore-full-backup"
                  onChange={(event) => void restoreBackup(event)}
                  type="file"
                />
              </label>
            </div>
          </div>
        </HolographicPanel>

        <HolographicPanel>
          <BoardStateValidationPanel snapshot={selectedSnapshot} />
        </HolographicPanel>

        <HolographicPanel>
          <ImmutableSnapshotsPanel deck={selectedDeck} />
        </HolographicPanel>
      </div>
    </div>
  );
}
