export interface NormalizedRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PixelRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export const scannerGuideRect: NormalizedRect = {
  left: 0.15,
  top: 0.11,
  width: 0.7,
  height: 0.78,
};

export function objectFitCoverSourceRect({
  sourceWidth,
  sourceHeight,
  displayWidth,
  displayHeight,
}: {
  sourceWidth: number;
  sourceHeight: number;
  displayWidth: number;
  displayHeight: number;
}): PixelRect {
  if (sourceWidth <= 0 || sourceHeight <= 0 || displayWidth <= 0 || displayHeight <= 0) {
    return { left: 0, top: 0, width: sourceWidth, height: sourceHeight };
  }
  const sourceAspect = sourceWidth / sourceHeight;
  const displayAspect = displayWidth / displayHeight;
  if (sourceAspect > displayAspect) {
    const width = sourceHeight * displayAspect;
    return { left: (sourceWidth - width) / 2, top: 0, width, height: sourceHeight };
  }
  const height = sourceWidth / displayAspect;
  return { left: 0, top: (sourceHeight - height) / 2, width: sourceWidth, height };
}

export function mapDisplayRectToSource({
  displayRect,
  sourceRect,
}: {
  displayRect: NormalizedRect;
  sourceRect: PixelRect;
}): PixelRect {
  return {
    left: sourceRect.left + sourceRect.width * displayRect.left,
    top: sourceRect.top + sourceRect.height * displayRect.top,
    width: sourceRect.width * displayRect.width,
    height: sourceRect.height * displayRect.height,
  };
}

export function visibleGuideSourceRect({
  videoWidth,
  videoHeight,
  displayWidth,
  displayHeight,
  guide = scannerGuideRect,
}: {
  videoWidth: number;
  videoHeight: number;
  displayWidth: number;
  displayHeight: number;
  guide?: NormalizedRect;
}): PixelRect {
  const sourceRect = objectFitCoverSourceRect({ sourceWidth: videoWidth, sourceHeight: videoHeight, displayWidth, displayHeight });
  return mapDisplayRectToSource({ displayRect: guide, sourceRect });
}

export function drawVisibleGuideToCanvas(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  guide: NormalizedRect = scannerGuideRect,
): PixelRect | undefined {
  const context = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
  if (!context || video.videoWidth <= 0 || video.videoHeight <= 0) return undefined;
  const displayWidth = video.clientWidth || video.videoWidth;
  const displayHeight = video.clientHeight || video.videoHeight;
  const sourceRect = visibleGuideSourceRect({
    videoWidth: video.videoWidth,
    videoHeight: video.videoHeight,
    displayWidth,
    displayHeight,
    guide,
  });
  context.drawImage(video, sourceRect.left, sourceRect.top, sourceRect.width, sourceRect.height, 0, 0, canvas.width, canvas.height);
  return sourceRect;
}
