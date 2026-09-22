import type { FrameAnalysis } from "./frameAnalysis";
import { detectScannerCard, type ScannerCardDetection } from "./scannerDetection";
import { enhanceScannerCanvas } from "./scannerEnhancement";
import { normalizeScannerCard, type ScannerNormalizedCard } from "./scannerPerspective";

export type ScannerPipelineStage =
  | "camera"
  | "detection"
  | "perspective"
  | "enhancement"
  | "quality"
  | "recognition"
  | "matching"
  | "confidence"
  | "duplicate"
  | "batch"
  | "review";

export interface ScannerPipelinePreparation {
  detection: ScannerCardDetection;
  normalized: ScannerNormalizedCard;
  recognitionCanvas: HTMLCanvasElement;
  enhancedCanvas: HTMLCanvasElement;
  stages: readonly ScannerPipelineStage[];
}

/** Adapter boundary for future local vision/OCR engines. The live pipeline only
 * depends on the evidence contract, so a worker or native-backed provider can
 * replace the current OCR implementation without changing camera or batching. */
export interface ScannerStageAdapter<Input, Output> {
  readonly stage: ScannerPipelineStage;
  run(input: Input, signal?: AbortSignal): Promise<Output>;
}

export interface ScannerRecognitionEngine<Input, Output> extends ScannerStageAdapter<Input, Output> {
  readonly stage: "recognition";
}

export function prepareScannerRecognition(
  sourceCanvas: HTMLCanvasElement,
  analysis: FrameAnalysis,
): ScannerPipelinePreparation | undefined {
  const detection = detectScannerCard(analysis);
  if (!detection.visible || !detection.quadrilateral) return undefined;
  const normalized = normalizeScannerCard(sourceCanvas, detection.quadrilateral);
  const enhancedCanvas = enhanceScannerCanvas(normalized.canvas);
  return {
    detection,
    normalized,
    recognitionCanvas: normalized.canvas,
    enhancedCanvas,
    stages: ["camera", "detection", "perspective", "enhancement", "quality", "recognition", "matching", "confidence", "duplicate", "batch", "review"],
  };
}
