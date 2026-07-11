import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  archiveImmutableDeckSnapshotRecord,
  listImmutableDeckSnapshotsForDeck,
} from "../../db/repositories";
import {
  compareDeckToSnapshot,
  createAdvancedGameplaySnapshotEnvelope,
  createDryRunSnapshotEnvelope,
  createDownloadBlob,
  createImmutableDeckSnapshot,
  duplicateImmutableSnapshotToDeck,
  serializeImmutableSnapshot,
  serializePrettyJson,
  snapshotFromRecord,
  verifyImmutableDeckSnapshot,
  type SnapshotConsumerIntent,
  type SnapshotCreationReason,
} from "../../ecosystem";
import type { Deck, ImmutableDeckSnapshotRecord } from "../../types/domain";

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

const intentOptions: Array<{
  value: SnapshotConsumerIntent;
  label: string;
  reason: SnapshotCreationReason;
}> = [
  { value: "archival", label: "Archive Checkpoint", reason: "archive_checkpoint" },
  { value: "boardstate_validation", label: "Prepare for BoardState Validation", reason: "boardstate_validation" },
  { value: "advanced_gameplay", label: "Prepare for Advanced Gameplay Export", reason: "advanced_gameplay_preparation" },
  { value: "dry_run", label: "Prepare for Dry Run Export", reason: "dry_run_preparation" },
  { value: "export", label: "Prepare for Export", reason: "export" },
];

