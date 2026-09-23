import type {
  DeckstateCardFace,
  DeckstateScryfallCard,
  ScanIdentityStatus,
  ScanPrintingStatus,
} from "../../types/domain";

export type ScannerEvidenceField =
  | "title"
  | "mana"
  | "type"
  | "rules"
  | "set"
  | "collector"
  | "artist"
  | "language"
  | "power"
  | "toughness"
  | "loyalty"
  | "defense";

export interface ObservedCardField {
  value: string;
  quality: number;
  sourceRegion: string;
}

export interface ObservedCardEvidence {
  rawText?: string;
  title?: ObservedCardField;
  mana?: ObservedCardField;
  type?: ObservedCardField;
  rules?: ObservedCardField;
  set?: ObservedCardField;
  collector?: ObservedCardField;
  artist?: ObservedCardField;
  language?: ObservedCardField;
  power?: ObservedCardField;
  toughness?: ObservedCardField;
  loyalty?: ObservedCardField;
  defense?: ObservedCardField;
}

export interface ScannerCardCandidate {
  card: DeckstateScryfallCard;
  score: number;
  positives: string[];
  contradictions: string[];
  evidenceFields: ScannerEvidenceField[];
}

export interface ScannerMatchResult {
  card?: DeckstateScryfallCard;
  printing?: DeckstateScryfallCard;
  cardCandidates: ScannerCardCandidate[];
  printingCandidates: ScannerCardCandidate[];
  identityStatus: ScanIdentityStatus;
  printingStatus: ScanPrintingStatus;
  cardConfidence: number;
  printingConfidence: number;
  warnings: string[];
}

const FIELD_WEIGHTS: Record<ScannerEvidenceField, number> = {
  title: 0.34,
  mana: 0.12,
  type: 0.14,
  rules: 0.16,
  set: 0.08,
  collector: 0.1,
  artist: 0.04,
  language: 0.02,
  power: 0.03,
  toughness: 0.03,
  loyalty: 0.03,
  defense: 0.03,
};

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function normalizeScannerText(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[–—−]/g, "-")
    .replace(/[^a-z0-9{}+/.'-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compact(value: string): string {
  return normalizeScannerText(value).replace(/\s+/g, "");
}

function tokens(value: string): string[] {
  return normalizeScannerText(value).split(/\s+/).filter(Boolean);
}

function levenshtein(left: string, right: string): number {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = row[0];
    row[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const above = row[rightIndex];
      row[rightIndex] = left[leftIndex - 1] === right[rightIndex - 1]
        ? diagonal
        : Math.min(diagonal + 1, row[rightIndex] + 1, row[rightIndex - 1] + 1);
      diagonal = above;
    }
  }
  return row[right.length];
}

function textSimilarity(observed: string, expected: string): number {
  const left = normalizeScannerText(observed);
  const right = normalizeScannerText(expected);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.86;
  return clamp(1 - levenshtein(left, right) / Math.max(left.length, right.length));
}

function tokenSimilarity(observed: string, expected: string): number {
  const left = new Set(tokens(observed));
  const right = new Set(tokens(expected));
  if (left.size === 0 || right.size === 0) return 0;
  const shared = [...left].filter((token) => right.has(token)).length;
  return shared / Math.max(left.size, right.size);
}

function manaSimilarity(observed: string, expected: string): number {
  const observedSymbols = compact(observed).match(/\{[^}]+\}|[wubrgcxyz0-9]+/gi) ?? [];
  const expectedSymbols = compact(expected).match(/\{[^}]+\}|[wubrgcxyz0-9]+/gi) ?? [];
  if (observedSymbols.length === 0 || expectedSymbols.length === 0) return 0;
  return textSimilarity(observedSymbols.join(""), expectedSymbols.join(""));
}

