export interface FrameCandidate {
  x: number;
  y: number;
  width: number;
  height: number;
  coverage: number;
  aspectRatio: number;
}

export interface FrameAnalysis {
  timestamp: number;
  analysisWidth: number;
  analysisHeight: number;
  candidateVisible: boolean;
  tooClose: boolean;
  candidateCoverage: number;
  clipped: boolean;
  boundaryConfidence: number;
  sharpness: number;
  lighting: number;
  glare: number;
  stable: boolean;
  stableForMs: number;
  usableForRecognition: boolean;
  qualityClass: "ideal" | "acceptable" | "degraded" | "unusable";
  feedback: string;
  fingerprint: string;
  candidate?: FrameCandidate;
}

export interface FrameAnalyzerMemory {
  lastFingerprint?: string;
  lastCandidate?: FrameCandidate;
  stableSince?: number;
}

export interface FrameAnalyzerOptions {
  stableDurationMs: number;
  timestamp?: number;
  width?: number;
  height?: number;
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function luminanceAt(data: Uint8ClampedArray, index: number): number {
  return 0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2];
}

function hammingDistance(left: string, right: string): number {
  const length = Math.min(left.length, right.length);
  let distance = Math.abs(left.length - right.length);
  for (let index = 0; index < length; index += 1) {
    if (left[index] !== right[index]) {
      distance += 1;
    }
  }
  return distance;
}

function candidateDistance(left?: FrameCandidate, right?: FrameCandidate): number {
  if (!left || !right) {
    return 1;
  }

  return (
    Math.abs(left.x - right.x) +
    Math.abs(left.y - right.y) +
    Math.abs(left.width - right.width) +
    Math.abs(left.height - right.height)
  );
}

function integralImage(values: Float32Array, width: number, height: number): Float32Array {
  const integral = new Float32Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y += 1) {
    let rowTotal = 0;
    for (let x = 0; x < width; x += 1) {
      rowTotal += values[y * width + x];
      const index = (y + 1) * (width + 1) + x + 1;
      integral[index] = integral[index - (width + 1)] + rowTotal;
    }
  }
  return integral;
}

function integralSum(
  integral: Float32Array,
  width: number,
  left: number,
  top: number,
  right: number,
  bottom: number,
): number {
  const stride = width + 1;
  return integral[bottom * stride + right] -
    integral[top * stride + right] -
    integral[bottom * stride + left] +
    integral[top * stride + left];
}

