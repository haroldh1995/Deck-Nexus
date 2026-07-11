import { useEffect, useMemo, useState } from "react";
import { StatusPill } from "../../components/StatusPill";
import {
  boardStateResultLabel,
  boardStateResultTone,
  createConfiguredBoardStateTransport,
  validateDeckSnapshotWithBoardState,
  withBoardStateStaleState,
  type BoardStateBridgeRuntimeStatus,
  type BoardStateTransport,
  type DeckSnapshot,
} from "../../ecosystem";
import {
  getLatestBoardStateValidationResult,
  markStaleBoardStateValidationResults,
  saveBoardStateValidationResult,
} from "../../db/repositories";
import type { BoardStateValidationResultRecord } from "../../types/domain";

export function BoardStateValidationPanel({
  snapshot,
  transport,
}: {
  snapshot?: DeckSnapshot;
  transport?: BoardStateTransport;
}) {
  const resolvedTransport = useMemo(
    () => transport ?? createConfiguredBoardStateTransport(),
    [transport],
  );
  const [bridgeStatus, setBridgeStatus] = useState<BoardStateBridgeRuntimeStatus | null>(null);
  const [latestResult, setLatestResult] =
    useState<BoardStateValidationResultRecord | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("BoardState validation is not connected.");

  useEffect(() => {
    let active = true;
    void resolvedTransport.getStatus().then((status) => {
      if (active) {
        setBridgeStatus(status);
        setMessage(status.message);
      }
    });
    return () => {
      active = false;
    };
  }, [resolvedTransport]);

  useEffect(() => {
    let active = true;
    if (!snapshot) {
      void Promise.resolve().then(() => {
        if (active) {
          setLatestResult(null);
        }
      });
      return () => {
        active = false;
      };
    }

    void (async () => {
      await markStaleBoardStateValidationResults(
        snapshot.deckId,
        snapshot.checksum ?? "",
      );
      const latest = await getLatestBoardStateValidationResult(snapshot.deckId);
      if (!active) {
        return;
      }
      const derived = latest ? withBoardStateStaleState(latest, snapshot) : null;
      setLatestResult(derived);
      if (derived) {
        setMessage(boardStateResultLabel(derived));
      }
    })();

    return () => {
      active = false;
    };
  }, [snapshot]);

  async function validateWithBoardState(): Promise<void> {
    if (!snapshot || pending) {
      return;
    }

    setPending(true);
    setMessage("Validating with BoardState...");
    try {
      const run = await validateDeckSnapshotWithBoardState({
        snapshot,
        transport: resolvedTransport,
      });
      const saved = await saveBoardStateValidationResult(run.record);
      const derived = withBoardStateStaleState(saved, snapshot);
      setLatestResult(derived);
      setMessage(boardStateResultLabel(derived));
    } finally {
      setPending(false);
    }
  }

  const displayResult = latestResult ?? undefined;
  const issues = displayResult
    ? [
        ...displayResult.issues,
        ...displayResult.warnings,
        ...displayResult.informationalFindings,
      ]
    : [];

  return (
    <section className="settings-section" aria-labelledby="boardstate-validation-heading">
      <div className="section-heading-row">
        <h2 id="boardstate-validation-heading">BoardState Validation</h2>
        <StatusPill tone={boardStateResultTone(displayResult)}>
          {displayResult?.authoritative ? "Authoritative" : "Not Connected"}
        </StatusPill>
      </div>
      <p className="settings-note">
        Deck Nexus local planning guidance remains separate from authoritative
        BoardState validation. BoardState results are stored as non-destructive
        validation records tied to the exact snapshot checksum.
      </p>
      <p className="settings-note" role="status">
        {pending ? "Validating with BoardState..." : message}
      </p>
      {bridgeStatus?.testOnly ? (
        <p className="settings-note">
          Test adapter active for automated tests only. This is not a live
          BoardState connection.
        </p>
      ) : null}
      {displayResult?.stale || displayResult?.status === "stale" ? (
        <p className="settings-note">
          Deck changed since BoardState validation. Validate again.
        </p>
      ) : null}
      {displayResult?.authoritative ? (
        <dl className="detail-list">
          <div>
            <dt>Rules version</dt>
            <dd>{displayResult.rulesVersion ?? "Unknown"}</dd>
          </div>
          <div>
            <dt>Validated</dt>
            <dd>{displayResult.validatedAt ?? "Unknown"}</dd>
          </div>
          <div>
            <dt>Snapshot</dt>
            <dd>{displayResult.snapshotChecksum}</dd>
          </div>
        </dl>
      ) : null}
      {issues.length > 0 ? (
        <ul className="status-list" aria-label="BoardState validation findings">
          {issues.map((issue) => (
            <li key={issue.issueId}>
              <strong>{issue.title}</strong>
              <span>{issue.message}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="form-actions">
        <button
          type="button"
          onClick={() => void validateWithBoardState()}
          disabled={!snapshot || pending}
        >
          {pending ? "Validating..." : "Validate with BoardState"}
        </button>
      </div>
    </section>
  );
}
