import type { Deck, DeckCard } from "../../types/domain";

export type DeckImportFormat =
  | "plain_text"
  | "mtg_arena"
  | "csv"
  | "deck_nexus_json"
  | "deck_nexus_backup"
  | "boardstate_shared_contract"
  | "zip_package";

export type ParsedImportSection =
  | "commander"
  | "main"
  | "maybeboard"
  | "companion"
  | "cuts";

export interface ParsedImportEntry {
  id: string;
  quantity: number;
  name: string;
  setCode?: string;
  collectorNumber?: string;
  section: ParsedImportSection;
  originalLine: string;
  duplicateCount: number;
}

export interface ParsedDeckImport {
  deckName: string;
  format: DeckImportFormat;
  entries: ParsedImportEntry[];
  sourceText: string;
  warnings: string[];
  errors: string[];
}

const maxQuantity = 999;
const decoder = new TextDecoder();
const encoder = new TextEncoder();

const headingToSection = new Map<string, ParsedImportSection>([
  ["commander", "commander"],
  ["commanders", "commander"],
  ["companion", "companion"],
  ["deck", "main"],
  ["mainboard", "main"],
  ["main board", "main"],
  ["main deck", "main"],
  ["creature", "main"],
  ["creatures", "main"],
  ["instant", "main"],
  ["instants", "main"],
  ["sorcery", "main"],
  ["sorceries", "main"],
  ["artifact", "main"],
  ["artifacts", "main"],
  ["enchantment", "main"],
  ["enchantments", "main"],
  ["planeswalker", "main"],
  ["planeswalkers", "main"],
  ["battle", "main"],
  ["battles", "main"],
  ["land", "main"],
  ["lands", "main"],
  ["sideboard", "maybeboard"],
  ["maybeboard", "maybeboard"],
  ["maybe board", "maybeboard"],
  ["considering", "maybeboard"],
  ["cuts", "cuts"],
  ["cut", "cuts"],
]);

export function sanitizeImportedText(value: string, fallback = "Imported Deck"): string {
  const cleaned = value
    .split("")
    .map((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127 ? " " : character;
    })
    .join("")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned.slice(0, 120) || fallback;
}

export function normalizeImportedName(value: string): string {
  return sanitizeImportedText(value, "")
    .normalize("NFKC")
    .replace(/\s+\/\/\s+/g, " // ")
    .toLowerCase();
}