/** Find a card-shaped boundary instead of treating all frame edges as a card. */
function findCardCandidate(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): { candidate: FrameCandidate; boundaryScore: number } | undefined {
  const luminance = new Float32Array(width * height);
  const horizontalEdges = new Float32Array(width * height);
  const verticalEdges = new Float32Array(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      luminance[y * width + x] = luminanceAt(data, index);
    }
  }

  for (let y = 2; y < height; y += 1) {
    for (let x = 2; x < width; x += 1) {
      const index = y * width + x;
      horizontalEdges[index] = Math.abs(luminance[index] - luminance[(y - 2) * width + x]);
      verticalEdges[index] = Math.abs(luminance[index] - luminance[y * width + x - 2]);
    }
  }

  const horizontalIntegral = integralImage(horizontalEdges, width, height);
  const verticalIntegral = integralImage(verticalEdges, width, height);
  const expectedAspect = 0.716;
  const positionStep = Math.max(6, Math.round(width / 32));
  const widthStep = Math.max(8, Math.round(width / 24));
  const minWidth = Math.max(28, Math.round(width * 0.18));
  const maxWidth = Math.min(Math.round(width * 0.94), Math.round(height * expectedAspect * 0.98));
  let best: { candidate: FrameCandidate; boundaryScore: number; score: number } | undefined;

  for (let candidateWidth = minWidth; candidateWidth <= maxWidth; candidateWidth += widthStep) {
    const candidateHeight = Math.round(candidateWidth / expectedAspect);
    if (candidateHeight < height * 0.3 || candidateHeight > height * 0.98) continue;
    const band = Math.max(2, Math.round(Math.min(candidateWidth, candidateHeight) * 0.025));
    for (let top = 0; top + candidateHeight <= height; top += positionStep) {
      for (let left = 0; left + candidateWidth <= width; left += positionStep) {
        const right = left + candidateWidth;
        const bottom = top + candidateHeight;
        const topEdge = integralSum(horizontalIntegral, width, left, top, right, Math.min(height, top + band));
        const bottomEdge = integralSum(horizontalIntegral, width, left, Math.max(0, bottom - band), right, bottom);
        const leftEdge = integralSum(verticalIntegral, width, left, top, Math.min(width, left + band), bottom);
        const rightEdge = integralSum(verticalIntegral, width, Math.max(0, right - band), top, right, bottom);
        const perimeterPixels = Math.max(1, (right - left) * band * 2 + (bottom - top) * band * 2);
        const boundaryScore = (topEdge + bottomEdge + leftEdge + rightEdge) / perimeterPixels / 255;
        const coverage = (candidateWidth * candidateHeight) / (width * height);
        const aspectQuality = clamp(1 - Math.abs(candidateWidth / candidateHeight - expectedAspect) / 0.24);
        const clippingPenalty = left <= 1 || top <= 1 || right >= width - 1 || bottom >= height - 1 ? 0.08 : 0;
        const score = boundaryScore * 0.78 + aspectQuality * 0.22 - clippingPenalty;

        if (!best || score > best.score) {
          best = {
            candidate: {
              x: left,
              y: top,
              width: candidateWidth,
              height: candidateHeight,
              coverage,
              aspectRatio: candidateWidth / candidateHeight,
            },
            boundaryScore,
            score,
          };
        }
      }
    }
  }

  if (!best || best.boundaryScore < 0.12) return undefined;
  return { candidate: best.candidate, boundaryScore: best.boundaryScore };
}

export function createFrameFingerprint(
  imageData: ImageData,
  cells = 8,
): string {
  const { data, width, height } = imageData;
  const cellWidth = Math.max(1, Math.floor(width / cells));
  const cellHeight = Math.max(1, Math.floor(height / cells));
  const values: number[] = [];

  for (let cellY = 0; cellY < cells; cellY += 1) {
    for (let cellX = 0; cellX < cells; cellX += 1) {
      let total = 0;
      let count = 0;
      for (let y = cellY * cellHeight; y < Math.min(height, (cellY + 1) * cellHeight); y += 2) {
        for (let x = cellX * cellWidth; x < Math.min(width, (cellX + 1) * cellWidth); x += 2) {
          total += luminanceAt(data, (y * width + x) * 4);
          count += 1;
        }
      }
      values.push(count ? total / count : 0);
    }
  }

  const average = values.reduce((total, value) => total + value, 0) / Math.max(values.length, 1);
  return values.map((value) => (value >= average ? "1" : "0")).join("");
}