export function ImmutableSnapshotsPanel({ deck }: { deck?: Deck }) {
  const navigate = useNavigate();
  const [snapshots, setSnapshots] = useState<ImmutableDeckSnapshotRecord[]>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState("");
  const [intent, setIntent] = useState<SnapshotConsumerIntent>("archival");
  const [message, setMessage] = useState("Immutable snapshots are local and read-only.");
  const [comparison, setComparison] = useState("");

  const selectedRecord = useMemo(
    () => snapshots.find((snapshot) => snapshot.snapshotId === selectedSnapshotId),
    [selectedSnapshotId, snapshots],
  );
  const selectedSnapshot = selectedRecord ? snapshotFromRecord(selectedRecord) : undefined;
  const unresolvedCount = selectedSnapshot?.gameplay.unresolvedGameplayCards.length ?? 0;
  const currentIntent = intentOptions.find((option) => option.value === intent) ?? intentOptions[0];

  useEffect(() => {
    let active = true;
    if (!deck) {
      void Promise.resolve().then(() => {
        if (active) {
          setSnapshots([]);
          setSelectedSnapshotId("");
        }
      });
      return () => {
        active = false;
      };
    }
    void listImmutableDeckSnapshotsForDeck(deck.id).then((records) => {
      if (!active) {
        return;
      }
      setSnapshots(records);
      setSelectedSnapshotId((current) => current || records[0]?.snapshotId || "");
    });
    return () => {
      active = false;
    };
  }, [deck]);

  async function refresh(nextSelectedId?: string): Promise<void> {
    if (!deck) {
      return;
    }
    const records = await listImmutableDeckSnapshotsForDeck(deck.id);
    setSnapshots(records);
    setSelectedSnapshotId(nextSelectedId ?? records[0]?.snapshotId ?? "");
  }

  async function createSnapshot(): Promise<void> {
    if (!deck) {
      setMessage("Choose a deck before creating an immutable snapshot.");
      return;
    }
    const result = await createImmutableDeckSnapshot(deck, {
      consumerIntent: intent,
      creationReason: currentIntent.reason,
    });
    await refresh(result.record.snapshotId);
    setMessage(`Immutable snapshot #${result.record.snapshotSequenceNumber} created locally. BoardState launch bridge not connected.`);
  }

  function exportRecord(kind: "snapshot" | "advanced" | "dry_run"): void {
    if (!selectedRecord) {
      setMessage("Create or select a snapshot before exporting.");
      return;
    }
    const base = `${safeFileName(selectedRecord.deckName)}-snapshot-${selectedRecord.snapshotSequenceNumber}`;
    if (kind === "snapshot") {
      downloadFile(
        `${base}.json`,
        createDownloadBlob(serializeImmutableSnapshot(selectedRecord), "application/json"),
      );
      setMessage("Immutable snapshot JSON exported.");
      return;
    }
    if (kind === "advanced") {
      downloadFile(
        `${base}.advanced-gameplay-envelope.json`,
        createDownloadBlob(
          serializePrettyJson(createAdvancedGameplaySnapshotEnvelope(selectedRecord)),
          "application/json",
        ),
      );
      setMessage("Advanced Gameplay export package prepared locally. No BoardState session was launched.");
      return;
    }
    downloadFile(
      `${base}.dry-run-envelope.json`,
      createDownloadBlob(
        serializePrettyJson(createDryRunSnapshotEnvelope(selectedRecord)),
        "application/json",
      ),
    );
    setMessage("Dry Run export package prepared locally. No Dry Run session was started.");
  }

  function compareCurrentDeck(): void {
    if (!deck || !selectedRecord) {
      setComparison("Create or select a snapshot before comparing.");
      return;
    }
    const result = compareDeckToSnapshot(deck, selectedRecord);
    setComparison(result.summary);
  }

  async function archiveSelected(): Promise<void> {
    if (!selectedRecord) {
      return;
    }
    await archiveImmutableDeckSnapshotRecord(selectedRecord.snapshotId);
    await refresh(selectedRecord.snapshotId);
    setMessage("Snapshot archived without changing its protected payload.");
  }

  async function duplicateSelected(): Promise<void> {
    if (!selectedRecord) {
      return;
    }
    const duplicate = await duplicateImmutableSnapshotToDeck(selectedRecord);
    setMessage("Snapshot duplicated as a new mutable deck.");
    navigate(`/deck-builder/${duplicate.id}`);
  }

  return (
    <div className="settings-section" data-testid="immutable-snapshots-panel">
      <h2>Immutable Deck Snapshots</h2>
      <p className="settings-note">
        Freeze exact local deck versions for future BoardState validation, Advanced Gameplay
        export, Dry Run export, backup, and recovery. Snapshot payloads are read-only and
        do not launch BoardState.
      </p>
      <label>
        Snapshot intent
        <select
          value={intent}
          onChange={(event) => setIntent(event.target.value as SnapshotConsumerIntent)}
        >
          {intentOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <div className="form-actions">
        <button
          type="button"
          onClick={() => void createSnapshot()}
          disabled={!deck}
          data-testid="create-immutable-snapshot"
        >
          Create Immutable Snapshot
        </button>
        <button
          type="button"
          onClick={compareCurrentDeck}
          disabled={!deck || !selectedRecord}
          data-testid="compare-current-deck"
        >
          Compare to Current Deck
        </button>
        <button
          type="button"
          onClick={() => exportRecord("snapshot")}
          disabled={!selectedRecord}
        >
          Export Snapshot JSON
        </button>
      </div>
      <p className="settings-note" role="status">
        {message}
      </p>
      {comparison ? (
        <p className="settings-note" data-testid="snapshot-comparison" role="status">
          {comparison}
        </p>
      ) : null}
      <div className="snapshot-history" data-testid="snapshot-history">
        <h3>Snapshot History</h3>
        {snapshots.length === 0 ? (
          <p className="settings-note">No immutable snapshots exist for this deck yet.</p>
        ) : (
          <ul className="status-list">
            {snapshots.map((snapshot) => (
              <li key={snapshot.snapshotId}>
                <button
                  type="button"
                  className="snapshot-row-button"
                  onClick={() => setSelectedSnapshotId(snapshot.snapshotId)}
                  aria-current={snapshot.snapshotId === selectedSnapshotId}
                >
                  #{snapshot.snapshotSequenceNumber} {snapshot.consumerIntent.replace(/_/g, " ")}
                  <span>{new Date(snapshot.createdAt).toLocaleString()}</span>
                  <span>{snapshot.status.replace(/_/g, " ")} · {snapshot.gameplayChecksum.slice(0, 14)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {selectedRecord && selectedSnapshot ? (
        <div className="snapshot-detail" data-testid="snapshot-detail">
          <h3>Read-Only Snapshot Detail</h3>
          <p className="settings-note">
            This immutable payload has no Edit Snapshot action. Create a new snapshot
            after changing the live deck.
          </p>
          <dl className="detail-list">
            <div>
              <dt>Deck</dt>
              <dd>{selectedSnapshot.deckIdentity.deckName}</dd>
            </div>
            <div>
              <dt>Snapshot</dt>
              <dd>#{selectedRecord.snapshotSequenceNumber} · {selectedRecord.snapshotId.slice(0, 38)}</dd>
            </div>
            <div>
              <dt>Commander</dt>
              <dd>{selectedSnapshot.gameplay.commander.commanderNames.join(", ") || "No commander recorded"}</dd>
            </div>
            <div>
              <dt>Main Deck Count</dt>
              <dd>
                {selectedSnapshot.gameplay.gameplayIncludedCards.reduce(
                  (sum, card) => sum + card.quantity,
                  0,
                )}
              </dd>
            </div>
            <div>
              <dt>Unresolved Cards</dt>
              <dd>{unresolvedCount}</dd>
            </div>
            <div>
              <dt>Gameplay Checksum</dt>
              <dd>{selectedRecord.gameplayChecksum}</dd>
            </div>
            <div>
              <dt>Full Checksum</dt>
              <dd>{selectedRecord.fullChecksum}</dd>
            </div>
            <div>
              <dt>Integrity</dt>
              <dd>{verifyImmutableDeckSnapshot(selectedRecord).status.replace(/_/g, " ")}</dd>
            </div>
            <div>
              <dt>BoardState</dt>
              <dd>
                {selectedSnapshot.validationMetadata.boardStateValidationStatus === "validated"
                  ? "BoardState validation is attached to this exact canonical snapshot."
                  : "BoardState validation required or unavailable. Launch bridge not connected."}
              </dd>
            </div>
          </dl>
          <div className="form-actions">
            <button
              type="button"
              onClick={() => exportRecord("advanced")}
              data-testid="advanced-gameplay-envelope"
            >
              Export Advanced Gameplay Envelope
            </button>
            <button
              type="button"
              onClick={() => exportRecord("dry_run")}
              data-testid="dry-run-envelope"
            >
              Export Dry Run Envelope
            </button>
            <button type="button" onClick={() => void duplicateSelected()} data-testid="duplicate-snapshot">
              Duplicate as New Deck
            </button>
            <button type="button" onClick={() => void archiveSelected()} data-testid="archive-snapshot">
              Archive Snapshot
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
