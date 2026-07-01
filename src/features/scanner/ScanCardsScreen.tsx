import { useCallback, useEffect, useMemo, useState } from "react";
import { Camera, CheckCircle2, Pause, Play, RotateCcw, ScanLine, ShieldAlert, Trash2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { HolographicPanel } from "../../components/HolographicPanel";
import { PageHeader } from "../../components/PageHeader";
import { StatusPill } from "../../components/StatusPill";
import { useDecks } from "../../db/hooks";
import {
  addDeckCard,
  addScanRecord,
  applyScanBatchToOwned,
  getScanBatch,
  getRecoverableScanBatch,
  listScanRecords,
  saveScanBatch,
  updateScanBatch,
  updateScanRecord,
} from "../../db/repositories";
import type { ScanBatch, ScanBatchDestination, ScannerMode, ScanRecord } from "../../types/domain";
import { catalogCardToManualInput } from "../cards/cardSearch";
import { evaluateAddCardRules } from "../decks/commanderRules";
import {
  batchNeedsPersistencePrompt,
  createScanRecordFromCard,
  createScannerBatch,
  frameGuidanceText,
  getSimulatedScanCard,
  nextAutomaticFeederCycle,
  nextStackingFeederCycle,
  scannerDestinations,
  scannerFeedbackStates,
  scannerModes,
  summarizeBatchRecords,
  type AutomaticFeederState,
  type StackingFeederState,
} from "./scannerEngine";

export function ScanCardsScreen() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { decks } = useDecks();
  const [mode, setMode] = useState<ScannerMode>(
    (searchParams.get("mode") as ScannerMode | null) ?? "batch",
  );
  const [destination, setDestination] = useState<ScanBatchDestination>(
    searchParams.get("section") ? "main_deck" : "owned_cards",
  );
  const [deckId, setDeckId] = useState(searchParams.get("deckId") ?? "");
  const [sectionId] = useState(searchParams.get("section") ?? "");
  const [batch, setBatch] = useState<ScanBatch | null>(null);
  const [records, setRecords] = useState<ScanRecord[]>([]);
  const [message, setMessage] = useState("Scanner ready. Camera preview can be connected later; simulation is active now.");
  const [scanIndex, setScanIndex] = useState(0);
  const [automaticState, setAutomaticState] = useState<AutomaticFeederState>("idle");
  const [stackingState, setStackingState] = useState<StackingFeederState>("idle_watching_tray");
  const [tooCloseDuration, setTooCloseDuration] = useState(0);
  const [showRecovery, setShowRecovery] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const deck = decks.find((candidate) => candidate.id === deckId);
  const summary = useMemo(() => summarizeBatchRecords(records), [records]);

  const refreshRecords = useCallback(async (batchId: string) => {
    setRecords(await listScanRecords(batchId));
  }, []);

  useEffect(() => {
    let mounted = true;

    async function recoverBatch() {
      const requestedBatchId = searchParams.get("batchId");
      if (requestedBatchId) {
        const requestedBatch = await getScanBatch(requestedBatchId);
        if (mounted && requestedBatch) {
          setBatch(requestedBatch);
          setMode(requestedBatch.mode ?? "batch");
          setDestination(requestedBatch.destination ?? "owned_cards");
          setDeckId(requestedBatch.deckId ?? searchParams.get("deckId") ?? "");
          await refreshRecords(requestedBatch.id);
          setReviewOpen(searchParams.get("review") === "1");
          setShowRecovery(false);
          return;
        }
      }

      const recoverable = await getRecoverableScanBatch();
      if (mounted && recoverable) {
        setBatch(recoverable);
        setMode(recoverable.mode ?? "batch");
        setDestination(recoverable.destination ?? "owned_cards");
        setDeckId(recoverable.deckId ?? searchParams.get("deckId") ?? "");
        await refreshRecords(recoverable.id);
        setShowRecovery(true);
      }
    }

    void recoverBatch();
    return () => {
      mounted = false;
    };
  }, [refreshRecords, searchParams]);

  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (batchNeedsPersistencePrompt(batch ?? undefined)) {
        event.preventDefault();
        event.returnValue = "";
      }
    }

    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [batch]);

  async function startBatch(nextStatus: ScanBatch["status"] = "scanning") {
    const nextBatch = createScannerBatch({
      mode,
      destination,
      deckId: deckId || undefined,
      sectionId: sectionId || undefined,
    });
    const saved = await saveScanBatch({ ...nextBatch, status: nextStatus });
    setBatch(saved);
    setRecords([]);
    setReviewOpen(false);
    setShowRecovery(false);
    setMessage("Persistent scan batch started. Records will remain until applied, saved, or discarded.");
  }

  async function simulateScan(status: ScanRecord["status"] = "assumed", confidence = 0.82) {
    const activeBatch = batch ?? (await saveScanBatch(createScannerBatch({ mode, destination, deckId: deckId || undefined, sectionId })));
    if (!batch) {
      setBatch(activeBatch);
    }

    const card = getSimulatedScanCard(scanIndex);
    const record = createScanRecordFromCard({
      batchId: activeBatch.id,
      card,
      status,
      confidence,
      destination,
    });
    await addScanRecord(record);
    setScanIndex((current) => current + 1);
    await refreshRecords(activeBatch.id);
    setMessage(`${card.name} added to batch as ${status.replace("_", " ")}.`);
  }

  async function runAutomaticCycle() {
    const cycle = nextAutomaticFeederCycle(automaticState, "stable");
    const nextState = cycle.automaticState ?? "idle";
    setAutomaticState(nextState);
    if (cycle.warning) {
      setMessage(cycle.warning);
    } else {
      setMessage(`Automatic feeder: ${nextState.replaceAll("_", " ")}.`);
    }
    if (cycle.shouldCapture) {
      await simulateScan("assumed", 0.84);
    }
  }

  async function runStackingCue() {
    const cycle = nextStackingFeederCycle({
      current: stackingState,
      cue: "too_close",
      tooCloseDurationMs: tooCloseDuration,
    });
    setStackingState(cycle.stackingState ?? "idle_watching_tray");
    setTooCloseDuration((current) => current + 900);
    setMessage("Too-close cue detected. New card arrival registered for stacking feeder mode.");
  }

  async function runStackingStabilize() {
    const cycle = nextStackingFeederCycle({
      current: stackingState,
      cue: "stable",
      tooCloseDurationMs: 0,
    });
    setStackingState(cycle.stackingState ?? "idle_watching_tray");
    setTooCloseDuration(0);
    setMessage(`Stacking feeder: ${(cycle.stackingState ?? "").replaceAll("_", " ")}.`);
    if (cycle.shouldCapture) {
      await simulateScan("assumed", 0.78);
    }
  }

  async function triggerTrayFull() {
    const cycle = nextStackingFeederCycle({
      current: stackingState,
      cue: "timeout",
      tooCloseDurationMs: 6000,
    });
    const updated = batch ? await updateScanBatch(batch.id, { status: "paused", prompt: cycle.warning }) : null;
    if (updated) {
      setBatch(updated);
    }
    setStackingState("paused_tray_full");
    setMessage(cycle.warning ?? "Tray may be full. Empty the catch tray, then resume scanning.");
  }

  async function confirmAllHighConfidence() {
    for (const record of records.filter((candidate) => (candidate.confidence ?? 0) >= 0.8)) {
      await updateScanRecord(record.id, { status: "confirmed" });
    }
    if (batch) {
      await updateScanBatch(batch.id, { status: "reviewing" });
      await refreshRecords(batch.id);
    }
    setMessage("All high-confidence records confirmed for review.");
  }

  async function applyToOwned() {
    if (!batch) {
      return;
    }

    const count = await applyScanBatchToOwned(batch.id);
    await refreshRecords(batch.id);
    setBatch(await updateScanBatch(batch.id, { status: "applied" }));
    setMessage(`${count} scan records applied to Owned Cards.`);
  }

  async function applyToDeck(destinationOverride: "main" | "maybeboard" | "cuts") {
    if (!deck || !batch) {
      setMessage("Choose a deck before applying scanner records to a deck.");
      return;
    }

    let applied = 0;
    for (const record of records.filter((candidate) => ["confirmed", "assumed", "matched"].includes(candidate.status))) {
      const input = catalogCardToManualInput({
        card: {
          id: record.scryfallId ?? record.id,
          scryfallId: record.scryfallId ?? record.id,
          oracleId: record.oracleId ?? record.id,
          name: record.name,
          manaCost: undefined,
          manaValue: 0,
          typeLine: record.typeLine ?? "Creature",
          oracleText: record.rawText,
          colorIdentity: record.colorIdentity ?? [],
          keywords: [],
          roles: ["scanner"],
          commanderLegal: true,
          banned: false,
          bracketImpact: 0,
        },
        destination: destinationOverride,
        requestedSection:
          sectionId === "creatures" ||
          sectionId === "instants" ||
          sectionId === "sorceries" ||
          sectionId === "artifacts" ||
          sectionId === "enchantments" ||
          sectionId === "otherPermanents" ||
          sectionId === "lands"
            ? sectionId
            : undefined,
      });
      const ruleResult = evaluateAddCardRules({ deck, input, mode: "guided" });
      if (destinationOverride === "main" && ruleResult.warnings.some((warning) => warning.severity === "illegal")) {
        await addDeckCard(deck.id, { ...input, destination: "maybeboard" }, "maybeboard");
      } else {
        await addDeckCard(deck.id, input, destinationOverride);
      }
      await updateScanRecord(record.id, { status: "applied" });
      applied += 1;
    }

    await updateScanBatch(batch.id, {
      status: "partially_applied",
      destination: destinationOverride === "main" ? "main_deck" : destinationOverride,
    });
    await refreshRecords(batch.id);
    setMessage(`${applied} records applied to ${destinationOverride}. Illegal main-deck cards were routed to Maybeboard.`);
  }

  async function saveForLater() {
    if (!batch) {
      return;
    }

    const saved = await updateScanBatch(batch.id, { status: "saved_for_later" });
    setBatch(saved);
    setMessage("Batch saved for later. It will be recovered when scanner opens again.");
  }

  async function discardBatch() {
    if (!batch) {
      return;
    }

    const discarded = await updateScanBatch(batch.id, { status: "discarded" });
    setBatch(discarded);
    setRecords([]);
    setMessage("Batch discarded by user.");
  }

  return (
    <section className="screen feature-screen scanner-screen">
      <PageHeader title="Scan Cards">
        <StatusPill tone="cyan">Persistent Batch Scanner</StatusPill>
      </PageHeader>

      {showRecovery && batch ? (
        <HolographicPanel className="scanner-recovery">
          <ShieldAlert aria-hidden="true" />
          <div>
            <h2>Unfinished scan batch found</h2>
            <p>Resume scanning, review batch, save for later, or discard.</p>
          </div>
          <button type="button" onClick={() => setShowRecovery(false)}>
            Resume
          </button>
          <button type="button" onClick={() => setReviewOpen(true)}>
            Review
          </button>
          <button type="button" onClick={saveForLater}>
            Save for Later
          </button>
          <button type="button" onClick={discardBatch}>
            Discard
          </button>
        </HolographicPanel>
      ) : null}

      <div className="scanner-layout">
        <HolographicPanel className="scanner-preview">
          <div className="scanner-frame" aria-label="Scanner camera preview simulation">
            <Camera aria-hidden="true" />
            <span className="scanner-frame__corner scanner-frame__corner--one" />
            <span className="scanner-frame__corner scanner-frame__corner--two" />
            <span className="scanner-frame__corner scanner-frame__corner--three" />
            <span className="scanner-frame__corner scanner-frame__corner--four" />
            <strong>{mode === "stacking_feeder" ? "Stacking tray watch" : "Card frame guidance"}</strong>
            <small>Plain background optional. Playmats, sleeves, tables, binders, and patterned surfaces are expected.</small>
          </div>
          <div className="scanner-guidance">
            {frameGuidanceText.map((text) => (
              <span key={text}>{text}</span>
            ))}
          </div>
        </HolographicPanel>

        <HolographicPanel className="scanner-controls-panel">
          <div className="feature-controls">
            <label>
              Scanner mode
              <select value={mode} onChange={(event) => setMode(event.target.value as ScannerMode)}>
                {scannerModes.map((scannerMode) => (
                  <option key={scannerMode.id} value={scannerMode.id}>
                    {scannerMode.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Batch destination
              <select
                value={destination}
                onChange={(event) => setDestination(event.target.value as ScanBatchDestination)}
              >
                {scannerDestinations.map((scannerDestination) => (
                  <option key={scannerDestination.id} value={scannerDestination.id}>
                    {scannerDestination.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Active deck
              <select value={deckId} onChange={(event) => setDeckId(event.target.value)}>
                <option value="">No deck selected</option>
                {decks.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="feature-status" role="status">
            <ScanLine aria-hidden="true" />
            <span>{message}</span>
          </div>

          <div className="scanner-actions">
            <button type="button" onClick={() => startBatch()}>
              <Play aria-hidden="true" /> Start Batch
            </button>
            <button type="button" onClick={() => simulateScan("assumed", 0.82)}>
              Simulate Scan
            </button>
            <button type="button" onClick={() => simulateScan("low_confidence", 0.48)}>
              Low Confidence Scan
            </button>
            <button type="button" onClick={() => batch && updateScanBatch(batch.id, { status: "paused" }).then(setBatch)}>
              <Pause aria-hidden="true" /> Pause
            </button>
            <button type="button" onClick={() => setReviewOpen(true)}>
              Review Batch
            </button>
          </div>

          <div className="scanner-mode-panel">
            {mode === "automatic_feeder" ? (
              <>
                <h2>Automatic Feeder Loop</h2>
                <p>Idle → entering → stable → capture → resolve → queue → wait for removal → ready.</p>
                <button type="button" onClick={runAutomaticCycle}>
                  Advance Feeder Cycle
                </button>
                <span>{automaticState.replaceAll("_", " ")}</span>
              </>
            ) : null}
            {mode === "stacking_feeder" ? (
              <>
                <h2>Stacking Feeder Loop</h2>
                <p>Too-close distortion is the new-card cue. Removal detection is not required.</p>
                <button type="button" onClick={runStackingCue}>
                  Too-Close Cue
                </button>
                <button type="button" onClick={runStackingStabilize}>
                  Stabilize / Capture
                </button>
                <button type="button" onClick={triggerTrayFull}>
                  Trigger Tray Full Prompt
                </button>
                <span>{stackingState.replaceAll("_", " ")}</span>
              </>
            ) : null}
          </div>
        </HolographicPanel>
      </div>

      <HolographicPanel className="scanner-batch-panel">
        <div className="scanner-batch-summary">
          <strong>{summary.total} records</strong>
          <span>{summary.confirmed} confirmed</span>
          <span>{summary.assumed} assumed</span>
          <span>{summary.lowConfidence} low confidence</span>
          <span>{summary.unresolved} unresolved</span>
        </div>
        <div className="scanner-feedback-list">
          {scannerFeedbackStates.map((feedback) => (
            <span key={feedback}>{feedback}</span>
          ))}
        </div>
      </HolographicPanel>

      {reviewOpen ? (
        <div className="builder-modal-backdrop" role="presentation">
          <div className="builder-modal scanner-review-modal" role="dialog" aria-modal="true" aria-label="Batch Review">
            <div className="builder-modal__header">
              <h2>Batch Review</h2>
              <button type="button" onClick={() => setReviewOpen(false)} aria-label="Close batch review">
                x
              </button>
            </div>
            <div className="scanner-review-actions">
              <button type="button" onClick={confirmAllHighConfidence}>
                <CheckCircle2 aria-hidden="true" /> Confirm All High Confidence
              </button>
              <button type="button" onClick={() => setMessage("Assumed-only review filter active in batch review.")}>
                Review Assumed Only
              </button>
              <button type="button" onClick={applyToOwned}>
                Apply All Confirmed to Owned
              </button>
              <button type="button" onClick={() => applyToDeck("main")}>
                Apply to Main
              </button>
              <button type="button" onClick={() => applyToDeck("maybeboard")}>
                Apply to Maybeboard
              </button>
              <button type="button" onClick={saveForLater}>
                Save Unresolved for Later
              </button>
              <button type="button" onClick={discardBatch}>
                <Trash2 aria-hidden="true" /> Undo Batch
              </button>
            </div>
            <div className="scanner-record-list">
              {records.length === 0 ? (
                <p className="foundation-summary">No scan records in this batch yet.</p>
              ) : (
                records.map((record) => (
                  <article className="scanner-record" key={record.id}>
                    <div>
                      <strong>{record.name}</strong>
                      <span>{record.typeLine ?? "Type pending"} · {Math.round((record.confidence ?? 0) * 100)}%</span>
                    </div>
                    <span className="badge">{record.status}</span>
                    <button type="button" onClick={() => updateScanRecord(record.id, { status: "confirmed" }).then(() => refreshRecords(record.batchId))}>
                      Confirm
                    </button>
                    <button type="button" onClick={() => updateScanRecord(record.id, { status: "removed" }).then(() => refreshRecords(record.batchId))}>
                      Remove
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/search?context=scanner&batchId=${record.batchId}&recordId=${record.id}&q=${encodeURIComponent(record.name)}`,
                        )
                      }
                    >
                      Correct with Search
                    </button>
                  </article>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {batch?.prompt ? (
        <HolographicPanel className="scanner-tray-prompt">
          <ShieldAlert aria-hidden="true" />
          <p>{batch.prompt}</p>
          <button type="button" onClick={() => updateScanBatch(batch.id, { status: "scanning", prompt: undefined }).then(setBatch)}>
            Resume Scanning
          </button>
          <button type="button" onClick={() => updateScanBatch(batch.id, { status: "scanning", prompt: undefined }).then(setBatch)}>
            <RotateCcw aria-hidden="true" /> Empty Tray Done
          </button>
          <button type="button" onClick={() => setReviewOpen(true)}>
            Review Batch
          </button>
          <button type="button" onClick={saveForLater}>
            Stop Batch
          </button>
        </HolographicPanel>
      ) : null}
    </section>
  );
}
