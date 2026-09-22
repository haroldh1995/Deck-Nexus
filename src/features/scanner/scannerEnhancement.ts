export interface ScannerEnhancementOptions {
  contrast?: number;
  brightness?: number;
  sharpen?: number;
}

const DEFAULT_ENHANCEMENT: Required<ScannerEnhancementOptions> = {
  contrast: 1.18,
  brightness: 3,
  sharpen: 0.18,
};

function clamp(value: number): number {
  return Math.max(0, Math.min(255, value));
}

/** Creates one bounded text-focused variant without mutating the source. */
export function enhanceScannerCanvas(
  source: HTMLCanvasElement,
  options: ScannerEnhancementOptions = {},
): HTMLCanvasElement {
  const settings = { ...DEFAULT_ENHANCEMENT, ...options };
  const output = document.createElement("canvas");
  output.width = source.width;
  output.height = source.height;
  const sourceContext = source.getContext("2d", { willReadFrequently: true });
  const outputContext = output.getContext("2d", { willReadFrequently: true });
  if (!sourceContext || !outputContext) return output;
  const sourceData = sourceContext.getImageData(0, 0, source.width, source.height);
  const result = outputContext.createImageData(source.width, source.height);
  const indexFor = (x: number, y: number) => (Math.max(0, Math.min(source.height - 1, y)) * source.width + Math.max(0, Math.min(source.width - 1, x))) * 4;
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const index = indexFor(x, y);
      const left = indexFor(x - 1, y);
      const right = indexFor(x + 1, y);
      const up = indexFor(x, y - 1);
      const down = indexFor(x, y + 1);
      for (let channel = 0; channel < 3; channel += 1) {
        const center = sourceData.data[index + channel];
        const neighbor = (sourceData.data[left + channel] + sourceData.data[right + channel] + sourceData.data[up + channel] + sourceData.data[down + channel]) / 4;
        const enhanced = ((center - 128) * settings.contrast) + 128 + settings.brightness + (center - neighbor) * settings.sharpen;
        result.data[index + channel] = clamp(enhanced);
      }
      result.data[index + 3] = sourceData.data[index + 3];
    }
  }
  outputContext.putImageData(result, 0, 0);
  return output;
}
