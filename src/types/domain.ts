export type CommanderColor = "W" | "U" | "B" | "R" | "G";

export type DeckFormat = "commander";

export type DeckCardSection = "main" | "commander" | "maybeboard" | "cuts";

export type DeckStatus = "draft" | "active" | "archived";

export type DeckCreatedFrom =
  | "blank"
  | "commander_search"
  | "deck_import"
  | "owned_cards"
  | "backup_restore";

export type DeckStyle =
  | "unspecified"
  | "battlecruiser"
  | "precon_plus"
  | "synergy"
  | "aristocrats"
  | "spellslinger"
  | "tokens"
  | "voltron"
  | "combo"
  | "control"
  | "stax"
  | "custom";

export type OwnershipPreference =
  | "owned_first"
  | "owned_only"
  | "allow_missing";

export type CategoryStyle =
  | "commander_roles"
  | "card_type"
  | "custom"
  | "none";

export type Bracket =
  | "bracket_1"
  | "bracket_2"
  | "bracket_3"
  | "bracket_4"
  | "bracket_5"
  | "custom";

export interface BracketLock {
  enabled: boolean;
  bracket: Bracket;
  allowCombos: boolean;
  allowTutors: boolean;
  allowFastMana: boolean;
  allowStax: boolean;
  allowMassLandDestruction: boolean;
  allowExtraTurns: boolean;
}

export type DeckGoalType =
  | "theme"
  | "power"
  | "owned_cards"
  | "card_category"
  | "custom";

export interface DeckGoal {
  id: string;
  name: string;
  priority: number;
  type: DeckGoalType;
  settings: Record<string, unknown>;
}

export interface DeckCard {
  id: string;
  deckId: string;
  scryfallId: string;
  oracleId: string;
  name: string;
  manaCost?: string;
  typeLine?: string;
  oracleText?: string;
  colorIdentity?: CommanderColor[];
  quantity: number;
  section: DeckCardSection;
  categories: string[];
  roleTags: string[];
  customTags: string[];
  notes: string;
  protected: boolean;
  ownedQuantityAtAdd: number;
  missingQuantity: number;
  bracketImpact?: number;
  cutReason?: string;
  addedAt: string;
  updatedAt: string;
}

export interface Deck {
  id: string;
  name: string;
  format: DeckFormat;
  commanderIds: string[];
  commanderNames: string[];
  colorIdentity: CommanderColor[];
  cards: DeckCard[];
  maybeboard: DeckCard[];
  cuts: DeckCard[];
  goals: DeckGoal[];
  tags: string[];
  style: DeckStyle;
  powerTarget: number;
  bracketLock: BracketLock;
  ownershipPreference: OwnershipPreference;
  categoryStyle: CategoryStyle;
  notes: string;
  status: DeckStatus;
  thumbnailCardId?: string;
  originalImportText: string;
  unresolvedImports: string[];
  createdFrom: DeckCreatedFrom;
  createdAt: string;
  updatedAt: string;
}

export interface OwnedPrinting {
  id: string;
  scryfallId: string;
  oracleId: string;
  name: string;
  setCode: string;
  setName: string;
  collectorNumber: string;
  language: string;
  foil: boolean;
  condition: string;
  quantityOwned: number;
  imageUri: string;
  lastScannedAt?: string;
}

