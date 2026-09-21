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
  evidence?: ObservedCardEvidence;
  query?: string;
  match?: ScannerMatchResult;
  finalCardIdentity?: string;
  finalPrintingIdentity?: string;
  cardIdentityConfidence?: number;
  printingIdentityConfidence?: number;
  batchEntryId?: string;
}

let latestTrace: ScannerRecognitionTrace | undefined;

export function recordScannerTrace(trace: ScannerRecognitionTrace): void {
  if (!import.meta.env.DEV) return;
  latestTrace = structuredClone(trace);
}

export function getLatestScannerTrace(): ScannerRecognitionTrace | undefined {
  if (!import.meta.env.DEV) return undefined;
  return latestTrace ? structuredClone(latestTrace) : undefined;
}

export function ownershipToTrace(ownership: ScannerRecognitionOwnership): Pick<ScannerRecognitionTrace, "scanSessionId" | "batchId" | "targetId" | "captureGeneration" | "frameId" | "recognitionJobId"> {
  return ownership;
}
