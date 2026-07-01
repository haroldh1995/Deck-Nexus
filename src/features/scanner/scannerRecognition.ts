import { localCardCatalog, type CatalogCard } from "../../data/cardCatalog";
import { resolveScryfallCardName, searchScryfallCards } from "../../services/scryfall";
import type {
  DeckstateScryfallCard,
  ScanBatchDestination,
  ScanRecordStatus,
} from "../../types/domain";
import type { FrameAnalysis } from "./frameAnalysis";

export interface ScannerResolvedCard {
  rawText: string;
  scryfallId?: string;
  oracleId?: string;
  name: string;
  quantity: number;
  status: ScanRecordStatus;
  confidence: number;
  possibleMatches: string[];
  typeLine?: string;
  colorIdentity?: DeckstateScryfallCard["colorIdentity"];
  destination?: ScanBatchDestination;
  setCode?: string;
  setName?: string;
  collectorNumber?: string;
  imageUri?: string;
  capturedThumbnail?: string;
  frameFingerprint?: string;
  matchSource: "ocr" | "visual" | "scryfall_exact" | "scryfall_fuzzy" | "manual" | "test_harness";
  scannerWarnings: string[];
}

export interface ScannerRecognitionInput {
  canvas: HTMLCanvasElement;
  analysis: FrameAnalysis;
  destination: ScanBatchDestination;
  saveThumbnail: boolean;
  signal?: AbortSignal;
}

interface ScannerTestCard {
  name: string;
  scryfallId?: string;
  oracleId?: string;
  typeLine?: string;
  colorIdentity?: DeckstateScryfallCard["colorIdentity"];
  setCode?: string;
  setName?: string;
  collectorNumber?: string;
  imageUri?: string;
  confidence?: number;
}

declare global {
  interface Window {
    __deckNexusScannerTestHarness?: boolean;
    __deckNexusScannerTestCards?: ScannerTestCard[];
  }
}

type OcrWorker = {
  setParameters: (params: Record<string, string>) => Promise<unknown>;
  recognize: (
    image: HTMLCanvasElement,
    options?: {
      rectangle?: {
        left: number;
        top: number;
        width: number;
        height: number;
      };
    },
    output?: Record<string, boolean>,
  ) => Promise<{
    data: {
      text: string;
      confidence?: number;
    };
  }>;
  terminate: () => Promise<unknown>;
};

let ocrWorkerPromise: Promise<OcrWorker> | undefined;

