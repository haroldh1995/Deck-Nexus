import { localCardCatalog, type CatalogCard } from "../../data/cardCatalog";
import type {
  ScanBatch,
  ScanBatchDestination,
  ScannerMode,
  ScanRecord,
  ScanRecordStatus,
} from "../../types/domain";
import { createId, nowIso } from "../../utils/ids";
import type { ScannerResolvedCard } from "./scannerRecognition";

export type AutomaticFeederState =
  | "idle"
  | "card_entering_frame"
  | "card_stable"
  | "capture_candidate"
  | "resolve_candidate"
  | "add_to_batch_queue"
  | "wait_for_card_removal"
  | "ready_for_next";

export type StackingFeederState =
  | "idle_watching_tray"
  | "too_close_distortion_detected"
  | "new_card_arrival_cue"
  | "wait_for_stabilization"
  | "capture_newest_visible_card"
  | "resolve_card"
  | "add_result_to_batch_queue"
  | "ignore_duplicate_frames"
  | "wait_for_next_too_close_cue"
  | "paused_tray_full";

export interface ScannerCycle {
  mode: ScannerMode;
  automaticState?: AutomaticFeederState;
  stackingState?: StackingFeederState;
  cue?: "card_entered" | "stable" | "captured" | "resolved" | "removed" | "too_close" | "timeout";
  warning?: string;
  shouldCapture: boolean;
  shouldPause: boolean;
}

export const scannerModes: { id: ScannerMode; label: string; detail: string }[] = [
  {
    id: "owned",
    label: "Scan to Owned Cards",
    detail: "Confirmed cards update the local ownership registry.",
  },
  {
    id: "deck",
    label: "Scan Directly Into Deck",
    detail: "Resolved cards are reviewed before entering the active Commander deck.",
  },
  {
    id: "section",
    label: "Scan Into Section",
    detail: "Use a section destination while still checking placement and color identity.",
  },
  {
    id: "batch",
    label: "Batch Scan",
    detail: "Continuous scanning with all confirmations handled at review time.",
  },
  {
    id: "correction",
    label: "Correction Mode",
    detail: "Resolve low-confidence or unresolved scan records.",
  },
  {
    id: "automatic_feeder",
    label: "Automatic Feeder Mode",
    detail: "Waits for card entry, stability, capture, resolution, and removal.",
  },
  {
    id: "stacking_feeder",
    label: "Stacking Feeder Mode",
    detail: "Uses too-close distortion as the new-card cue and never requires removal detection.",
  },
];

export const scannerDestinations: { id: ScanBatchDestination; label: string }[] = [
  { id: "owned_cards", label: "Owned Cards" },
  { id: "current_deck", label: "Current Deck" },
  { id: "main_deck", label: "Main Deck" },
  { id: "maybeboard", label: "Maybeboard" },
  { id: "cuts", label: "Cuts" },
  { id: "extras_tokens", label: "Extras / Tokens" },
  { id: "new_deck", label: "New Deck" },
  { id: "new_list", label: "New List" },
  { id: "existing_list", label: "Existing List" },
  { id: "custom_collection", label: "Custom Collection" },
];

export const frameGuidanceText = [
  "Place card fully inside frame.",
  "Align edges.",
  "Avoid glare.",
  "Hold steady.",
  "Good lighting.",
  "Avoid overlapping cards.",
  "Keep flat.",
];

export const scannerFeedbackStates = [
  "Too dark",
  "Too blurry",
  "Too much glare",
  "Move closer/farther",
  "Hold steady",
  "Card not fully inside",
  "Multiple cards detected",
  "Shadow crossing card",
  "Sleeve glare",
  "Card edge hidden",
  "Lighting uneven",
];

export function nextAutomaticFeederCycle(
  current: AutomaticFeederState,
  cue: ScannerCycle["cue"],
): ScannerCycle {
  const transition: Record<AutomaticFeederState, AutomaticFeederState> = {
    idle: "card_entering_frame",
    card_entering_frame: "card_stable",
    card_stable: "capture_candidate",
    capture_candidate: "resolve_candidate",
    resolve_candidate: "add_to_batch_queue",
    add_to_batch_queue: "wait_for_card_removal",
    wait_for_card_removal: "ready_for_next",
    ready_for_next: "idle",
  };
  const tooFast = current === "card_entering_frame" && cue === "captured";
  const nextState = tooFast ? "card_entering_frame" : transition[current];

  return {
    mode: "automatic_feeder",
    automaticState: nextState,
    cue,
    warning: tooFast
      ? "Card moving too fast. Slow feeder slightly and increase pause time between cards."
      : undefined,
    shouldCapture: nextState === "capture_candidate",
    shouldPause: false,
  };
}

