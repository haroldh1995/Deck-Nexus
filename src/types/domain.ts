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
  manaCost?: string;
  typeLine?: string;
  oracleText?: string;
  colorIdentity?: CommanderColor[];
  quantityOwned: number;
  printings: OwnedPrinting[];
  tags: string[];
  notes: string;
  favorite: boolean;
  storageLocation?: string;
  duplicateFlag: OwnedDuplicateFlag;
  deckUsage: Record<string, number>;
  lastScannedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type OwnedDuplicateFlag =
  | "none"
  | "needs_review"
  | "multiple_owned"
  | "sharing_between_decks";

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

export type ScanBatchStatus =
  | "open"
  | "completed"
  | "archived"
  | "scanning"
  | "paused"
  | "needs_review"
  | "reviewing"
  | "partially_applied"
  | "applied"
  | "saved_for_later"
  | "discarded";

export type ScannerMode =
  | "owned"
  | "deck"
  | "section"
  | "batch"
  | "correction"
  | "automatic_feeder"
  | "stacking_feeder";

export type ScanBatchDestination =
  | "owned_cards"
  | "current_deck"
  | "main_deck"
  | "maybeboard"
  | "cuts"
  | "extras_tokens"
  | "new_deck"
  | "new_list"
  | "existing_list"
  | "custom_collection";

export type ScanExtraKind =
  | "token"
  | "emblem"
  | "art_card"
  | "ad_card"
  | "checklist"
  | "dungeon"
  | "attraction"
  | "plane"
  | "scheme"
  | "sticker_card"
  | "other";

export interface ScanBatch {
  id: string;
  name: string;
  status: ScanBatchStatus;
  mode?: ScannerMode;
  destination?: ScanBatchDestination;
  deckId?: string;
  sectionId?: string;
  recordsCreated: number;
  persistenceEnabled: boolean;
  prompt?: string;
  lastCue?: string;
  createdAt: string;
  updatedAt: string;
}

export type ScanRecordStatus =
  | "unresolved"
  | "matched"
  | "ignored"
  | "added_to_owned"
  | "confirmed"
  | "assumed"
  | "low_confidence"
  | "removed"
  | "applied";

export interface ScanRecord {
  id: string;
  batchId: string;
  rawText: string;
  scryfallId?: string;
  oracleId?: string;
  name: string;
  quantity: number;
  status: ScanRecordStatus;
  confidence?: number;
  possibleMatches?: string[];
  typeLine?: string;
  colorIdentity?: CommanderColor[];
  destination?: ScanBatchDestination;
  extraKind?: ScanExtraKind;
  createdAt: string;
  updatedAt: string;
}

export type SmartBuildMode =
  | "owned_only"
  | "owned_first_missing_upgrades"
  | "ideal_goal_based"
  | "bracket_locked"
  | "rebuild_existing";

export type SmartBuildOutputPreference =
  | "apply_after_review"
  | "save_as_new_deck"
  | "send_to_maybeboard"
  | "upgrade_list_only";

export interface SmartBuildConfig {
  id: string;
  deckId?: string;
  mode: SmartBuildMode;
  commanderIds: string[];
  colorIdentity: CommanderColor[];
  goals: DeckGoal[];
  bracketLock: BracketLock;
  ownershipPreference: OwnershipPreference;
  doNotSuggest: string[];
  useCurrentDeckAsCore: boolean;
  protectedCardIds: string[];
  outputPreference: SmartBuildOutputPreference;
  createdAt: string;
}

export interface SmartBuildCard {
  id: string;
  scryfallId: string;
  oracleId: string;
  name: string;
  manaCost?: string;
  typeLine: string;
  quantity: number;
  reason: string;
  colorIdentity: CommanderColor[];
  targetSection: DeckCardSection;
  roleTags: string[];
  ownedQuantity: number;
  bracketFit: string;
  goalMatches: string[];
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
  config?: SmartBuildConfig;
  mode?: SmartBuildMode;
  commanderIds: string[];
  colorIdentity: CommanderColor[];
  goals: DeckGoal[];
  suggestions: SmartBuildSuggestion[];
  proposedCards?: SmartBuildCard[];
  keptCards?: SmartBuildCard[];
  cutCards?: SmartBuildCard[];
  missingCards?: SmartBuildCard[];
  summary?: string;
  applied?: boolean;
  rejectedOutsideColorIdentity: SmartBuildSuggestion[];
  createdAt: string;
}

