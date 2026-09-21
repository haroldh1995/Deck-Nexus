import { localCardCatalog, type CatalogCard } from "../../data/cardCatalog";
import { resolveScryfallCardName, searchScryfallCards } from "../../services/scryfall";
import type {
  CardPriceReference,
  CollectorFinish,
  DeckstateScryfallCard,
  ScanBatchDestination,
  ScanIdentityStatus,
  ScanPrintingStatus,
  ScanRecordStatus,
} from "../../types/domain";
import type { FrameAnalysis } from "./frameAnalysis";
import {
  matchScannerEvidence,
  normalizeScannerText,
  scannerFieldIsUsable,
  type ObservedCardEvidence,
  type ObservedCardField,
} from "./scannerMatching";

export interface ScannerResolvedCard {
  rawText: string;
  scryfallId?: string;
  oracleId?: string;
  printingId?: string;
  name: string;
  quantity: number;
  status: ScanRecordStatus;
  identityStatus: ScanIdentityStatus;
  printingStatus: ScanPrintingStatus;
  confidence: number;
  printingConfidence: number;
  possibleMatches: string[];
  typeLine?: string;
  colorIdentity?: DeckstateScryfallCard["colorIdentity"];
  destination?: ScanBatchDestination;
  setCode?: string;
  setName?: string;
  collectorNumber?: string;
  language?: string;
  foil?: boolean;
  finish?: CollectorFinish;
  condition?: string;
  prices?: CardPriceReference;
  priceUpdatedAt?: string;
  rarity?: string;
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
  language?: string;
  foil?: boolean;
  finish?: CollectorFinish;
  condition?: string;
  prices?: CardPriceReference;
  priceUpdatedAt?: string;
  rarity?: string;
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
    options?: { rectangle?: { left: number; top: number; width: number; height: number } },
    output?: Record<string, boolean>,
  ) => Promise<{ data: { text: string; confidence?: number } }>;
  terminate: () => Promise<unknown>;
};

let ocrWorkerPromise: Promise<OcrWorker> | undefined;
const scannerCandidateCache = new Map<string, DeckstateScryfallCard[]>();

