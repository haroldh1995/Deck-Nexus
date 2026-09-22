import type { FrameAnalysis, FrameCandidate } from "./frameAnalysis";

export interface ScannerCardCorner {
  x: number;
  y: number;
}

export interface ScannerCardQuadrilateral {
  topLeft: ScannerCardCorner;
  topRight: ScannerCardCorner;
  bottomRight: ScannerCardCorner;
  bottomLeft: ScannerCardCorner;
}

export type ScannerQualityClass = "ideal" | "acceptable" | "degraded" | "unusable";

export interface ScannerCardDetection {
  visible: boolean;
  quadrilateral?: ScannerCardQuadrilateral;
  coverage: number;
  aspectRatio: number;
  boundaryConfidence: number;
  qualityClass: ScannerQualityClass;
  usableForRecognition: boolean;
  clipped: boolean;
}

function quadFromCandidate(
  candidate: FrameCandidate | undefined,
  sourceWidth: number,
  sourceHeight: number,
  analysisWidth: number,
  analysisHeight: number,
): ScannerCardQuadrilateral | undefined {
  if (!candidate) return undefined;
  const scaleX = sourceWidth / Math.max(analysisWidth, 1);
  const scaleY = sourceHeight / Math.max(analysisHeight, 1);
  return {
    topLeft: { x: candidate.x * scaleX, y: candidate.y * scaleY },
    topRight: { x: (candidate.x + candidate.width) * scaleX, y: candidate.y * scaleY },
    bottomRight: { x: (candidate.x + candidate.width) * scaleX, y: (candidate.y + candidate.height) * scaleY },
    bottomLeft: { x: candidate.x * scaleX, y: (candidate.y + candidate.height) * scaleY },
  };
}

export function detectScannerCard(analysis: FrameAnalysis, sourceWidth = analysis.analysisWidth, sourceHeight = analysis.analysisHeight): ScannerCardDetection {
  return {
    visible: analysis.candidateVisible,
    quadrilateral: quadFromCandidate(analysis.candidate, sourceWidth, sourceHeight, analysis.analysisWidth, analysis.analysisHeight),
    coverage: analysis.candidateCoverage,
    aspectRatio: analysis.candidate?.aspectRatio ?? 0,
    boundaryConfidence: analysis.boundaryConfidence,
    qualityClass: analysis.qualityClass,
    usableForRecognition: analysis.usableForRecognition,
    clipped: analysis.clipped,
  };
}