export function analyzeImageData(
  imageData: ImageData,
  memory: FrameAnalyzerMemory,
  options: FrameAnalyzerOptions,
): FrameAnalysis {
  const { data, width, height } = imageData;
  const timestamp = options.timestamp ?? performance.now();
  let totalLuminance = 0;
  let brightPixels = 0;
  let edgeScore = 0;
  let edgeSamples = 0;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  const centerIndex = (Math.floor(height / 2) * width + Math.floor(width / 2)) * 4;
  const centerLum = luminanceAt(data, centerIndex);

  for (let y = 2; y < height - 2; y += 2) {
    for (let x = 2; x < width - 2; x += 2) {
      const index = (y * width + x) * 4;
      const lum = luminanceAt(data, index);
      const rightLum = luminanceAt(data, (y * width + x + 2) * 4);
      const downLum = luminanceAt(data, ((y + 2) * width + x) * 4);
      const edge = Math.abs(lum - rightLum) + Math.abs(lum - downLum);

      totalLuminance += lum;
      edgeScore += edge;
      edgeSamples += 1;
      if (lum > 232) {
        brightPixels += 1;
      }

      if (edge > 34 || Math.abs(lum - centerLum) < 46) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  const sampledPixels = Math.max(edgeSamples, 1);
  const averageLuminance = totalLuminance / sampledPixels;
  const normalizedEdge = clamp(edgeScore / sampledPixels / 72);
  const glare = clamp(brightPixels / sampledPixels / 0.08);
  const lighting = clamp(1 - Math.abs(averageLuminance - 132) / 132);
  const detected = findCardCandidate(data, width, height);
  const detectedCandidate = detected?.candidate;
  const candidateWidth = detectedCandidate?.width ?? Math.max(0, maxX - minX);
  const candidateHeight = detectedCandidate?.height ?? Math.max(0, maxY - minY);
  const candidateX = detectedCandidate?.x ?? minX;
  const candidateY = detectedCandidate?.y ?? minY;
  const candidateCoverage = detectedCandidate?.coverage ?? (candidateWidth * candidateHeight) / (width * height);
  const aspectRatio = detectedCandidate?.aspectRatio ?? (candidateHeight > 0 ? candidateWidth / candidateHeight : 0);
  const aspectMatch = clamp(1 - Math.abs(aspectRatio - 0.716) / 0.5);
  const candidateVisible = candidateCoverage > 0.08 && (detected?.boundaryScore ?? normalizedEdge) > 0.1;
  const legacyCoverage = (Math.max(0, maxX - minX) * Math.max(0, maxY - minY)) / (width * height);
  const legacyFrameFillsAnalysis = minX <= 2 && minY <= 2 && maxX >= width - 3 && maxY >= height - 3;
  const tooClose = Math.max(candidateCoverage, legacyCoverage) > 0.68 || (candidateVisible && (
    (candidateWidth > width * 0.92 && candidateHeight > height * 0.86) ||
    legacyFrameFillsAnalysis
  ));
  const boundaryConfidence = candidateVisible
    ? clamp((detected?.boundaryScore ?? normalizedEdge) * 0.62 + aspectMatch * 0.26 + Math.min(candidateCoverage, 0.72) * 0.18)
    : 0;
  const sharpness = clamp(normalizedEdge * 1.18);
  const candidate = candidateVisible
    ? {
        x: candidateX,
        y: candidateY,
        width: candidateWidth,
        height: candidateHeight,
        coverage: candidateCoverage,
        aspectRatio,
      }
    : undefined;
  const fingerprint = createFrameFingerprint(imageData);
  const fingerprintDistance = memory.lastFingerprint
    ? hammingDistance(fingerprint, memory.lastFingerprint) / fingerprint.length
    : 1;
  const geometryDistance = candidateDistance(candidate, memory.lastCandidate);
  const clipped = candidateVisible && (candidateX <= 2 || candidateY <= 2 || candidateX + candidateWidth >= width - 3 || candidateY + candidateHeight >= height - 3);
  const usableForRecognition =
    candidateVisible &&
    candidateWidth >= width * 0.2 &&
    candidateHeight >= height * 0.34 &&
    sharpness > 0.1 &&
    lighting > 0.12 &&
    glare < 0.98;
  const frameStable =
    candidateVisible &&
    fingerprintDistance < 0.23 &&
    geometryDistance < Math.max(width, height) * 0.26 &&
    sharpness > 0.1 &&
    lighting > 0.18 &&
    glare < 0.92;
  const stableSince = frameStable
    ? (memory.stableSince ?? timestamp)
    : undefined;
  const stableForMs = stableSince !== undefined ? timestamp - stableSince : 0;

  memory.lastFingerprint = fingerprint;
  memory.lastCandidate = candidate;
  memory.stableSince = stableSince;

  let feedback: string;
  if (!candidateVisible) {
    feedback = "Card not fully inside.";
  } else if (tooClose) {
    feedback = "Card is very close to the camera.";
  } else if (glare > 0.78) {
    feedback = "Too much glare.";
  } else if (lighting < 0.22) {
    feedback = averageLuminance < 80 ? "Too dark." : "Lighting uneven.";
  } else if (sharpness < 0.2) {
    feedback = "Too blurry. Hold steady.";
  } else if (!frameStable) {
    feedback = "Hold steady.";
  } else {
    feedback = "Stable card candidate.";
  }

  const qualityClass = frameStable && usableForRecognition
    ? "ideal"
    : usableForRecognition
      ? "acceptable"
      : candidateVisible
        ? "degraded"
        : "unusable";

  return {
    timestamp,
    analysisWidth: width,
    analysisHeight: height,
    candidateVisible,
    tooClose,
    candidateCoverage,
    clipped,
    boundaryConfidence,
    sharpness,
    lighting,
    glare,
    stable: stableForMs >= options.stableDurationMs,
    stableForMs,
    usableForRecognition,
    qualityClass,
    feedback,
    fingerprint,
    candidate,
  };
}

export function shouldUseRecognitionFallback({
  analysis,
  targetAgeMs,
  stableDurationMs,
}: {
  analysis: FrameAnalysis;
  targetAgeMs: number;
  stableDurationMs: number;
}): boolean {
  if (analysis.stable || !analysis.candidateVisible) return false;
  // This is an evidence budget, not a fake progress timer: use the best
  // defensible frame once normal handheld motion prevents ideal stability.
  if (analysis.usableForRecognition) {
    return targetAgeMs >= Math.max(720, stableDurationMs * 3);
  }
  // A visibly acquired but degraded card must not remain in a nonterminal
  // state forever. The bounded fallback preserves it for review when there
  // is enough image structure to make a defensible cropped attempt.
  return targetAgeMs >= Math.max(1_400, stableDurationMs * 4) &&
    analysis.candidateCoverage >= 0.1 &&
    analysis.sharpness > 0.05 &&
    analysis.lighting > 0.03;
}

export function analyzeVideoFrame({
  video,
  canvas,
  memory,
  options,
  guide,
  cropToGuide,
}: {
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  memory: FrameAnalyzerMemory;
  options: FrameAnalyzerOptions;
  guide?: NormalizedRect;
  cropToGuide?: boolean;
}): FrameAnalysis | undefined {
  const context = canvas.getContext("2d", {
    alpha: false,
    willReadFrequently: true,
  });
  if (!context || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    return undefined;
  }

  const targetWidth = options.width ?? 240;
  const targetHeight = options.height ?? 336;
  if (canvas.width !== targetWidth) {
    canvas.width = targetWidth;
  }
  if (canvas.height !== targetHeight) {
    canvas.height = targetHeight;
  }

  if (cropToGuide) {
    drawVisibleGuideToCanvas(video, canvas, guide);
  } else {
    context.drawImage(video, 0, 0, targetWidth, targetHeight);
  }
  const imageData = context.getImageData(0, 0, targetWidth, targetHeight);
  return analyzeImageData(imageData, memory, options);
}

export function shouldSuppressDuplicateScan({
  currentFingerprint,
  lastAcceptedFingerprint,
  transitionStarted,
  distanceThreshold = 0.08,
}: {
  currentFingerprint: string;
  lastAcceptedFingerprint?: string;
  transitionStarted: boolean;
  distanceThreshold?: number;
}): boolean {
  if (!lastAcceptedFingerprint || transitionStarted) {
    return false;
  }

  return hammingDistance(currentFingerprint, lastAcceptedFingerprint) / currentFingerprint.length < distanceThreshold;
}
import { drawVisibleGuideToCanvas, type NormalizedRect } from "./cameraGeometry";