function cleanOcrText(value: string): string {
  return value.replace(/[|_[\]{}<>~`^]/g, " ").replace(/\s+/g, " ").trim();
}

function field(value: string, confidence: number, sourceRegion: string): ObservedCardField | undefined {
  const cleaned = cleanOcrText(value);
  if (!cleaned) return undefined;
  return { value: cleaned, quality: Math.min(1, Math.max(0, confidence / 100)), sourceRegion };
}

function parseSetCollector(value: string): { set?: ObservedCardField; collector?: ObservedCardField } {
  const compact = value.replace(/\s+/g, " ");
  const match = compact.match(/\b([A-Z0-9]{2,5})\s*[•#-]?\s*(\d{1,4}[A-Z]?)\b/i) ??
    compact.match(/\b(\d{1,4}[A-Z]?)\s*[•#-]?\s*([A-Z0-9]{2,5})\b/i);
  if (!match) return {};
  const first = match[1];
  const second = match[2];
  return /^\d/.test(first)
    ? { collector: field(first, 52, "set-collector"), set: field(second.toLowerCase(), 52, "set-collector") }
    : { set: field(first.toLowerCase(), 52, "set-collector"), collector: field(second, 52, "set-collector") };
}

function cardImage(card: DeckstateScryfallCard): string | undefined {
  return card.imageUris?.normal ?? card.imageUris?.small ?? card.cardFaces.find((face) => face.imageUris?.normal)?.imageUris?.normal;
}

function scanStatus(identityStatus: ScanIdentityStatus, confidence: number): ScanRecordStatus {
  if (identityStatus === "verified" && confidence >= 0.72) return "matched";
  if (identityStatus === "review_required" || identityStatus === "ambiguous") return confidence >= 0.42 ? "assumed" : "low_confidence";
  return "unresolved";
}

function fromCard({ card, result, matchSource }: {
  card: DeckstateScryfallCard;
  result: Omit<ScannerResolvedCard, "name" | "scryfallId" | "oracleId" | "printingId" | "typeLine" | "colorIdentity" | "setCode" | "setName" | "collectorNumber" | "language" | "foil" | "finish" | "prices" | "priceUpdatedAt" | "rarity" | "imageUri" | "matchSource">;
  matchSource: ScannerResolvedCard["matchSource"];
}): ScannerResolvedCard {
  return {
    ...result,
    name: card.name,
    scryfallId: card.id,
    oracleId: card.oracleId,
    printingId: result.printingStatus === "verified" ? card.id : undefined,
    typeLine: card.typeLine,
    colorIdentity: card.colorIdentity,
    setCode: card.setCode,
    setName: card.setName,
    collectorNumber: card.collectorNumber,
    language: card.lang,
    foil: card.foil && !card.nonfoil,
    finish: card.foil && !card.nonfoil ? "foil" : "nonfoil",
    prices: card.prices,
    priceUpdatedAt: card.prices?.fetchedAt,
    rarity: card.rarity,
    imageUri: cardImage(card),
    matchSource,
  };
}

function fromCatalogCard(card: CatalogCard, base: Omit<ScannerResolvedCard, "name" | "scryfallId" | "oracleId" | "typeLine" | "colorIdentity" | "matchSource">): ScannerResolvedCard {
  return {
    ...base,
    name: card.name,
    scryfallId: card.scryfallId,
    oracleId: card.oracleId,
    typeLine: card.typeLine,
    colorIdentity: card.colorIdentity,
    printingStatus: "unknown",
    matchSource: "ocr",
  };
}

function popScannerHarnessCard(): ScannerTestCard | undefined {
  if (!import.meta.env.DEV || typeof window === "undefined" || !window.__deckNexusScannerTestHarness) return undefined;
  return window.__deckNexusScannerTestCards?.shift();
}

async function getOcrWorker(): Promise<OcrWorker> {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = (async () => {
      const module = (await import("tesseract.js")) as unknown as {
        createWorker?: (language?: string, oem?: unknown, options?: Record<string, unknown>) => Promise<OcrWorker>;
        default?: { createWorker?: (language?: string, oem?: unknown, options?: Record<string, unknown>) => Promise<OcrWorker> };
      };
      const createWorker = module.createWorker ?? module.default?.createWorker;
      if (!createWorker) throw new Error("OCR worker could not be loaded.");
      const worker = await createWorker("eng", undefined, { workerBlobURL: true, logger: () => undefined });
      await worker.setParameters({ preserve_interword_spaces: "1", tessedit_pageseg_mode: "6" });
      return worker;
    })();
  }
  return ocrWorkerPromise;
}

async function recognizeEvidence(canvas: HTMLCanvasElement): Promise<{ evidence: ObservedCardEvidence; rawText: string }> {
  const worker = await getOcrWorker();
  const regions = {
    title: { left: 0.07, top: 0.025, width: 0.72, height: 0.115 },
    type: { left: 0.07, top: 0.405, width: 0.72, height: 0.085 },
    rules: { left: 0.09, top: 0.49, width: 0.78, height: 0.31 },
    stats: { left: 0.67, top: 0.82, width: 0.27, height: 0.1 },
    setCollector: { left: 0.05, top: 0.91, width: 0.47, height: 0.065 },
    artist: { left: 0.48, top: 0.91, width: 0.47, height: 0.065 },
  } as const;
  const reads = await Promise.all(Object.entries(regions).map(async ([name, rectangle]) => {
    const result = await worker.recognize(canvas, { rectangle: {
      left: Math.round(canvas.width * rectangle.left),
      top: Math.round(canvas.height * rectangle.top),
      width: Math.round(canvas.width * rectangle.width),
      height: Math.round(canvas.height * rectangle.height),
    } }, { text: true });
    return { name, text: cleanOcrText(result.data.text), confidence: result.data.confidence ?? 0 };
  }));
  const byName = new Map(reads.map((read) => [read.name, read]));
  const parsed = parseSetCollector(byName.get("setCollector")?.text ?? "");
  const evidence: ObservedCardEvidence = {
    rawText: reads.map((read) => read.text).filter(Boolean).join("\n"),
    title: field(byName.get("title")?.text ?? "", byName.get("title")?.confidence ?? 0, "title"),
    type: field(byName.get("type")?.text ?? "", byName.get("type")?.confidence ?? 0, "type"),
    rules: field(byName.get("rules")?.text ?? "", byName.get("rules")?.confidence ?? 0, "rules"),
    artist: field(byName.get("artist")?.text ?? "", byName.get("artist")?.confidence ?? 0, "artist"),
    set: parsed.set,
    collector: parsed.collector,
  };
  const stats = byName.get("stats");
  const statMatch = stats?.text.match(/(\d+|\*)\s*[/\\]\s*(\d+|\*)/);
  if (stats && statMatch) {
    evidence.power = field(statMatch[1], stats.confidence, "stats");
    evidence.toughness = field(statMatch[2], stats.confidence, "stats");
  }
  return { evidence, rawText: evidence.rawText ?? "" };
}

function cardFromHarness(card: ScannerTestCard, capturedThumbnail: string | undefined, analysis: FrameAnalysis, destination: ScanBatchDestination): ScannerResolvedCard {
  const confidence = Math.min(0.99, Math.max(0, card.confidence ?? 0.92));
  const identityStatus: ScanIdentityStatus = confidence >= 0.85 ? "verified" : confidence >= 0.4 ? "review_required" : "unresolved";
  return {
    rawText: card.name,
    scryfallId: card.scryfallId ?? `test-${card.name.toLowerCase().replace(/\W+/g, "-")}`,
    oracleId: card.oracleId ?? `test-oracle-${card.name.toLowerCase().replace(/\W+/g, "-")}`,
    name: card.name,
    quantity: 1,
    status: scanStatus(identityStatus, confidence),
    identityStatus,
    printingStatus: card.setCode && card.collectorNumber ? "verified" : "unknown",
    confidence,
    printingConfidence: card.setCode && card.collectorNumber ? confidence : 0,
    possibleMatches: [card.name],
    typeLine: card.typeLine,
    colorIdentity: card.colorIdentity ?? [],
    destination,
    setCode: card.setCode,
    setName: card.setName,
    collectorNumber: card.collectorNumber,
    language: card.language,
    foil: card.foil,
    finish: card.finish,
    condition: card.condition,
    prices: card.prices,
    priceUpdatedAt: card.priceUpdatedAt ?? card.prices?.fetchedAt,
    rarity: card.rarity,
    imageUri: card.imageUri,
    capturedThumbnail,
    frameFingerprint: analysis.fingerprint,
    matchSource: "test_harness",
    scannerWarnings: [],
  };
}

function captureThumbnail(canvas: HTMLCanvasElement, enabled: boolean): string | undefined {
  if (!enabled) return undefined;
  try { return canvas.toDataURL("image/jpeg", 0.45); } catch { return undefined; }
}

async function findCandidates(
  options: Parameters<typeof searchScryfallCards>[0],
  signal?: AbortSignal,
): Promise<DeckstateScryfallCard[]> {
  const cacheKey = JSON.stringify({
    query: options.query,
    exactPhrase: options.exactPhrase,
    typeText: options.typeText,
    oracleText: options.oracleText,
    unique: options.unique,
    sort: options.sort,
    priority: options.priority,
  });
  const memoryCached = scannerCandidateCache.get(cacheKey);
  if (memoryCached) return memoryCached;
  const cached = await searchScryfallCards({ ...options, cachedOnly: true }, signal);
  if (cached.cards.length > 0) {
    scannerCandidateCache.set(cacheKey, cached.cards);
    return cached.cards;
  }
  const live = (await searchScryfallCards(options, signal)).cards;
  if (live.length > 0) {
    scannerCandidateCache.set(cacheKey, live);
    if (scannerCandidateCache.size > 128) {
      const oldest = scannerCandidateCache.keys().next().value;
      if (oldest) scannerCandidateCache.delete(oldest);
    }
  }
  return live;
}

export async function recognizeScannerFrame({ canvas, analysis, destination, saveThumbnail, signal }: ScannerRecognitionInput): Promise<ScannerResolvedCard> {
  const capturedThumbnail = captureThumbnail(canvas, saveThumbnail);
  const harnessCard = popScannerHarnessCard();
  if (harnessCard) return cardFromHarness(harnessCard, capturedThumbnail, analysis, destination);

  let extracted: { evidence: ObservedCardEvidence; rawText: string } = { evidence: {}, rawText: "" };
  try { extracted = await recognizeEvidence(canvas); } catch { /* absence of reliable OCR is a safe terminal outcome */ }
  const title = extracted.evidence.title;
  const setValue = extracted.evidence.set?.value;
  const collectorValue = extracted.evidence.collector?.value;
  let candidates: DeckstateScryfallCard[] = [];
  let matchSource: ScannerResolvedCard["matchSource"] = "ocr";

  if (setValue && collectorValue && scannerFieldIsUsable(extracted.evidence.set) && scannerFieldIsUsable(extracted.evidence.collector)) {
    candidates = await findCandidates({ query: `set:${setValue} cn:${collectorValue}`, unique: "prints", sort: "set", priority: "high" }, signal);
    matchSource = "scryfall_exact";
  }
  if (candidates.length === 0 && title && scannerFieldIsUsable(title)) {
    try {
      candidates = await findCandidates({ query: title.value, unique: "prints", sort: "name", priority: "high" }, signal);
      matchSource = "scryfall_fuzzy";
    } catch {
      try {
        const resolved = await resolveScryfallCardName(title.value, signal);
        candidates = [resolved.card];
        matchSource = resolved.fuzzy ? "scryfall_fuzzy" : "scryfall_exact";
      } catch { /* continue to safe local fallback */ }
    }
  }

  if (candidates.length === 0 && scannerFieldIsUsable(extracted.evidence.rules) && extracted.evidence.rules.quality >= 0.62) {
    const rulesPhrase = extracted.evidence.rules.value.split(/\s+/).slice(0, 8).join(" ");
    candidates = await findCandidates({
      query: "",
      oracleText: rulesPhrase,
      typeText: extracted.evidence.type?.value,
      unique: "prints",
      sort: "name",
      priority: "medium",
    }, signal);
    matchSource = "scryfall_fuzzy";
  }

  if (candidates.length === 0 && title && scannerFieldIsUsable(title)) {
    const local = localCardCatalog.find((card) => normalizeScannerText(card.name) === normalizeScannerText(title.value));
    if (local) {
      return fromCatalogCard(local, {
        rawText: extracted.rawText || title.value,
        quantity: 1,
        status: "low_confidence",
        identityStatus: "review_required",
        printingStatus: "unknown",
        confidence: 0.35,
        printingConfidence: 0,
        possibleMatches: [local.name],
        destination,
        capturedThumbnail,
        frameFingerprint: analysis.fingerprint,
        scannerWarnings: ["Only local card-name evidence was available; confirm before committing."],
      });
    }
  }

  const match = matchScannerEvidence(extracted.evidence, candidates);
  if (!match.card) {
    return {
      rawText: extracted.rawText || "Unresolved camera scan",
      name: "Card not identified",
      quantity: 1,
      status: "unresolved",
      identityStatus: match.identityStatus,
      printingStatus: match.printingStatus,
      confidence: match.cardConfidence,
      printingConfidence: match.printingConfidence,
      possibleMatches: match.cardCandidates.slice(0, 5).map((candidate) => candidate.card.name),
      destination,
      capturedThumbnail,
      frameFingerprint: analysis.fingerprint,
      matchSource,
      scannerWarnings: [...match.warnings, typeof navigator !== "undefined" && navigator.onLine === false ? "Offline scan preserved for later review." : "No canonical card met the verification gate."],
    };
  }

  const selected = match.printing ?? match.card;
  const result = fromCard({
    card: selected,
    result: {
      rawText: extracted.rawText || match.card.name,
      quantity: 1,
      status: scanStatus(match.identityStatus, match.cardConfidence),
      identityStatus: match.identityStatus,
      printingStatus: match.printingStatus,
      confidence: match.cardConfidence,
      printingConfidence: match.printingConfidence,
      possibleMatches: match.cardCandidates.slice(0, 5).map((candidate) => candidate.card.name),
      destination,
      capturedThumbnail,
      frameFingerprint: analysis.fingerprint,
      scannerWarnings: match.warnings,
    },
    matchSource,
  });
  if (match.printingStatus !== "verified") {
    result.printingId = undefined;
    result.setCode = undefined;
    result.setName = undefined;
    result.collectorNumber = undefined;
    result.language = undefined;
    result.foil = undefined;
    result.finish = undefined;
    result.prices = undefined;
    result.priceUpdatedAt = undefined;
  }
  return result;
}

export async function terminateScannerOcrWorker(): Promise<void> {
  const worker = await ocrWorkerPromise?.catch(() => undefined);
  ocrWorkerPromise = undefined;
  await worker?.terminate().catch(() => undefined);
}