export interface DeckRecommendation {
  id: string;
  deckId?: string;
  scryfallId: string;
  oracleId: string;
  name: string;
  manaCost?: string;
  typeLine: string;
  colorIdentity: CommanderColor[];
  roleTags: string[];
  reason: string;
  synergyReason: string;
  goalMatches: string[];
  ownedQuantity: number;
  bracketFit: string;
  tab:
    | "best_fits"
    | "owned_first"
    | "role_fixes"
    | "goal_support"
    | "goal_specific"
    | "mana_curve"
    | "staples"
    | "replacements"
    | "wild";
  createdAt: string;
}

export type RecommendationFeedbackType =
  | "favorite"
  | "not_interested"
  | "never_suggest_card"
  | "never_suggest_strategy";

export interface RecommendationFeedback {
  id: string;
  deckId?: string;
  oracleId?: string;
  strategy?: string;
  type: RecommendationFeedbackType;
  createdAt: string;
}

export interface AnalysisIssue {
  id: string;
  severity: "excellent" | "healthy" | "needs_work" | "incomplete" | "illegal" | "above_bracket" | "below_bracket" | "needs_review";
  title: string;
  detail: string;
  action?: string;
}

export interface DeckSuggestion {
  id: string;
  title: string;
  detail: string;
  source: "analyzer" | "recommend" | "smart_build";
  cardName?: string;
  targetSection?: DeckCardSection;
}

export interface ManaCurveSummary {
  averageManaValue: number;
  buckets: Record<string, number>;
}

export interface OwnershipSummary {
  ownedCount: number;
  missingCount: number;
  duplicateWarnings: number;
}

export interface DeckAnalysis {
  id: string;
  deckId: string;
  cardCount: number;
  colorIdentity: CommanderColor[];
  categoryCounts: Record<string, number>;
  roleCounts: Record<string, number>;
  health?: string;
  legalityIssues?: AnalysisIssue[];
  suggestions?: DeckSuggestion[];
  manaCurve?: ManaCurveSummary;
  ownership?: OwnershipSummary;
  notes: string[];
  createdAt: string;
}

export type MaybeboardSource =
  | "Manual Search"
  | "Recommend"
  | "Smart Build"
  | "Analyzer"
  | "Import"
  | "Scanner"
  | "Replacement Assistant"
  | "Owned Cards";

export interface MaybeboardCard extends DeckCard {
  source?: MaybeboardSource;
  reason?: string;
  goalMatches?: string[];
}

export type CutReason =
  | "Too high mana value"
  | "Low synergy"
  | "Off-theme"
  | "Role overlap"
  | "Above Bracket Lock"
  | "Not owned"
  | "Better replacement found"
  | "Too many of this role"
  | "Mana curve issue"
  | "Commander color issue"
  | "Testing cut"
  | "Manual cut"
  | "Other";

export interface CutCard extends DeckCard {
  source?: string;
  reason?: CutReason;
  replacementCardId?: string;
  previousSection?: DeckCardSection;
  deckVersion?: string;
}

export interface ReplacementRecord {
  id: string;
  deckId: string;
  removedCardId: string;
  replacementCardId: string;
  reason: string;
  createdAt: string;
}

export type DeckDecisionEvent = DecisionEvent;

export interface DeckVersion {
  id: string;
  deckId: string;
  label: string;
  beforeCardIds: string[];
  afterCardIds: string[];
  source: "smart_build" | "manual" | "import" | "scanner";
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

export type HomePerformanceMode = "full" | "balanced" | "performance";

export interface AppSettings {
  id: "app";
  reducedMotion: boolean;
  staticHomeScreen: boolean;
  homePerformanceMode: HomePerformanceMode;
  deviceTiltParallax: boolean;
  glowIntensity: number;
  highContrast: boolean;
  textSize: TextSize;
  localFirstMode: true;
  defaultExportFormat: ExportFormat;
  defaultBracketLock: BracketLock;
  defaultOwnershipPreference: OwnershipPreference;
  scannerBatchPersistence: boolean;
  homeOrbitOrder: string[];
  homeOrbitHiddenIds: string[];
  updatedAt: string;
}