function fieldValue(card: DeckstateScryfallCard, field: ScannerEvidenceField): string | undefined {
  switch (field) {
    case "title": return [card.name, card.printedName, ...card.cardFaces.map((face) => face.printedName ?? face.name)].filter(Boolean).join(" ");
    case "mana": return [card.manaCost, ...card.cardFaces.map((face) => face.manaCost)].filter(Boolean).join(" ");
    case "type": return [card.typeLine, card.printedTypeLine, ...card.cardFaces.map((face) => face.printedTypeLine ?? face.typeLine)].filter(Boolean).join(" ");
    case "rules": return [card.oracleText, card.printedText, ...card.cardFaces.map((face) => face.printedText ?? face.oracleText)].filter(Boolean).join(" ");
    case "set": return card.setCode;
    case "collector": return card.collectorNumber;
    case "artist": return card.artist;
    case "language": return card.lang;
    case "power": return card.power;
    case "toughness": return card.toughness;
    case "loyalty": return card.loyalty;
    case "defense": return card.defense;
  }
}

function isGarbageField(field: ObservedCardField): boolean {
  const value = normalizeScannerText(field.value);
  const parts = tokens(value);
  const letters = (value.match(/[a-z]/g) ?? []).length;
  const digits = (value.match(/[0-9]/g) ?? []).length;
  return (
    value.length < 3 ||
    parts.length === 0 ||
    (parts.length >= 5 && parts.filter((part) => part.length <= 1).length / parts.length > 0.5) ||
    (letters + digits < value.length * 0.42) ||
    (field.quality < 0.25 && field.value.length > 10)
  );
}

export function scannerFieldIsUsable(field: ObservedCardField | undefined): field is ObservedCardField {
  return Boolean(field && !isGarbageField(field));
}

function compareField(field: ScannerEvidenceField, observed: ObservedCardField, card: DeckstateScryfallCard): number {
  const expected = fieldValue(card, field);
  if (!expected) return 0;
  if (field === "mana") return manaSimilarity(observed.value, expected);
  if (field === "rules") return Math.max(textSimilarity(observed.value, expected), tokenSimilarity(observed.value, expected));
  if (field === "type") return tokenSimilarity(observed.value, expected);
  return textSimilarity(observed.value, expected);
}

function candidateFor(card: DeckstateScryfallCard, evidence: ObservedCardEvidence): ScannerCardCandidate {
  const positives: string[] = [];
  const contradictions: string[] = [];
  const evidenceFields: ScannerEvidenceField[] = [];
  let positiveWeight = 0;
  let totalWeight = 0;
  let contradictionWeight = 0;

  for (const field of Object.keys(FIELD_WEIGHTS) as ScannerEvidenceField[]) {
    const observed = evidence[field];
    if (!scannerFieldIsUsable(observed)) continue;
    const similarity = compareField(field, observed, card);
    const weight = FIELD_WEIGHTS[field] * Math.min(1, observed.quality);
    totalWeight += weight;
    evidenceFields.push(field);
    if (similarity >= 0.72) {
      positiveWeight += weight * similarity;
      positives.push(field);
    } else if (observed.quality >= 0.68 && ["set", "collector", "type", "mana", "title"].includes(field)) {
      contradictionWeight += weight;
      contradictions.push(field);
    }
  }

  const normalizedScore = totalWeight ? positiveWeight / totalWeight : 0;
  const score = clamp(normalizedScore - contradictionWeight * 1.35);
  return { card, score, positives, contradictions, evidenceFields };
}

function sortCandidates(candidates: readonly ScannerCardCandidate[]): ScannerCardCandidate[] {
  return [...candidates].sort((left, right) => right.score - left.score);
}

function groupedCardCandidates(candidates: readonly ScannerCardCandidate[]): ScannerCardCandidate[] {
  const bestByOracle = new Map<string, ScannerCardCandidate>();
  for (const candidate of candidates) {
    const key = candidate.card.oracleId || candidate.card.name;
    const current = bestByOracle.get(key);
    if (!current || candidate.score > current.score) bestByOracle.set(key, candidate);
  }
  return sortCandidates([...bestByOracle.values()]);
}

