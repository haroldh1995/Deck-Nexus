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
  candidateVisible: boolean;
  tooClose: boolean;
  boundaryConfidence: number;
  sharpness: number;
  lighting: number;
  glare: number;
  stable: boolean;
  stableForMs: number;
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
  const candidateWidth = Math.max(0, maxX - minX);
  const candidateHeight = Math.max(0, maxY - minY);
  const candidateCoverage = (candidateWidth * candidateHeight) / (width * height);
  const aspectRatio = candidateHeight > 0 ? candidateWidth / candidateHeight : 0;
  const aspectMatch = clamp(1 - Math.abs(aspectRatio - 0.716) / 0.5);
  const candidateVisible = candidateCoverage > 0.16 && normalizedEdge > 0.1;
  const tooClose = candidateCoverage > 0.78 || (candidateVisible && candidateWidth > width * 0.92 && candidateHeight > height * 0.86);
  const boundaryConfidence = candidateVisible
    ? clamp(normalizedEdge * 0.56 + aspectMatch * 0.28 + Math.min(candidateCoverage, 0.72) * 0.24)
    : 0;
  const sharpness = clamp(normalizedEdge * 1.18);
  const candidate = candidateVisible
    ? {
        x: minX,
        y: minY,
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
  const frameStable =
    candidateVisible &&
    !tooClose &&
    fingerprintDistance < 0.23 &&
    geometryDistance < Math.max(width, height) * 0.26 &&
    sharpness > 0.13 &&
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

  return {
    timestamp,
    candidateVisible,
    tooClose,
    boundaryConfidence,
    sharpness,
    lighting,
    glare,
    stable: stableForMs >= options.stableDurationMs,
    stableForMs,
    feedback,
    fingerprint,
    candidate,
  };
}

export function analyzeVideoFrame({
  video,
  canvas,
  memory,
  options,
}: {
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  memory: FrameAnalyzerMemory;
  options: FrameAnalyzerOptions;
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

  context.drawImage(video, 0, 0, targetWidth, targetHeight);
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
