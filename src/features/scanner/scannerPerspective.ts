import type { ScannerCardQuadrilateral } from "./scannerDetection";

export interface ScannerNormalizedCard {
  canvas: HTMLCanvasElement;
  source: ScannerCardQuadrilateral;
  width: number;
  height: number;
}

function sampleBilinear(data: ImageData, x: number, y: number): [number, number, number, number] {
  const left = Math.max(0, Math.min(data.width - 1, Math.floor(x)));
  const top = Math.max(0, Math.min(data.height - 1, Math.floor(y)));
  const right = Math.min(data.width - 1, left + 1);
  const bottom = Math.min(data.height - 1, top + 1);
  const xWeight = x - left;
  const yWeight = y - top;
  const pixel = (px: number, py: number) => {
    const index = (py * data.width + px) * 4;
    return [data.data[index], data.data[index + 1], data.data[index + 2], data.data[index + 3]];
  };
  const topLeft = pixel(left, top);
  const topRight = pixel(right, top);
  const bottomLeft = pixel(left, bottom);
  const bottomRight = pixel(right, bottom);
  return topLeft.map((_, channel) => {
    const topValue = topLeft[channel] * (1 - xWeight) + topRight[channel] * xWeight;
    const bottomValue = bottomLeft[channel] * (1 - xWeight) + bottomRight[channel] * xWeight;
    return Math.round(topValue * (1 - yWeight) + bottomValue * yWeight);
  }) as [number, number, number, number];
}

/**
 * Normalizes a detected quadrilateral with a bilinear warp. The detector may
 * currently provide an axis-aligned quadrilateral, while future CV/AI stages
 * can provide true corners without changing recognition consumers.
 */
export function normalizeScannerCard(
  sourceCanvas: HTMLCanvasElement,
  quadrilateral: ScannerCardQuadrilateral,
  width = 520,
  height = 728,
): ScannerNormalizedCard {
  const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
  const output = document.createElement("canvas");
  output.width = width;
  output.height = height;
  if (!sourceContext) return { canvas: output, source: quadrilateral, width, height };
  const source = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const outputContext = output.getContext("2d", { willReadFrequently: true });
  if (!outputContext) return { canvas: output, source: quadrilateral, width, height };
  const pixels = outputContext.createImageData(width, height);
  for (let y = 0; y < height; y += 1) {
    const v = height === 1 ? 0 : y / (height - 1);
    for (let x = 0; x < width; x += 1) {
      const u = width === 1 ? 0 : x / (width - 1);
      const topX = quadrilateral.topLeft.x * (1 - u) + quadrilateral.topRight.x * u;
      const topY = quadrilateral.topLeft.y * (1 - u) + quadrilateral.topRight.y * u;
      const bottomX = quadrilateral.bottomLeft.x * (1 - u) + quadrilateral.bottomRight.x * u;
      const bottomY = quadrilateral.bottomLeft.y * (1 - u) + quadrilateral.bottomRight.y * u;
      const rgba = sampleBilinear(source, topX * (1 - v) + bottomX * v, topY * (1 - v) + bottomY * v);
      const index = (y * width + x) * 4;
      pixels.data[index] = rgba[0];
      pixels.data[index + 1] = rgba[1];
      pixels.data[index + 2] = rgba[2];
      pixels.data[index + 3] = rgba[3];
    }
  }
  outputContext.putImageData(pixels, 0, 0);
  return { canvas: output, source: quadrilateral, width, height };
}