function hasStrongIdentitySupport(candidate: ScannerCardCandidate, evidence: ObservedCardEvidence): boolean {
  const supportingFields = candidate.positives.filter((field) => ["mana", "type", "rules", "set", "collector", "artist"].includes(field));
  const strongTitle = scannerFieldIsUsable(evidence.title) && evidence.title.quality >= 0.86 && candidate.positives.includes("title");
  return supportingFields.length >= 1 && (strongTitle || supportingFields.length >= 2);
}

export function matchScannerEvidence(
  evidence: ObservedCardEvidence,
  candidates: readonly DeckstateScryfallCard[],
): ScannerMatchResult {
  const scored = sortCandidates(candidates.map((card) => candidateFor(card, evidence)));
  const cardCandidates = groupedCardCandidates(scored);
  const top = cardCandidates[0];
  const second = cardCandidates[1];
  const margin = top ? top.score - (second?.score ?? 0) : 0;
  const usableEvidence = (Object.keys(FIELD_WEIGHTS) as ScannerEvidenceField[]).some((field) => scannerFieldIsUsable(evidence[field]));
  const hasContradiction = Boolean(top?.contradictions.length);
  const verified = Boolean(
    top &&
    usableEvidence &&
    !hasContradiction &&
    hasStrongIdentitySupport(top, evidence) &&
    top.score >= 0.62 &&
    margin >= (second ? 0.1 : 0),
  );
  const identityStatus: ScanIdentityStatus = !top || !usableEvidence || top.score < 0.28
    ? "unresolved"
    : verified
      ? "verified"
      : second && margin < 0.1
        ? "ambiguous"
        : "review_required";
  const printingCandidates = scored.filter((candidate) => candidate.card.oracleId === top?.card.oracleId || candidate.card.id === top?.card.id);
  const printingTop = printingCandidates[0];
  const reliableCollectorMatches = printingCandidates.filter((candidate) =>
    candidate.positives.includes("collector") && !candidate.contradictions.includes("collector"),
  );
  const collectorAndArtistMatch = reliableCollectorMatches.filter((candidate) =>
    candidate.positives.includes("artist") && !candidate.contradictions.includes("artist"),
  );
  const deterministicPrinting = Boolean(
    printingTop &&
    scannerFieldIsUsable(evidence.collector) && evidence.collector.quality >= 0.74 &&
    !printingTop.contradictions.includes("collector") &&
    (
      (
        scannerFieldIsUsable(evidence.set) && evidence.set.quality >= 0.74 &&
        printingTop.positives.includes("set") &&
        printingTop.positives.includes("collector") &&
        !printingTop.contradictions.includes("set")
      ) ||
      (collectorAndArtistMatch.length === 1) ||
      (reliableCollectorMatches.length === 1 && !scannerFieldIsUsable(evidence.artist))
    ),
  );
  const printingStatus: ScanPrintingStatus = deterministicPrinting
    ? "verified"
    : identityStatus === "unresolved" ? "unknown" : "review_required";

  return {
    card: identityStatus === "unresolved" ? undefined : top?.card,
    printing: deterministicPrinting ? printingTop?.card : undefined,
    cardCandidates,
    printingCandidates,
    identityStatus,
    printingStatus,
    cardConfidence: top ? clamp(top.score) : 0,
    printingConfidence: deterministicPrinting ? clamp(printingTop?.score ?? 0) : 0,
    warnings: [
      ...(hasContradiction ? ["Reliable physical evidence contradicts the leading candidate."] : []),
      ...(identityStatus !== "verified" ? ["Card identity requires review before collection commit."] : []),
      ...(printingStatus !== "verified" && identityStatus !== "unresolved" ? ["Exact printing was not established from reliable evidence."] : []),
    ],
  };
}

export function cardFaceEvidence(card: DeckstateScryfallCard): DeckstateCardFace[] {
  return card.cardFaces.length ? card.cardFaces : [{ name: card.name, manaCost: card.manaCost, typeLine: card.typeLine, oracleText: card.oracleText }];
}