export function nextStackingFeederCycle({
  current,
  tooCloseDurationMs,
  cue,
  timeoutMs = 4200,
}: {
  current: StackingFeederState;
  tooCloseDurationMs: number;
  cue: ScannerCycle["cue"];
  timeoutMs?: number;
}): ScannerCycle {
  if (cue === "timeout" || tooCloseDurationMs >= timeoutMs) {
    return {
      mode: "stacking_feeder",
      stackingState: "paused_tray_full",
      cue: "timeout",
      warning: "Tray may be full. Empty the catch tray, then resume scanning.",
      shouldCapture: false,
      shouldPause: true,
    };
  }

  if (cue === "too_close") {
    return {
      mode: "stacking_feeder",
      stackingState: "new_card_arrival_cue",
      cue,
      shouldCapture: false,
      shouldPause: false,
    };
  }

  const transition: Record<StackingFeederState, StackingFeederState> = {
    idle_watching_tray: "too_close_distortion_detected",
    too_close_distortion_detected: "new_card_arrival_cue",
    new_card_arrival_cue: "wait_for_stabilization",
    wait_for_stabilization: "capture_newest_visible_card",
    capture_newest_visible_card: "resolve_card",
    resolve_card: "add_result_to_batch_queue",
    add_result_to_batch_queue: "ignore_duplicate_frames",
    ignore_duplicate_frames: "wait_for_next_too_close_cue",
    wait_for_next_too_close_cue: "idle_watching_tray",
    paused_tray_full: "idle_watching_tray",
  };
  const nextState = transition[current];

  return {
    mode: "stacking_feeder",
    stackingState: nextState,
    cue,
    shouldCapture: nextState === "capture_newest_visible_card",
    shouldPause: false,
  };
}

export function createScannerBatch({
  mode,
  destination,
  deckId,
  sectionId,
}: {
  mode: ScannerMode;
  destination: ScanBatchDestination;
  deckId?: string;
  sectionId?: string;
}): ScanBatch {
  const now = nowIso();

  return {
    id: createId("scan-batch"),
    name: `${scannerModes.find((scannerMode) => scannerMode.id === mode)?.label ?? "Scan Batch"} ${new Date().toLocaleString()}`,
    status: "scanning",
    mode,
    destination,
    deckId,
    sectionId,
    recordsCreated: 0,
    persistenceEnabled: true,
    createdAt: now,
    updatedAt: now,
  };
}

export function createScanRecordFromCard({
  batchId,
  card,
  status = "assumed",
  confidence = 0.82,
  destination,
}: {
  batchId: string;
  card: CatalogCard;
  status?: ScanRecordStatus;
  confidence?: number;
  destination?: ScanBatchDestination;
}): ScanRecord {
  const now = nowIso();

  return {
    id: createId("scan-record"),
    batchId,
    rawText: `${card.name} ${card.typeLine}`,
    scryfallId: card.scryfallId,
    oracleId: card.oracleId,
    name: card.name,
    quantity: 1,
    status,
    confidence,
    possibleMatches: [card.name],
    typeLine: card.typeLine,
    colorIdentity: card.colorIdentity,
    destination,
    extraKind: card.extraKind,
    createdAt: now,
    updatedAt: now,
  };
}

export function createScanRecordFromResolvedCard({
  batchId,
  result,
}: {
  batchId: string;
  result: ScannerResolvedCard;
}): ScanRecord {
  const now = nowIso();

  return {
    id: createId("scan-record"),
    batchId,
    rawText: result.rawText,
    scryfallId: result.scryfallId,
    oracleId: result.oracleId,
    name: result.name,
    quantity: result.quantity,
    status: result.status,
    confidence: result.confidence,
    possibleMatches: result.possibleMatches,
    typeLine: result.typeLine,
    colorIdentity: result.colorIdentity,
    destination: result.destination,
    setCode: result.setCode,
    setName: result.setName,
    collectorNumber: result.collectorNumber,
    imageUri: result.imageUri,
    capturedThumbnail: result.capturedThumbnail,
    frameFingerprint: result.frameFingerprint,
    matchSource: result.matchSource,
    scannerWarnings: result.scannerWarnings,
    createdAt: now,
    updatedAt: now,
  };
}

export function getSimulatedScanCard(index: number): CatalogCard {
  const scanPool = localCardCatalog.filter((card) => !card.isCommanderCandidate);
  return scanPool[index % scanPool.length];
}

export function summarizeBatchRecords(records: readonly ScanRecord[]) {
  const confirmed = records.filter((record) => record.status === "confirmed").length;
  const assumed = records.filter((record) => record.status === "assumed").length;
  const lowConfidence = records.filter((record) => record.status === "low_confidence").length;
  const unresolved = records.filter((record) => record.status === "unresolved").length;

  return {
    total: records.length,
    confirmed,
    assumed,
    lowConfidence,
    unresolved,
    actionable: confirmed + assumed + lowConfidence,
  };
}

export function batchNeedsPersistencePrompt(batch?: ScanBatch): boolean {
  if (!batch) {
    return false;
  }

  return [
    "scanning",
    "paused",
    "needs_review",
    "reviewing",
    "partially_applied",
    "saved_for_later",
  ].includes(batch.status);
}
