import Dexie, { type Table } from "dexie";
import type {
  AppMigration,
  AppSettings,
  BackupPackage,
  BracketAnalysis,
  Category,
  DecisionEvent,
  Deck,
  DeckAnalysis,
  DeckCard,
  DeckGroup,
  ExportHistory,
  FavoriteItem,
  ImportResult,
  OwnedCard,
  OwnedPrinting,
  SavedSearch,
  ScanBatch,
  ScanRecord,
  SmartBuildResult,
  Tag,
} from "../types/domain";

export class DeckNexusDatabase extends Dexie {
  decks!: Table<Deck, string>;
  deckCards!: Table<DeckCard, string>;
  maybeboardCards!: Table<DeckCard, string>;
  cutCards!: Table<DeckCard, string>;
  ownedCards!: Table<OwnedCard, string>;
  ownedPrintings!: Table<OwnedPrinting, string>;
  scannerBatches!: Table<ScanBatch, string>;
  scanRecords!: Table<ScanRecord, string>;
  savedSearches!: Table<SavedSearch, string>;
  favorites!: Table<FavoriteItem, string>;
  tags!: Table<Tag, string>;
  categories!: Table<Category, string>;
  deckGroups!: Table<DeckGroup, string>;
  smartBuildResults!: Table<SmartBuildResult, string>;
  analysisSnapshots!: Table<DeckAnalysis, string>;
  bracketAnalysis!: Table<BracketAnalysis, string>;
  importResults!: Table<ImportResult, string>;
  exportHistory!: Table<ExportHistory, string>;
  decisionEvents!: Table<DecisionEvent, string>;
  settings!: Table<AppSettings, string>;
  backups!: Table<BackupPackage, string>;
  appMigrations!: Table<AppMigration, string>;

  constructor() {
    super("deck-nexus-local");

    this.version(1).stores({
      decks: "&id, format, status, updatedAt, createdFrom, *tags",
      deckCards:
        "&id, deckId, scryfallId, oracleId, name, section, updatedAt, *categories, *roleTags, *customTags",
      maybeboardCards:
        "&id, deckId, scryfallId, oracleId, name, section, updatedAt, *categories, *roleTags, *customTags",
      cutCards:
        "&id, deckId, scryfallId, oracleId, name, section, updatedAt, *categories, *roleTags, *customTags",
      ownedCards:
        "&id, oracleId, scryfallId, name, favorite, duplicateFlag, updatedAt, *tags",
      ownedPrintings:
        "&id, scryfallId, oracleId, name, setCode, language, foil, lastScannedAt",
      scannerBatches: "&id, status, createdAt, updatedAt",
      scanRecords:
        "&id, batchId, scryfallId, oracleId, name, status, createdAt, updatedAt",
      savedSearches: "&id, name, type, updatedAt, *tags",
      favorites: "&id, type, targetId, title, order, createdAt, updatedAt",
      tags: "&id, name, kind, updatedAt",
      categories: "&id, name, scope, sortOrder, updatedAt",
      deckGroups: "&id, name, favorite, updatedAt, *deckIds, *tags",
      smartBuildResults: "&id, deckId, createdAt, *colorIdentity",
      analysisSnapshots: "&id, deckId, createdAt, *colorIdentity",
      bracketAnalysis: "&id, deckId, bracket, createdAt",
      importResults: "&id, deckId, status, sourceName, createdAt",
      exportHistory: "&id, deckId, format, createdAt",
      decisionEvents: "&id, deckId, type, createdAt",
      settings: "&id, updatedAt",
      backups: "&id, name, schemaVersion, createdAt",
      appMigrations: "&id, name, appliedAt",
    });
  }
}

export const db = new DeckNexusDatabase();

export async function resetDatabaseForTests(): Promise<void> {
  await db.delete();
  await db.open();
}