function cleanOcrLine(line: string): string {
  return line
    .replace(/[|_[\]{}<>~`^]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyCardName(line: string): boolean {
  return (
    line.length >= 3 &&
    /[a-z]/i.test(line) &&
    !/^illus\.?/i.test(line) &&
    !/^tm\b/i.test(line) &&
    !/^\d+[a-z]?\s*[•/]\s*[A-Z]{2,5}$/i.test(line)
  );
}

function extractLikelyCardName(text: string): string | undefined {
  const lines = text
    .split(/\r?\n/)
    .map(cleanOcrLine)
    .filter(Boolean);

  return lines.find(isLikelyCardName);
}

function extractSetCollector(text: string): {
  setCode?: string;
  collectorNumber?: string;
} {
  const compact = text.replace(/\s+/g, " ");
  const match =
    compact.match(/\b([A-Z0-9]{2,5})\s*[•#-]?\s*(\d{1,4}[a-z]?)\b/i) ??
    compact.match(/\b(\d{1,4}[a-z]?)\s*[•#-]?\s*([A-Z0-9]{2,5})\b/i);

  if (!match) {
    return {};
  }

  const first = match[1];
  const second = match[2];
  if (/^\d/.test(first)) {
    return {
      collectorNumber: first,
      setCode: second.toLowerCase(),
    };
  }

  return {
    setCode: first.toLowerCase(),
    collectorNumber: second,
  };
}

function confidenceStatus(confidence: number): ScanRecordStatus {
  if (confidence >= 0.88) {
    return "matched";
  }

  if (confidence >= 0.68) {
    return "assumed";
  }

  if (confidence >= 0.38) {
    return "low_confidence";
  }

  return "unresolved";
}

function cardImage(card: DeckstateScryfallCard): string | undefined {
  return (
    card.imageUris?.normal ??
    card.imageUris?.small ??
    card.cardFaces.find((face) => face.imageUris?.normal || face.imageUris?.small)?.imageUris?.normal ??
    card.cardFaces.find((face) => face.imageUris?.small)?.imageUris?.small
  );
}

function fromScryfallCard({
  card,
  rawText,
  confidence,
  destination,
  capturedThumbnail,
  frameFingerprint,
  matchSource,
  possibleMatches = [],
}: {
  card: DeckstateScryfallCard;
  rawText: string;
  confidence: number;
  destination: ScanBatchDestination;
  capturedThumbnail?: string;
  frameFingerprint: string;
  matchSource: ScannerResolvedCard["matchSource"];
  possibleMatches?: string[];
}): ScannerResolvedCard {
  return {
    rawText,
    scryfallId: card.id,
    oracleId: card.oracleId,
    name: card.name,
    quantity: 1,
    status: confidenceStatus(confidence),
    confidence,
    possibleMatches: [card.name, ...possibleMatches.filter((name) => name !== card.name)].slice(0, 5),
    typeLine: card.typeLine,
    colorIdentity: card.colorIdentity,
    destination,
    setCode: card.setCode,
    setName: card.setName,
    collectorNumber: card.collectorNumber,
    imageUri: cardImage(card),
    capturedThumbnail,
    frameFingerprint,
    matchSource,
    scannerWarnings: [],
  };
}

function fromCatalogCard({
  card,
  rawText,
  confidence,
  destination,
  capturedThumbnail,
  frameFingerprint,
  matchSource,
}: {
  card: CatalogCard;
  rawText: string;
  confidence: number;
  destination: ScanBatchDestination;
  capturedThumbnail?: string;
  frameFingerprint: string;
  matchSource: ScannerResolvedCard["matchSource"];
}): ScannerResolvedCard {
  return {
    rawText,
    scryfallId: card.scryfallId,
    oracleId: card.oracleId,
    name: card.name,
    quantity: 1,
    status: confidenceStatus(confidence),
    confidence,
    possibleMatches: [card.name],
    typeLine: card.typeLine,
    colorIdentity: card.colorIdentity,
    destination,
    capturedThumbnail,
    frameFingerprint,
    matchSource,
    scannerWarnings: [],
  };
}

function popScannerHarnessCard(): ScannerTestCard | undefined {
  if (typeof window === "undefined" || !window.__deckNexusScannerTestHarness) {
    return undefined;
  }

  return window.__deckNexusScannerTestCards?.shift();
}

async function getOcrWorker(): Promise<OcrWorker> {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = (async () => {
      const module = (await import("tesseract.js")) as unknown as {
        createWorker?: (
          language?: string,
          oem?: unknown,
          options?: Record<string, unknown>,
        ) => Promise<OcrWorker>;
        default?: {
          createWorker?: (
            language?: string,
            oem?: unknown,
            options?: Record<string, unknown>,
          ) => Promise<OcrWorker>;
        };
      };
      const createWorker = module.createWorker ?? module.default?.createWorker;
      if (!createWorker) {
        throw new Error("OCR worker could not be loaded.");
      }
      const worker = await createWorker("eng", undefined, {
        workerBlobURL: true,
        logger: () => undefined,
      });
      await worker.setParameters({
        preserve_interword_spaces: "1",
        tessedit_pageseg_mode: "6",
      });
      return worker;
    })();
  }

  return ocrWorkerPromise;
}

async function recognizeText(canvas: HTMLCanvasElement): Promise<{
  text: string;
  confidence: number;
}> {
  const worker = await getOcrWorker();
  const nameRegion = {
    left: Math.round(canvas.width * 0.08),
    top: Math.round(canvas.height * 0.04),
    width: Math.round(canvas.width * 0.84),
    height: Math.round(canvas.height * 0.18),
  };
  const nameResult = await worker.recognize(canvas, { rectangle: nameRegion }, { text: true });
  const nameText = cleanOcrLine(nameResult.data.text);

  if (nameText.length >= 3) {
    return {
      text: nameText,
      confidence: (nameResult.data.confidence ?? 48) / 100,
    };
  }

  const wholeResult = await worker.recognize(canvas, undefined, { text: true });
  return {
    text: wholeResult.data.text,
    confidence: (wholeResult.data.confidence ?? 32) / 100,
  };
}

function localFallbackMatch(candidateName: string): CatalogCard | undefined {
  const normalized = candidateName.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  return localCardCatalog.find((card) => card.name.toLowerCase() === normalized) ??
    localCardCatalog.find((card) => card.name.toLowerCase().includes(normalized));
}

function captureThumbnail(canvas: HTMLCanvasElement, enabled: boolean): string | undefined {
  if (!enabled) {
    return undefined;
  }

  try {
    return canvas.toDataURL("image/jpeg", 0.45);
  } catch {
    return undefined;
  }
}

export async function recognizeScannerFrame({
  canvas,
  analysis,
  destination,
  saveThumbnail,
  signal,
}: ScannerRecognitionInput): Promise<ScannerResolvedCard> {
  const capturedThumbnail = captureThumbnail(canvas, saveThumbnail);
  const harnessCard = popScannerHarnessCard();
  if (harnessCard) {
    return {
      rawText: harnessCard.name,
      scryfallId: harnessCard.scryfallId ?? `test-${harnessCard.name.toLowerCase().replace(/\W+/g, "-")}`,
      oracleId: harnessCard.oracleId ?? `test-oracle-${harnessCard.name.toLowerCase().replace(/\W+/g, "-")}`,
      name: harnessCard.name,
      quantity: 1,
      status: confidenceStatus(harnessCard.confidence ?? 0.92),
      confidence: harnessCard.confidence ?? 0.92,
      possibleMatches: [harnessCard.name],
      typeLine: harnessCard.typeLine,
      colorIdentity: harnessCard.colorIdentity ?? [],
      destination,
      setCode: harnessCard.setCode,
      setName: harnessCard.setName,
      collectorNumber: harnessCard.collectorNumber,
      imageUri: harnessCard.imageUri,
      capturedThumbnail,
      frameFingerprint: analysis.fingerprint,
      matchSource: "test_harness",
      scannerWarnings: [],
    };
  }

  let ocrText: string;
  let ocrConfidence: number;
  try {
    const ocr = await recognizeText(canvas);
    ocrText = ocr.text;
    ocrConfidence = ocr.confidence;
  } catch {
    ocrText = "";
    ocrConfidence = 0;
  }

  const { setCode, collectorNumber } = extractSetCollector(ocrText);
  const likelyName = extractLikelyCardName(ocrText);
  const baseConfidence = Math.min(
    0.96,
    analysis.boundaryConfidence * 0.24 +
      analysis.sharpness * 0.14 +
      analysis.lighting * 0.12 +
      ocrConfidence * 0.5,
  );

  if (setCode && collectorNumber) {
    const page = await searchScryfallCards(
      {
        query: `set:${setCode} cn:${collectorNumber}`,
        unique: "prints",
        sort: "set",
        priority: "high",
      },
      signal,
    );
    const exactPrinting = page.cards[0];
    if (exactPrinting) {
      return fromScryfallCard({
        card: exactPrinting,
        rawText: ocrText || `${setCode} ${collectorNumber}`,
        confidence: Math.max(baseConfidence, 0.9),
        destination,
        capturedThumbnail,
        frameFingerprint: analysis.fingerprint,
        matchSource: "scryfall_exact",
      });
    }
  }

  if (likelyName) {
    try {
      const resolved = await resolveScryfallCardName(likelyName, signal);
      return fromScryfallCard({
        card: resolved.card,
        rawText: ocrText || likelyName,
        confidence: Math.max(baseConfidence, resolved.fuzzy ? 0.68 : 0.86),
        destination,
        capturedThumbnail,
        frameFingerprint: analysis.fingerprint,
        matchSource: resolved.fuzzy ? "scryfall_fuzzy" : "scryfall_exact",
      });
    } catch {
      const fallback = localFallbackMatch(likelyName);
      if (fallback) {
        return fromCatalogCard({
          card: fallback,
          rawText: ocrText || likelyName,
          confidence: Math.max(baseConfidence, 0.46),
          destination,
          capturedThumbnail,
          frameFingerprint: analysis.fingerprint,
          matchSource: "ocr",
        });
      }
    }
  }

  return {
    rawText: ocrText || "Unresolved camera scan",
    name: likelyName || "Unresolved camera scan",
    quantity: 1,
    status: "unresolved",
    confidence: Math.max(baseConfidence, 0.18),
    possibleMatches: likelyName ? [likelyName] : [],
    destination,
    capturedThumbnail,
    frameFingerprint: analysis.fingerprint,
    matchSource: "ocr",
    scannerWarnings: [
      navigator.onLine === false
        ? "Offline scan saved for later matching."
        : "OCR could not confidently resolve this card.",
    ],
  };
}

export async function terminateScannerOcrWorker(): Promise<void> {
  const worker = await ocrWorkerPromise?.catch(() => undefined);
  ocrWorkerPromise = undefined;
  await worker?.terminate().catch(() => undefined);
}
