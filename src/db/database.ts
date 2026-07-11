import Dexie, { type Table } from "dexie";
import type {
  AppMigration,
  AppSettings,
  BackupPackage,
  BoardStateValidationResultRecord,
  BracketAnalysis,
  Category,
  CustomCollection,
  CustomCollectionEntry,
  DecisionEvent,
  Deck,
  DeckAnalysis,
  DeckCard,
  DeckVersion,
  DeckGroup,
  DestinationAction,
  ExportHistory,
  FavoriteItem,
  ImportResult,
  OwnedCard,
  OwnedPrinting,
  RecommendationFeedback,
  ReplacementRecord,
  SavedSearch,
  ScanBatch,
  ScanRecord,
  SearchSelectionSession,
  SearchUndoTransaction,
  SmartBuildResult,
  ScryfallAutocompleteCacheRecord,
  ScryfallBulkDataRecord,
  ScryfallCacheMeta,
  ScryfallCardCacheRecord,
  ScryfallSearchCacheRecord,
  Tag,
  UpgradeList,
  UpgradeListEntry,
  WishlistEntry,
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
  recommendationFeedback!: Table<RecommendationFeedback, string>;
  replacementRecords!: Table<ReplacementRecord, string>;
  deckVersions!: Table<DeckVersion, string>;
  settings!: Table<AppSettings, string>;
  backups!: Table<BackupPackage, string>;
  appMigrations!: Table<AppMigration, string>;
  scryfallCards!: Table<ScryfallCardCacheRecord, string>;
  scryfallOracleCards!: Table<ScryfallCardCacheRecord, string>;
  scryfallAutocomplete!: Table<ScryfallAutocompleteCacheRecord, string>;
  scryfallSearches!: Table<ScryfallSearchCacheRecord, string>;
  scryfallBulkData!: Table<ScryfallBulkDataRecord, string>;
  scryfallCacheMeta!: Table<ScryfallCacheMeta, string>;
  wishlist!: Table<WishlistEntry, string>;
  upgradeLists!: Table<UpgradeList, string>;
  upgradeListEntries!: Table<UpgradeListEntry, string>;
  customCollections!: Table<CustomCollection, string>;
  customCollectionEntries!: Table<CustomCollectionEntry, string>;
  searchSelectionSessions!: Table<SearchSelectionSession, string>;
  destinationActionHistory!: Table<DestinationAction, string>;
  searchUndoTransactions!: Table<SearchUndoTransaction, string>;
  boardStateValidationResults!: Table<BoardStateValidationResultRecord, string>;

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

    this.version(2).stores({
      scryfallCards:
        "&id, oracleId, name, setCode, collectorNumber, updatedAt, lastFetchedAt, *card.colorIdentity, *card.keywords",
      scryfallOracleCards:
        "&id, oracleId, name, setCode, collectorNumber, updatedAt, lastFetchedAt",
      scryfallAutocomplete: "&key, query, updatedAt",
      scryfallSearches: "&key, query, page, unique, sort, direction, updatedAt",
      scryfallBulkData: "&id, type, updatedAt, fetchedAt",
      scryfallCacheMeta: "&id, updatedAt",
    });

    this.version(3).stores({
      wishlist:
        "&id, scryfallId, oracleId, cardName, priority, ownershipStatus, updatedAt, createdAt, *intendedDeckIds, *tags",
      upgradeLists:
        "&id, name, relatedDeckId, bracketTarget, favorite, showOnHome, archived, updatedAt, createdAt, *tags",
      upgradeListEntries:
        "&id, upgradeListId, scryfallId, oracleId, cardName, priority, completed, updatedAt, createdAt",
      customCollections:
        "&id, name, favorite, showOnHome, archived, sortMode, updatedAt, createdAt, *tags",
      customCollectionEntries:
        "&id, collectionId, scryfallId, oracleId, cardName, customOrder, updatedAt, createdAt, *tags",
      searchSelectionSessions:
        "&id, query, context, deckId, updatedAt, createdAt, *selectedScryfallIds",
      destinationActionHistory:
        "&id, actionType, destinationType, destinationId, status, createdAt, completedAt, *selectedCardIds",
      searchUndoTransactions: "&id, actionId, undoType, createdAt, expiresAt",
    });

    this.version(4).stores({
      recommendationFeedback: "&id, deckId, oracleId, strategy, type, createdAt",
      replacementRecords: "&id, deckId, removedCardId, replacementCardId, createdAt",
      deckVersions: "&id, deckId, source, createdAt",
    });

    this.version(5).stores({
      boardStateValidationResults:
        "&id, deckId, snapshotId, snapshotChecksum, requestId, responseId, status, legalityStatus, stale, receivedAt, validatedAt",
    });
  }
}

export const db = new DeckNexusDatabase();

export async function resetDatabaseForTests(): Promise<void> {
  await db.delete();
  await db.open();
}
