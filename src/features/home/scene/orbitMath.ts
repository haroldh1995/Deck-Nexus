import type {
  HomeHologramCard,
  OrbitTransform,
  ResponsiveSceneScale,
} from "./homeSceneTypes";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(min: number, max: number, t: number): number {
  return min + (max - min) * t;
}

export function normalizeAngle(angle: number): number {
  const normalized = angle % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

export function shortestAngleDistance(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

export function getNearestOrbitIndex(
  rotation: number,
  itemCount: number,
): number {
  if (itemCount <= 0) {
    return 0;
  }

  const step = 360 / itemCount;
  const nearestIndex = Math.round(normalizeAngle(-rotation) / step) %
    itemCount;
  return Object.is(nearestIndex, -0) ? 0 : nearestIndex;
}

export function getRotationForIndex(index: number, itemCount: number): number {
  if (itemCount <= 0) {
    return 0;
  }

  return -index * (360 / itemCount);
}

export function calculateResponsiveSceneScale({
  width,
  height,
}: {
  width: number;
  height: number;
}): ResponsiveSceneScale {
  const shortSide = Math.min(width, height);
  const tallness = height / Math.max(width, 1);
  const landscape = width > height * 1.12;
  const sceneScale = clamp(shortSide / 390, 0.78, 1.32);
  const cardWidth = clamp(
    width * (landscape ? 0.12 : 0.285),
    84,
    landscape ? 132 : 154,
  );
  const cardHeight = cardWidth * 1.42;
  const radiusX = clamp(width * 0.48, 142, 470);
  const radiusZ = clamp(height * 0.22, 122, 286);
  const centerY = clamp(
    height * (landscape ? 0.42 : tallness > 1.7 ? 0.54 : 0.5),
    landscape ? 270 : 292,
    landscape ? 420 : 570,
  );

  return {
    sceneScale,
    cardWidth,
    cardHeight,
    radiusX,
    radiusZ,
    centerY,
    upperRingScale: clamp(width / 430, 0.8, 1.26),
    lowerRingScale: clamp(width / 390, 0.86, 1.45),
    beamWidth: clamp(width * 0.15, 44, 92),
  };
}

export function calculateOrbitTransform({
  card,
  index,
  itemCount,
  rotation,
  scale,
}: {
  card: HomeHologramCard;
  index: number;
  itemCount: number;
  rotation: number;
  scale: ResponsiveSceneScale;
}): OrbitTransform {
  const baseAngle = itemCount > 0 ? (index / itemCount) * 360 : 0;
  const angle = normalizeAngle(baseAngle + rotation);
  const radians = (angle * Math.PI) / 180;
  const sin = Math.sin(radians);
  const cos = Math.cos(radians);

  const x = sin * scale.radiusX;
  const z = cos * scale.radiusZ;
  const frontness = (cos + 1) / 2;
  const visualFrontness = Math.pow(frontness, 2.25);
  const y =
    scale.centerY -
    84 -
    (1 - visualFrontness) * 116 +
    Math.abs(sin) * 38;
  const cardScale = lerp(0.32, 1.08, visualFrontness);
  const opacity = lerp(0.12, 0.98, visualFrontness);
  const blur = lerp(1.8, 0, visualFrontness);
  const saturation = lerp(0.5, 1.18, visualFrontness);
  const glow = lerp(0.16, 1, visualFrontness);
  const rotationY = clamp(-sin * 64, -68, 68);
  const rotationX = lerp(-11, 5, frontness);
  const layerBias = cos < -0.08 ? 0 : 1200;

  return {
    id: card.id,
    angle,
    normalizedAngle: angle,
    x,
    y,
    z,
    scale: cardScale,
    opacity,
    blur,
    saturation,
    glow,
    zIndex: layerBias + Math.round(frontness * 1000),
    rotationY,
    rotationX,
    frontness,
    rear: cos < -0.08,
  };
}

export function calculateOrbitTransforms({
  cards,
  rotation,
  scale,
}: {
  cards: readonly HomeHologramCard[];
  rotation: number;
  scale: ResponsiveSceneScale;
}): OrbitTransform[] {
  return cards.map((card, index) =>
    calculateOrbitTransform({
      card,
      index,
      itemCount: cards.length,
      rotation,
      scale,
    }),
  );
}

export function getDepthSortedOrbitTransforms(
  transforms: readonly OrbitTransform[],
): OrbitTransform[] {
  return [...transforms].sort((a, b) => a.z - b.z);
}

export function getFocusedTransform(
  transforms: readonly OrbitTransform[],
): OrbitTransform | undefined {
  return transforms.reduce<OrbitTransform | undefined>((focused, transform) => {
    if (!focused || transform.frontness > focused.frontness) {
      return transform;
    }

    return focused;
  }, undefined);
}

export function getCardOverlapIntensity(
  moving: OrbitTransform,
  target: OrbitTransform,
): number {
  const distanceX = Math.abs(moving.x - target.x);
  const distanceY = Math.abs(moving.y - target.y);
  const depthDistance = Math.abs(moving.frontness - target.frontness);
  const closeEnough = distanceX < 76 && distanceY < 92 && depthDistance < 0.28;
  return closeEnough ? clamp(1 - (distanceX + distanceY) / 168, 0, 1) : 0;
}

export function applyOrbitFriction({
  velocity,
  deltaMilliseconds,
  frictionPerFrame = 0.945,
}: {
  velocity: number;
  deltaMilliseconds: number;
  frictionPerFrame?: number;
}): number {
  return velocity * Math.pow(frictionPerFrame, deltaMilliseconds / 16.67);
}

export function calculateMagneticSettleStep({
  currentRotation,
  targetRotation,
  strength,
  settleEpsilon = 0.1,
}: {
  currentRotation: number;
  targetRotation: number;
  strength: number;
  settleEpsilon?: number;
}): {
  nextRotation: number;
  delta: number;
  settled: boolean;
} {
  const delta = shortestAngleDistance(
    normalizeAngle(currentRotation),
    normalizeAngle(targetRotation),
  );

  return {
    nextRotation: currentRotation + delta * strength,
    delta,
    settled: Math.abs(delta) < settleEpsilon,
  };
}

export function getPointerDragIntent({
  startX,
  startY,
  currentX,
  currentY,
  threshold,
}: {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  threshold: number;
}): "tap" | "drag" {
  const distance = Math.hypot(currentX - startX, currentY - startY);
  return distance >= threshold ? "drag" : "tap";
}