export interface OwnedCard {
  id: string;
  oracleId: string;
  scryfallId: string;
  name: string;
  quantityOwned: number;
  printings: OwnedPrinting[];
  tags: string[];
  notes: string;
  favorite: boolean;
  duplicateFlag: boolean;
  deckUsage: Record<string, number>;
  lastScannedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type SavedSearchType =
  | "card_search"
  | "owned_cards"
  | "deck_filter"
  | "commander"
  | "keyword";

export interface SavedSearch {
  id: string;
  name: string;
  type: SavedSearchType;
  query: string;
  colorIdentity?: CommanderColor[];
  filters: Record<string, unknown>;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export type FavoriteItemType =
  | "deck"
  | "deck_group"
  | "tag"
  | "category"
  | "keyword"
  | "saved_search"
  | "commander"
  | "owned_card_filter";

export interface FavoriteItem {
  id: string;
  type: FavoriteItemType;
  targetId: string;
  title: string;
  subtitle?: string;
  route: string;
  order: number;
  colorIdentity?: CommanderColor[];
  createdAt: string;
  updatedAt: string;
}

export type TagKind = "deck" | "card" | "owned_card" | "global";

export interface Tag {
  id: string;
  name: string;
  kind: TagKind;
  color: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type CategoryScope = "deck" | "card" | "owned_card" | "analysis";

export interface Category {
  id: string;
  name: string;
  scope: CategoryScope;
  color: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface DeckGroup {
  id: string;
  name: string;
  description: string;
  deckIds: string[];
  tags: string[];
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ScanBatchStatus = "open" | "completed" | "archived";

export interface ScanBatch {
  id: string;
  name: string;
  status: ScanBatchStatus;
  recordsCreated: number;
  persistenceEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ScanRecordStatus =
  | "unresolved"
  | "matched"
  | "ignored"
  | "added_to_owned";

export interface ScanRecord {
  id: string;
  batchId: string;
  rawText: string;
  scryfallId?: string;
  oracleId?: string;
  name: string;
  quantity: number;
  status: ScanRecordStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SmartBuildSuggestion {
  id: string;
  scryfallId: string;
  oracleId: string;
  name: string;
  quantity: number;
  reason: string;
  colorIdentity: CommanderColor[];
  targetSection: DeckCardSection;
}

export interface SmartBuildResult {
  id: string;
  deckId: string;
  commanderIds: string[];
  colorIdentity: CommanderColor[];
  goals: DeckGoal[];
  suggestions: SmartBuildSuggestion[];
  rejectedOutsideColorIdentity: SmartBuildSuggestion[];
  createdAt: string;
}

export interface DeckAnalysis {
  id: string;
  deckId: string;
  cardCount: number;
  colorIdentity: CommanderColor[];
  categoryCounts: Record<string, number>;
  roleCounts: Record<string, number>;
  notes: string[];
  createdAt: string;
}

export interface BracketAnalysis {
  id: string;
  deckId: string;
  bracket: Bracket;
  bracketLock: BracketLock;
  warnings: string[];
  allowed: boolean;
  createdAt: string;
}

export type ImportResultStatus = "draft" | "resolved" | "needs_review";

export interface ImportResult {
  id: string;
  deckId?: string;
  sourceName: string;
  status: ImportResultStatus;
  originalText: string;
  resolvedCards: DeckCard[];
  unresolvedImports: string[];
  createdAt: string;
}

export type ExportFormat = "plain_text" | "json" | "csv";

export interface ExportHistory {
  id: string;
  deckId?: string;
  format: ExportFormat;
  fileName: string;
  createdAt: string;
}

export interface DecisionEvent {
  id: string;
  deckId?: string;
  type: string;
  message: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface BackupPackage {
  id: string;
  name: string;
  schemaVersion: number;
  deckCount: number;
  ownedCardCount: number;
  createdAt: string;
  contents: Record<string, unknown>;
}

export interface AppMigration {
  id: string;
  name: string;
  fromVersion: number;
  toVersion: number;
  appliedAt: string;
}

export type TextSize = "compact" | "normal" | "large";

export interface AppSettings {
  id: "app";
  reducedMotion: boolean;
  staticHomeScreen: boolean;
  glowIntensity: number;
  highContrast: boolean;
  textSize: TextSize;
  localFirstMode: true;
  defaultExportFormat: ExportFormat;
  defaultBracketLock: BracketLock;
  defaultOwnershipPreference: OwnershipPreference;
  scannerBatchPersistence: boolean;
  homeOrbitOrder: string[];
  updatedAt: string;
}
