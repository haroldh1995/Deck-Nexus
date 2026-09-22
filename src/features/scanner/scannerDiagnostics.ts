import type { FrameAnalysis } from "./frameAnalysis";
import type { ScannerRecognitionOwnership } from "./scannerLifecycle";
import type { ObservedCardEvidence, ScannerMatchResult } from "./scannerMatching";

export interface ScannerRecognitionTrace {
  scanSessionId: string;
  batchId?: string;
  targetId?: string;
  captureGeneration?: number;
  frameId?: number;
  recognitionJobId?: string;
  videoIntrinsic?: { width: number; height: number };
  videoDisplay?: { width: number; height: number };
  frame?: FrameAnalysis;
  pipelineStages?: string[];
  evidence?: ObservedCardEvidence;
  query?: string;
  match?: ScannerMatchResult;
  finalCardIdentity?: string;
  finalPrintingIdentity?: string;
  cardIdentityConfidence?: number;
  printingIdentityConfidence?: number;
  batchEntryId?: string;
  transitions?: ScannerTransitionDiagnostic[];
}

export interface ScannerTransitionDiagnostic {
  scanSessionId: string;
  state: string;
  requestedState: string;
  accepted: boolean;
  reason: string;
  timestamp: number;
  batchId?: string;
  targetId?: string;
  captureGeneration?: number;
  frameId?: number;
  targetAgeMs?: number;
  detectionConfidence?: number;
  geometryConfidence?: number;
  stabilityMs?: number;
  qualityClass?: string;
  cardCoverage?: number;
  tooClose?: boolean;
  bestFrameAvailable?: boolean;
  recognitionJobState?: string;
  terminalBudgetMs?: number;
}

let latestTrace: ScannerRecognitionTrace | undefined;
let latestTransitions: ScannerTransitionDiagnostic[] = [];
let latestTransitionSession: string | undefined;

export function recordScannerTrace(trace: ScannerRecognitionTrace): void {
  if (!import.meta.env.DEV) return;
  latestTrace = structuredClone({ ...trace, transitions: latestTransitions });
}

export function getLatestScannerTrace(): ScannerRecognitionTrace | undefined {
  if (!import.meta.env.DEV) return undefined;
  if (!latestTrace && latestTransitions.length > 0) {
    return {
      scanSessionId: latestTransitions[latestTransitions.length - 1].scanSessionId,
      transitions: structuredClone(latestTransitions),
    };
  }
  return latestTrace
    ? structuredClone({ ...latestTrace, transitions: latestTransitions })
    : undefined;
}

export function recordScannerTransition(transition: ScannerTransitionDiagnostic): void {
  if (!import.meta.env.DEV) return;
  if (latestTransitionSession !== transition.scanSessionId) {
    latestTransitionSession = transition.scanSessionId;
    latestTransitions = [];
  }
  latestTransitions.push(structuredClone(transition));
  if (latestTransitions.length > 256) latestTransitions.shift();
}

export function ownershipToTrace(ownership: ScannerRecognitionOwnership): Pick<ScannerRecognitionTrace, "scanSessionId" | "batchId" | "targetId" | "captureGeneration" | "frameId" | "recognitionJobId"> {
  return ownership;
}
