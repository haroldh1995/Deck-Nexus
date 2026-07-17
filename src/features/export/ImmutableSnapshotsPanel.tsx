import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  archiveImmutableDeckSnapshotRecord,
  listBoardStateHandoffsForSnapshot,
  listImmutableDeckSnapshotsForDeck,
} from "../../db/repositories";
import {
  boardStateManualImportInstructions,
  boardStatePackageFileName,
  createBoardStateLaunchRequest,
  createBoardStatePackageBlob,
  compareDeckToSnapshot,
  createAdvancedGameplaySnapshotEnvelope,
  createDryRunSnapshotEnvelope,
  createDownloadBlob,
  createImmutableDeckSnapshot,
  duplicateImmutableSnapshotToDeck,
  getBoardStateTransportCapabilities,
  runBoardStateHandoff,
  serializeImmutableSnapshot,
  serializePrettyJson,
  snapshotFromRecord,
  verifyImmutableDeckSnapshot,
  type BoardStateHandoffIntent,
  type BoardStateHandoffTransportType,
  type SnapshotConsumerIntent,
  type SnapshotCreationReason,
} from "../../ecosystem";
import type { BoardStateHandoffRecord, Deck, ImmutableDeckSnapshotRecord } from "../../types/domain";

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
  const [handoffIntent, setHandoffIntent] = useState<BoardStateHandoffIntent>("advanced_gameplay");
  const [transportType, setTransportType] = useState<BoardStateHandoffTransportType>("file_export");
  const [handoffs, setHandoffs] = useState<BoardStateHandoffRecord[]>([]);

  const selectedRecord = useMemo(
    () => snapshots.find((snapshot) => snapshot.snapshotId === selectedSnapshotId),
    [selectedSnapshotId, snapshots],
  );
  const selectedSnapshot = selectedRecord ? snapshotFromRecord(selectedRecord) : undefined;
  const unresolvedCount = selectedSnapshot?.gameplay.unresolvedGameplayCards.length ?? 0;
  const currentIntent = intentOptions.find((option) => option.value === intent) ?? intentOptions[0];
  const previewRequest = selectedRecord
    ? createBoardStateLaunchRequest(selectedRecord, {
        intent: handoffIntent,
        transportType,
      })
    : undefined;
  const transportCapabilities = getBoardStateTransportCapabilities(
    previewRequest?.payloadSize ?? 0,
  );
  const selectedTransport = transportCapabilities.find(
    (capability) => capability.type === transportType,
  );
  const directLaunchCapability = transportCapabilities.find(
    (capability) => capability.type === "direct_web",
  );

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

  useEffect(() => {
    let active = true;
    if (!selectedRecord) {
      void Promise.resolve().then(() => {
        if (active) {
          setHandoffs([]);
        }
      });
      return () => {
        active = false;
      };
    }
    void listBoardStateHandoffsForSnapshot(selectedRecord.snapshotId).then((records) => {
      if (active) {
        setHandoffs(records);
      }
    });
    return () => {
      active = false;
    };
  }, [selectedRecord]);

  async function refreshHandoffs(snapshotId = selectedRecord?.snapshotId): Promise<void> {
    if (!snapshotId) {
      setHandoffs([]);
      return;
    }
    setHandoffs(await listBoardStateHandoffsForSnapshot(snapshotId));
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

  async function runHandoff(): Promise<void> {
    if (!selectedRecord) {
      setMessage("Create or select a snapshot before preparing a BoardState handoff.");
      return;
    }
    const result = await runBoardStateHandoff(selectedRecord, {
      intent: handoffIntent,
      transportType,
    });
    await refreshHandoffs(selectedRecord.snapshotId);
    if (result.status === "failed" || result.status === "incompatible") {
      setMessage(result.handoff.errorSummary ?? "BoardState handoff could not be prepared.");
      return;
    }
    if (result.status === "share_sheet_opened") {
      setMessage("Share sheet opened. BoardState import is not confirmed.");
      return;
    }
    if (result.status === "import_unconfirmed") {
      setMessage("BoardState opened or was requested, but import is not confirmed without acknowledgment.");
      return;
    }
    setMessage("BoardState package prepared locally. Import is not confirmed.");
  }

  function exportBoardStatePackage(): void {
    if (!selectedRecord || !previewRequest) {
      setMessage("Create or select a snapshot before exporting a BoardState package.");
      return;
    }
    downloadFile(
      boardStatePackageFileName(previewRequest),
      createBoardStatePackageBlob(previewRequest),
    );
    void runBoardStateHandoff(selectedRecord, {
      intent: handoffIntent,
      transportType: "file_export",
    }).then(() => refreshHandoffs(selectedRecord.snapshotId));
    setMessage("BoardState file export completed. Import is not confirmed.");
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
                  <span>{snapshot.status.replace(/_/g, " ")} - {snapshot.gameplayChecksum.slice(0, 14)}</span>
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
              <dd>#{selectedRecord.snapshotSequenceNumber} - {selectedRecord.snapshotId.slice(0, 38)}</dd>
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
          <div className="boardstate-handoff" data-testid="boardstate-handoff-panel">
            <h3>BoardState Handoff</h3>
            <p className="settings-note">
              Direct launch appears only when a real transport is configured. Current
              status: {directLaunchCapability?.reason ?? "No direct transport is registered."}
            </p>
            <div className="form-grid">
              <label>
                BoardState intent
                <select
                  value={handoffIntent}
                  onChange={(event) => setHandoffIntent(event.target.value as BoardStateHandoffIntent)}
                >
                  <option value="advanced_gameplay">Advanced Gameplay package</option>
                  <option value="dry_run">Dry Run package</option>
                  <option value="validation_review">Validation review package</option>
                  <option value="import_only">Import only package</option>
                  <option value="generic_export">Generic BoardState export</option>
                </select>
              </label>
              <label>
                Handoff method
                <select
                  value={transportType}
                  onChange={(event) => setTransportType(event.target.value as BoardStateHandoffTransportType)}
                >
                  {transportCapabilities
                    .filter((capability) =>
                      ["file_export", "clipboard", "web_share", "manual_import", "direct_web"].includes(capability.type),
                    )
                    .map((capability) => (
                      <option key={capability.type} value={capability.type}>
                        {capability.label} - {capability.status.replace(/_/g, " ")}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            <dl className="detail-list">
              <div>
                <dt>Selected transport</dt>
                <dd>{selectedTransport?.reason ?? "Choose a handoff method."}</dd>
              </div>
              <div>
                <dt>Payload size</dt>
                <dd>{previewRequest ? `${previewRequest.payloadSize} bytes` : "No payload selected"}</dd>
              </div>
              <div>
                <dt>Acknowledgment</dt>
                <dd>{selectedTransport?.supportsAcknowledgment ? "Requested; success requires BoardState acknowledgment." : "Not supported by this method."}</dd>
              </div>
              <div>
                <dt>Import status</dt>
                <dd>Unconfirmed until BoardState returns a valid acknowledgment.</dd>
              </div>
            </dl>
            <div className="form-actions">
              <button
                type="button"
                onClick={() => void runHandoff()}
                disabled={!selectedRecord}
                data-testid="prepare-boardstate-handoff"
              >
                Prepare BoardState Handoff
              </button>
              <button
                type="button"
                onClick={exportBoardStatePackage}
                disabled={!selectedRecord}
                data-testid="export-boardstate-package"
              >
                Export BoardState Package
              </button>
            </div>
            {previewRequest ? (
              <ol className="manual-steps" data-testid="manual-import-steps">
                {boardStateManualImportInstructions(previewRequest).map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            ) : null}
            <div className="handoff-history" data-testid="handoff-history">
              <h3>Handoff History</h3>
              {handoffs.length === 0 ? (
                <p className="settings-note">No BoardState handoff attempts for this snapshot yet.</p>
              ) : (
                <ul className="status-list">
                  {handoffs.map((handoff) => (
                    <li key={handoff.id}>
                      <strong>{handoff.consumerIntent.replace(/_/g, " ")}</strong>
                      <span>{handoff.transportType.replace(/_/g, " ")} - {handoff.finalStatus.replace(/_/g, " ")}</span>
                      <span>{handoff.importedConfirmed ? "Import confirmed" : "Import unconfirmed"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