function stripKnownDecorations(value: string): string {
  return value
    .replace(/^\s*(?:\/\/|#).*/, "")
    .replace(/^\s*(?:SB:|SIDEBOARD:)\s*/i, "")
    .replace(/\s+\*F\*\s*$/i, "")
    .replace(/\s+\*CMDR\*\s*$/i, "")
    .trim();
}

function headingFor(value: string): ParsedImportSection | undefined {
  const normalized = value
    .trim()
    .replace(/:$/, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
  return headingToSection.get(normalized);
}

function parseQuantityLine(rawLine: string, section: ParsedImportSection): ParsedImportEntry | undefined {
  const cleaned = stripKnownDecorations(rawLine);

  if (!cleaned || headingFor(cleaned)) {
    return undefined;
  }

  const match = cleaned.match(/^(\d{1,4})\s*x?\s+(.+)$/i);
  const quantity = match ? Number(match[1]) : 1;
  let namePart = (match ? match[2] : cleaned).trim();

  if (!Number.isInteger(quantity) || quantity <= 0 || quantity > maxQuantity) {
    return {
      id: "",
      quantity: 0,
      name: sanitizeImportedText(namePart, "Invalid card"),
      section,
      originalLine: rawLine,
      duplicateCount: 1,
    };
  }

  const printingMatch = namePart.match(/^(.*?)\s+\(([A-Za-z0-9]{2,8})\)(?:\s+([A-Za-z0-9-]+))?\s*$/);
  const setCode = printingMatch?.[2]?.toLowerCase();
  const collectorNumber = printingMatch?.[3];
  if (printingMatch?.[1]) {
    namePart = printingMatch[1].trim();
  }

  const name = sanitizeImportedText(namePart, "");
  if (!name) {
    return undefined;
  }

  return {
    id: "",
    quantity,
    name,
    setCode,
    collectorNumber,
    section,
    originalLine: rawLine,
    duplicateCount: 1,
  };
}

function finalizeEntries(entries: ParsedImportEntry[], warnings: string[]): ParsedImportEntry[] {
  const merged = new Map<string, ParsedImportEntry>();

  for (const entry of entries) {
    if (entry.quantity <= 0) {
      warnings.push(`Invalid quantity ignored for ${entry.name}.`);
      continue;
    }

    const key = [
      entry.section,
      normalizeImportedName(entry.name),
      entry.setCode ?? "",
      entry.collectorNumber ?? "",
    ].join("|");
    const existing = merged.get(key);
    if (existing) {
      existing.quantity += entry.quantity;
      existing.duplicateCount += 1;
      existing.originalLine = `${existing.originalLine}\n${entry.originalLine}`;
      warnings.push(`Duplicate import entries were merged for ${entry.name}.`);
    } else {
      merged.set(key, { ...entry });
    }
  }

  return [...merged.values()].map((entry, index) => ({
    ...entry,
    id: `import-entry-${index + 1}`,
  }));
}

export function parseDecklistText(
  sourceText: string,
  options: { deckName?: string } = {},
): ParsedDeckImport {
  const warnings: string[] = [];
  const errors: string[] = [];
  const lines = sourceText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  let section: ParsedImportSection = "main";
  let sawArenaHeading = false;
  const entries: ParsedImportEntry[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith("//")) {
      continue;
    }

    const nextSection = headingFor(line);
    if (nextSection) {
      section = nextSection;
      if (/^(deck|commander|sideboard|companion)$/i.test(line.replace(/:$/, ""))) {
        sawArenaHeading = true;
      }
      continue;
    }

    const parsed = parseQuantityLine(line, section);
    if (parsed) {
      entries.push(parsed);
    }
  }

  const finalized = finalizeEntries(entries, warnings);
  if (finalized.length === 0) {
    errors.push("No recognizable card lines were found.");
  }

  return {
    deckName: sanitizeImportedText(options.deckName ?? "", "Imported Deck"),
    format: sawArenaHeading ? "mtg_arena" : "plain_text",
    entries: finalized,
    sourceText,
    warnings,
    errors,
  };
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && quoted && nextCharacter === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      quoted = !quoted;
      continue;
    }

    if (character === "," && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  cells.push(current.trim());
  return cells;
}

export function parseCsvDecklist(
  sourceText: string,
  options: { deckName?: string } = {},
): ParsedDeckImport {
  const warnings: string[] = [];
  const rows = sourceText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map(splitCsvLine)
    .filter((row) => row.some(Boolean));
  const header = rows[0]?.map((cell) => cell.toLowerCase()) ?? [];
  const hasHeader = header.some((cell) => ["name", "card", "card name"].includes(cell));
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const indexOf = (names: string[], fallback: number) => {
    const found = names.map((name) => header.indexOf(name)).find((index) => index >= 0);
    return found ?? fallback;
  };
  const quantityIndex = hasHeader ? indexOf(["quantity", "qty", "count"], 0) : 0;
  const nameIndex = hasHeader ? indexOf(["name", "card", "card name"], 1) : 1;
  const setIndex = hasHeader ? indexOf(["set", "set code", "setcode"], -1) : 2;
  const collectorIndex = hasHeader ? indexOf(["collector number", "collector", "number", "cn"], -1) : 3;
  const sectionIndex = hasHeader ? indexOf(["section", "zone", "board"], -1) : 4;
  const entries: ParsedImportEntry[] = [];

  for (const row of dataRows) {
    const quantity = Number(row[quantityIndex] ?? 1);
    const name = sanitizeImportedText(row[nameIndex] ?? "", "");
    if (!name) {
      continue;
    }
    const requestedSection = headingFor(row[sectionIndex] ?? "") ?? "main";

    entries.push({
      id: "",
      quantity: Number.isInteger(quantity) && quantity > 0 && quantity <= maxQuantity ? quantity : 0,
      name,
      setCode: row[setIndex]?.toLowerCase() || undefined,
      collectorNumber: row[collectorIndex] || undefined,
      section: requestedSection,
      originalLine: row.join(","),
      duplicateCount: 1,
    });
  }

  const finalized = finalizeEntries(entries, warnings);
  return {
    deckName: sanitizeImportedText(options.deckName ?? "", "Imported Deck"),
    format: "csv",
    entries: finalized,
    sourceText,
    warnings,
    errors: finalized.length === 0 ? ["No recognizable card rows were found."] : [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertSafeJson(value: unknown, depth = 0): void {
  if (depth > 24) {
    throw new Error("Structured import is too deeply nested.");
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      assertSafeJson(item, depth + 1);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [key, item] of Object.entries(value)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      throw new Error("Structured import contains unsafe keys.");
    }
    assertSafeJson(item, depth + 1);
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function sectionFromSnapshot(value: unknown): ParsedImportSection {
  if (value === "commander") return "commander";
  if (value === "maybeboard") return "maybeboard";
  if (value === "cuts") return "cuts";
  return "main";
}

function entryFromRecord(record: Record<string, unknown>, fallbackSection: ParsedImportSection): ParsedImportEntry | undefined {
  const name = sanitizeImportedText(asString(record.name) ?? "", "");
  if (!name) {
    return undefined;
  }
  const quantity = Math.trunc(asNumber(record.quantity) ?? 1);

  return {
    id: "",
    quantity: quantity > 0 && quantity <= maxQuantity ? quantity : 0,
    name,
    setCode: asString(record.setCode)?.toLowerCase(),
    collectorNumber: asString(record.collectorNumber),
    section: sectionFromSnapshot(record.section) === "main" ? fallbackSection : sectionFromSnapshot(record.section),
    originalLine: `${quantity || 1} ${name}`,
    duplicateCount: 1,
  };
}

function entriesFromDeckSnapshot(snapshot: Record<string, unknown>): ParsedImportEntry[] {
  const entries: ParsedImportEntry[] = [];
  const sections: [string, ParsedImportSection][] = [
    ["mainDeck", "main"],
    ["maybeboard", "maybeboard"],
    ["cuts", "cuts"],
  ];

  for (const [key, fallbackSection] of sections) {
    const cards = snapshot[key];
    if (!Array.isArray(cards)) {
      continue;
    }
    for (const card of cards) {
      if (isRecord(card)) {
        const entry = entryFromRecord(card, fallbackSection);
        if (entry) entries.push(entry);
      }
    }
  }

  return entries;
}

function entriesFromDeck(deck: Deck): ParsedImportEntry[] {
  return [...deck.cards, ...deck.maybeboard, ...deck.cuts].map((card) => ({
    id: "",
    quantity: card.quantity,
    name: card.name,
    setCode: card.setCode?.toLowerCase(),
    collectorNumber: card.collectorNumber,
    section: card.section === "commander" ? "commander" : card.section,
    originalLine: `${card.quantity} ${card.name}`,
    duplicateCount: 1,
  }));
}

function parseBackupObject(contents: Record<string, unknown>, sourceText: string): ParsedDeckImport | undefined {
  if (contents.packageKind !== "deck-nexus-full-backup" || !isRecord(contents.tables)) {
    return undefined;
  }

  const decks = contents.tables.decks;
  if (!Array.isArray(decks) || !isRecord(decks[0])) {
    return {
      deckName: "Imported Deck",
      format: "deck_nexus_backup",
      entries: [],
      sourceText,
      warnings: [],
      errors: ["Backup package does not contain an importable deck."],
    };
  }

  const sourceDeck = decks[0] as unknown as Deck;
  const deckId = sourceDeck.id;
  const cardRows = [
    ...(Array.isArray(contents.tables.deckCards) ? contents.tables.deckCards : []),
    ...(Array.isArray(contents.tables.maybeboardCards) ? contents.tables.maybeboardCards : []),
    ...(Array.isArray(contents.tables.cutCards) ? contents.tables.cutCards : []),
  ].filter((row): row is DeckCard => isRecord(row) && row.deckId === deckId && typeof row.name === "string");
  const deck: Deck = {
    ...sourceDeck,
    cards: cardRows.filter((card) => card.section === "main" || card.section === "commander"),
    maybeboard: cardRows.filter((card) => card.section === "maybeboard"),
    cuts: cardRows.filter((card) => card.section === "cuts"),
  };

  return {
    deckName: sanitizeImportedText(sourceDeck.name ?? "", "Imported Backup Deck"),
    format: "deck_nexus_backup",
    entries: finalizeEntries(entriesFromDeck(deck), []),
    sourceText,
    warnings: decks.length > 1 ? ["Backup contains multiple decks; importing the first deck only."] : [],
    errors: [],
  };
}

export function parseStructuredDeckImport(
  sourceText: string,
  options: { deckName?: string } = {},
): ParsedDeckImport {
  let parsed: unknown;

  try {
    parsed = JSON.parse(sourceText);
    assertSafeJson(parsed);
  } catch (error) {
    return {
      deckName: sanitizeImportedText(options.deckName ?? "", "Imported Deck"),
      format: "deck_nexus_json",
      entries: [],
      sourceText,
      warnings: [],
      errors: [error instanceof Error ? error.message : "Invalid JSON."],
    };
  }

  if (!isRecord(parsed)) {
    return {
      deckName: sanitizeImportedText(options.deckName ?? "", "Imported Deck"),
      format: "deck_nexus_json",
      entries: [],
      sourceText,
      warnings: [],
      errors: ["Structured import must be a JSON object."],
    };
  }

  const backupContents = isRecord(parsed.contents) ? parsed.contents : parsed;
  const backup = parseBackupObject(backupContents, sourceText);
  if (backup) {
    return backup;
  }

  const packageFormat =
    parsed.sourceApplication === "deck_nexus" && parsed.launchSchemaVersion
      ? "boardstate_shared_contract"
      : "deck_nexus_json";
  const snapshot =
    isRecord(parsed.deckSnapshot)
      ? parsed.deckSnapshot
      : isRecord(parsed.immutableEnvelope) && isRecord(parsed.immutableEnvelope.deckSnapshot)
        ? parsed.immutableEnvelope.deckSnapshot
        : isRecord(parsed.envelope) && isRecord(parsed.envelope.deckSnapshot)
          ? parsed.envelope.deckSnapshot
          : parsed;
  const snapshotEntries = Array.isArray(snapshot.mainDeck)
    ? finalizeEntries(entriesFromDeckSnapshot(snapshot), [])
    : [];

  if (snapshotEntries.length > 0) {
    return {
      deckName: sanitizeImportedText(asString(snapshot.deckName) ?? asString(snapshot.name) ?? options.deckName ?? "", "Imported Deck"),
      format: packageFormat,
      entries: snapshotEntries,
      sourceText,
      warnings: [],
      errors: [],
    };
  }

  if (Array.isArray(parsed.cards) || Array.isArray(parsed.maybeboard) || Array.isArray(parsed.cuts)) {
    const deckLikeEntries = [
      ...(Array.isArray(parsed.cards) ? parsed.cards : []),
      ...(Array.isArray(parsed.maybeboard) ? parsed.maybeboard : []),
      ...(Array.isArray(parsed.cuts) ? parsed.cuts : []),
    ];
    const entriesFromCards = finalizeEntries(
      deckLikeEntries
        .filter(isRecord)
        .map((card) => entryFromRecord(card, sectionFromSnapshot(card.section)))
        .filter((entry): entry is ParsedImportEntry => Boolean(entry)),
      [],
    );
    return {
      deckName: sanitizeImportedText(asString(parsed.name) ?? options.deckName ?? "", "Imported Deck"),
      format: "deck_nexus_json",
      entries: entriesFromCards,
      sourceText,
      warnings: [],
      errors: entriesFromCards.length === 0 ? ["JSON did not contain importable cards."] : [],
    };
  }

  return {
    deckName: sanitizeImportedText(options.deckName ?? "", "Imported Deck"),
    format: packageFormat,
    entries: [],
    sourceText,
    warnings: [],
    errors: ["JSON did not match a supported Deck Nexus, backup, or BoardState contract deck format."],
  };
}

function readUint16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0;
}

export function extractUncompressedZipEntries(bytes: Uint8Array): Record<string, string> {
  const entries: Record<string, string> = {};
  let offset = 0;

  while (offset + 30 <= bytes.byteLength) {
    const signature = readUint32(bytes, offset);
    if (signature !== 0x04034b50) {
      break;
    }

    const method = readUint16(bytes, offset + 8);
    const compressedSize = readUint32(bytes, offset + 18);
    const fileNameLength = readUint16(bytes, offset + 26);
    const extraLength = readUint16(bytes, offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + fileNameLength + extraLength;
    const dataEnd = dataStart + compressedSize;

    if (dataEnd > bytes.byteLength) {
      throw new Error("ZIP package is truncated.");
    }

    const path = decoder.decode(bytes.slice(nameStart, nameStart + fileNameLength));
    if (path.includes("..") || path.startsWith("/") || path.startsWith("\\")) {
      throw new Error("ZIP package contains an unsafe path.");
    }
    if (method !== 0) {
      throw new Error("Compressed ZIP entries are not supported by this importer.");
    }

    entries[path] = decoder.decode(bytes.slice(dataStart, dataEnd));
    offset = dataEnd;
  }

  return entries;
}

export function parseZipDeckImport(bytes: Uint8Array): ParsedDeckImport {
  try {
    const entries = extractUncompressedZipEntries(bytes);
    const jsonPath =
      Object.keys(entries).find((path) => /deck-snapshot\.json$/i.test(path)) ??
      Object.keys(entries).find((path) => /\.json$/i.test(path));

    if (!jsonPath) {
      return {
        deckName: "Imported Deck",
        format: "zip_package",
        entries: [],
        sourceText: "",
        warnings: [],
        errors: ["ZIP package does not contain a supported JSON deck file."],
      };
    }

    return {
      ...parseStructuredDeckImport(entries[jsonPath]),
      format: "zip_package",
      sourceText: entries[jsonPath],
    };
  } catch (error) {
    return {
      deckName: "Imported Deck",
      format: "zip_package",
      entries: [],
      sourceText: "",
      warnings: [],
      errors: [error instanceof Error ? error.message : "ZIP package could not be read."],
    };
  }
}

export function importTextFileName(fileName: string): string {
  return sanitizeImportedText(fileName.replace(/\.[^.]+$/, ""), "Imported Deck");
}

export function readBytesAsText(bytes: Uint8Array): string {
  return decoder.decode(bytes);
}

export function textToBytes(text: string): Uint8Array {
  return encoder.encode(text);
}
