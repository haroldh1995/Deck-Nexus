import { defaultAppSettings } from "../../data/defaults";
import type {
  AppSettings,
  CommanderColor,
  Deck,
  DeckAnalysis,
  DeckCard,
  OwnedCard,
  OwnedPrinting,
} from "../../types/domain";
import { checksumObject, withChecksum } from "./checksum";
import {
  CURRENT_COMPATIBILITY_VERSION,
  CURRENT_EXPORT_VERSION,
  CURRENT_SCHEMA_VERSION,
  CURRENT_SNAPSHOT_VERSION,
  DECK_NEXUS_APPLICATION_ID,
  DECK_NEXUS_APPLICATION_NAME,
  DECK_NEXUS_APPLICATION_VERSION,
  type ApplicationMetadata,
  type BackupMetadata,
  type CollectionExportContext,
  type CollectionSnapshot,
  type CommanderMetadataSnapshot,
  type DeckMetadataSnapshot,
  type DeckOwnershipSummary,
  type DeckSnapshot,
  type EcosystemExportFormat,
  type EcosystemExportPackage,
  type EcosystemManifest,
  type ExportCapabilities,
  type ExportMetadata,
  type ProfileSnapshot,
  type SnapshotDeckCard,
  type SnapshotExportContext,
  type SnapshotOwnedCard,
  type SnapshotOwnedPrinting,
} from "./schemas";
import { createCurrentMigrationMetadata } from "./versioning";

const baseVersions = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  snapshotVersion: CURRENT_SNAPSHOT_VERSION,
  exportVersion: CURRENT_EXPORT_VERSION,
  compatibilityVersion: CURRENT_COMPATIBILITY_VERSION,
};

const capabilities: ExportCapabilities = {
  primaryJson: true,
  prettyJson: true,
  compressedJson: true,
  zipPackage: true,
  arenaText: true,
  immutableGameplaySnapshot: true,
  boardStateBridge: false,
  hubNetworking: false,
};

function sourceTimestamps(createdAt?: string, updatedAt?: string, override?: string) {
  const created = override ?? createdAt ?? updatedAt ?? new Date(0).toISOString();
  return {
    createdAt: created,
    updatedAt: override ?? updatedAt ?? created,
  };
}

export function createApplicationMetadata({
  createdAt,
  updatedAt,
}: {
  createdAt: string;
  updatedAt: string;
}): ApplicationMetadata {
  return withChecksum({
    ...baseVersions,
    applicationName: DECK_NEXUS_APPLICATION_NAME,
    applicationVersion: DECK_NEXUS_APPLICATION_VERSION,
    sourceApplication: DECK_NEXUS_APPLICATION_ID,
    currentProducer: DECK_NEXUS_APPLICATION_ID,
    supportedConsumerApplications: ["boardstate", "hub"],
    createdAt,
    updatedAt,
    checksum: null,
    digitalSignature: null,
    capabilities,
    compatibilityFlags: {
      boardState: {
        compatible: true,
        bridgeRequired: true,
        gameplayStateIncluded: false,
        validationIncluded: false,
      },
      hub: {
        compatible: true,
        adapterRequired: true,
        identityIncluded: false,
        friendsIncluded: false,
        notificationsIncluded: false,
      },
    },
  });
}

export function createExportMetadata({
  exportId,
  exportFormat,
  createdAt,
  updatedAt,
}: {
  exportId: string;
  exportFormat: EcosystemExportFormat;
  createdAt: string;
  updatedAt: string;
}): ExportMetadata {
  return withChecksum({
    ...baseVersions,
    exportId,
    exportFormat,
    sourceApplication: DECK_NEXUS_APPLICATION_ID,
    applicationVersion: DECK_NEXUS_APPLICATION_VERSION,
    createdAt,
    updatedAt,
    checksum: null,
    migration: createCurrentMigrationMetadata(),
  });
}

function ownedQuantityByOracle(ownedCards: readonly OwnedCard[] = []) {
  return ownedCards.reduce<Map<string, number>>((owned, card) => {
    owned.set(card.oracleId, (owned.get(card.oracleId) ?? 0) + card.quantityOwned);
    return owned;
  }, new Map<string, number>());
}

function mapDeckCard(
  card: DeckCard,
  ownedByOracle: Map<string, number>,
): SnapshotDeckCard {
  const ownedQuantity = ownedByOracle.get(card.oracleId);
  const missingQuantity =
    typeof ownedQuantity === "number"
      ? Math.max(0, card.quantity - ownedQuantity)
      : card.missingQuantity;
  const ownershipState =
    typeof ownedQuantity !== "number"
      ? "unknown"
      : missingQuantity <= 0
        ? "owned"
        : ownedQuantity > 0
          ? "partial"
          : "missing";

  return {
    ...baseVersions,
    id: card.id,
    deckId: card.deckId,
    oracleId: card.oracleId,
    scryfallId: card.scryfallId,
    name: card.name,
    quantity: card.quantity,
    section: card.section,
    commander: card.section === "commander",
    printingSelection: {
      scryfallId: card.scryfallId,
      oracleId: card.oracleId,
      setCode: card.setCode,
      setName: card.setName,
      collectorNumber: card.collectorNumber,
      imageUri: card.imageUri,
    },
    manaCost: card.manaCost,
    manaValue: card.manaValue,
    typeLine: card.typeLine,
    oracleText: card.oracleText,
    colorIdentity: card.colorIdentity ?? [],
    imageUris: card.imageUri ? { normal: card.imageUri } : undefined,
    customNotes: card.notes,
    ownershipState,
    missingQuantity,
    ownedQuantityAtAdd: card.ownedQuantityAtAdd,
    customTags: card.customTags,
    roleTags: card.roleTags,
    categories: card.categories,
    recommendationMetadata: {
      goalMatches: card.goalMatches ?? [],
      source: card.source,
      reason: card.reason,
      replacementCardId: card.replacementCardId,
    },
    analyticsMetadata: {
      bracketImpact: card.bracketImpact,
      protected: card.protected,
      legalities: card.legalities,
    },
    sorting: {
      name: card.name.toLowerCase(),
      section: card.section,
      sortKey: `${card.section}:${card.name.toLowerCase()}:${card.id}`,
    },
    customCategory: card.categories[0],
    createdAt: card.addedAt,
    updatedAt: card.updatedAt,
    sourceApplication: DECK_NEXUS_APPLICATION_ID,
    applicationVersion: DECK_NEXUS_APPLICATION_VERSION,
  };
}

function classifyCommanderCards(cards: SnapshotDeckCard[]) {
  const commanderCards = cards.filter((card) => card.commander);
  const partnerCommanders = commanderCards.filter((card) =>
    card.roleTags.some((tag) => /partner/i.test(tag)) ||
    /partner/i.test(card.typeLine ?? ""),
  );
  const background = commanderCards.find((card) =>
    /background/i.test(card.typeLine ?? "") ||
    card.roleTags.some((tag) => /background/i.test(tag)),
  );
  const companion = cards.find((card) =>
    card.roleTags.some((tag) => /companion/i.test(tag)) ||
    /companion/i.test(card.typeLine ?? ""),
  );
  return {
    primaryCommanders:
      partnerCommanders.length > 0
        ? commanderCards.filter((card) => !partnerCommanders.includes(card))
        : commanderCards,
    partnerCommanders,
    background,
    companion,
  };
}

function buildOwnershipSummary(cards: readonly SnapshotDeckCard[]): DeckOwnershipSummary {
  const totalQuantity = cards.reduce((sum, card) => sum + card.quantity, 0);
  const missingCards = cards.filter((card) => card.missingQuantity > 0);
  const missingQuantity = missingCards.reduce(
    (sum, card) => sum + card.missingQuantity,
    0,
  );
  return {
    totalCards: cards.length,
    totalQuantity,
    ownedQuantity: Math.max(0, totalQuantity - missingQuantity),
    missingQuantity,
    missingCards,
  };
}

function getEstimatedBracket(analysis?: DeckAnalysis) {
  const bracketNote = analysis?.notes.find((note) => /bracket_[1-5]/.test(note));
  return bracketNote?.match(/bracket_[1-5]/)?.[0] as DeckSnapshot["estimatedBracket"];
}

export function createDeckSnapshot(
  deck: Deck,
  context: SnapshotExportContext = {},
): DeckSnapshot {
  const timestamps = sourceTimestamps(deck.createdAt, deck.updatedAt, context.createdAt);
  const ownedByOracle = ownedQuantityByOracle(context.ownedCards);
  const allCards = [...deck.cards, ...deck.maybeboard, ...deck.cuts].map((card) =>
    mapDeckCard(card, ownedByOracle),
  );
  const mainDeck = allCards.filter(
    (card) => card.section === "main" || card.section === "commander",
  );
  const maybeboard = allCards.filter((card) => card.section === "maybeboard");
  const cuts = allCards.filter((card) => card.section === "cuts");
  const commanderCards = classifyCommanderCards(allCards);
  const ownershipSummary = buildOwnershipSummary(mainDeck);
  const applicationMetadata = createApplicationMetadata(timestamps);
  const exportFormat = context.exportFormat ?? "primary_json";
  const exportMetadata = createExportMetadata({
    exportId: `export:${deck.id}:${timestamps.updatedAt}`,
    exportFormat,
    ...timestamps,
  });
  const metadata: DeckMetadataSnapshot = {
    ...baseVersions,
    deckId: deck.id,
    deckName: deck.name,
    format: deck.format,
    style: deck.style,
    status: deck.status,
    createdFrom: deck.createdFrom,
    sourceApplication: DECK_NEXUS_APPLICATION_ID,
    applicationVersion: DECK_NEXUS_APPLICATION_VERSION,
    createdAt: deck.createdAt,
    updatedAt: deck.updatedAt,
    originalImportText: deck.originalImportText,
    unresolvedImports: deck.unresolvedImports,
  };
  const commander: CommanderMetadataSnapshot = {
    ...baseVersions,
    commanderIds: deck.commanderIds,
    commanderNames: deck.commanderNames,
    primaryCommanders: commanderCards.primaryCommanders,
    partnerCommanders: commanderCards.partnerCommanders,
    background: commanderCards.background,
    companion: commanderCards.companion,
    createdAt: deck.createdAt,
    updatedAt: deck.updatedAt,
    sourceApplication: DECK_NEXUS_APPLICATION_ID,
    applicationVersion: DECK_NEXUS_APPLICATION_VERSION,
  };
  const snapshotWithoutHash: DeckSnapshot = {
    ...baseVersions,
    snapshotId: `deck-snapshot:${deck.id}:${timestamps.updatedAt}`,
    deckId: deck.id,
    deckName: deck.name,
    format: deck.format,
    metadata,
    commander,
    colorIdentity: deck.colorIdentity,
    mainDeck,
    maybeboard,
    cuts,
    customCategories: Array.from(
      new Set(allCards.flatMap((card) => card.categories)),
    ).sort(),
    deckGoals: deck.goals,
    bracketLock: deck.bracketLock,
    estimatedBracket: getEstimatedBracket(context.analysis),
    recommendationMetadata: {
      recommendations: [...(context.recommendations ?? [])],
      smartBuilds: [...(context.smartBuilds ?? [])],
    },
    analyticsMetadata: {
      latestAnalysis: context.analysis,
      analysisNotes: context.analysis?.notes ?? [],
    },
    deckNotes: deck.notes,
    customTags: deck.tags,
    groups:
      context.groups
        ?.filter((group) => group.deckIds.includes(deck.id))
        .map((group) => group.id) ?? [],
    favorite:
      context.favorites?.some(
        (favorite) => favorite.type === "deck" && favorite.targetId === deck.id,
      ) ?? false,
    ownershipSummary,
    missingCards: ownershipSummary.missingCards,
    deckImage:
      allCards.find((card) => card.scryfallId === deck.thumbnailCardId)?.printingSelection
        .imageUri,
    timestamps,
    boardStateCompatibility: {
      bridgeRequired: true,
      validationStatus: "not_validated",
      gameplayStateIncluded: false,
    },
    hubCompatibility: {
      adapterRequired: true,
      profileLinked: false,
      syncStatus: "not_connected",
    },
    sourceApplication: DECK_NEXUS_APPLICATION_ID,
    applicationVersion: DECK_NEXUS_APPLICATION_VERSION,
    exportVersion: CURRENT_EXPORT_VERSION,
    exportFormat,
    createdAt: timestamps.createdAt,
    updatedAt: timestamps.updatedAt,
    snapshotHash: "",
    checksum: null,
    applicationMetadata,
    exportMetadata,
    migration: createCurrentMigrationMetadata(),
  };
  const checksum = checksumObject(snapshotWithoutHash);
  return {
    ...snapshotWithoutHash,
    snapshotHash: checksum,
    checksum,
  };
}

function mapOwnedPrinting(
  printing: OwnedPrinting,
  owner: OwnedCard,
): SnapshotOwnedPrinting {
  const timestamps = sourceTimestamps(owner.createdAt, owner.updatedAt, owner.updatedAt);
  return {
    ...baseVersions,
    id: printing.id,
    scryfallId: printing.scryfallId,
    oracleId: printing.oracleId,
    name: printing.name,
    setCode: printing.setCode,
    setName: printing.setName,
    collectorNumber: printing.collectorNumber,
    language: printing.language,
    foil: printing.foil,
    condition: printing.condition,
    quantityOwned: printing.quantityOwned,
    imageUri: printing.imageUri,
    purchaseMetadata: null,
    lastScannedAt: printing.lastScannedAt,
    createdAt: timestamps.createdAt,
    updatedAt: timestamps.updatedAt,
    sourceApplication: DECK_NEXUS_APPLICATION_ID,
    applicationVersion: DECK_NEXUS_APPLICATION_VERSION,
  };
}

export function mapOwnedCard(card: OwnedCard): SnapshotOwnedCard {
  return {
    ...baseVersions,
    id: card.id,
    oracleId: card.oracleId,
    scryfallId: card.scryfallId,
    name: card.name,
    quantityOwned: card.quantityOwned,
    printings: card.printings.map((printing) => mapOwnedPrinting(printing, card)),
    manaCost: card.manaCost,
    manaValue: card.manaValue,
    typeLine: card.typeLine,
    oracleText: card.oracleText,
    colorIdentity: card.colorIdentity ?? [],
    imageUri: card.imageUri,
    legalities: card.legalities,
    tags: card.tags,
    notes: card.notes,
    favorite: card.favorite,
    duplicateFlag: card.duplicateFlag,
    deckUsage: card.deckUsage,
    lastScannedAt: card.lastScannedAt,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
    sourceApplication: DECK_NEXUS_APPLICATION_ID,
    applicationVersion: DECK_NEXUS_APPLICATION_VERSION,
  };
}

function countBy<T>(items: readonly T[], key: (item: T) => string | undefined): Record<string, number> {
  return items.reduce<Record<string, number>>((counts, item) => {
    const value = key(item) || "unspecified";
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function summarizeColors(cards: readonly SnapshotOwnedCard[]): Record<string, number> {
  return cards.reduce<Record<string, number>>((summary, card) => {
    const key = card.colorIdentity.length > 0 ? card.colorIdentity.join("") : "C";
    summary[key] = (summary[key] ?? 0) + card.quantityOwned;
    return summary;
  }, {});
}

export function createCollectionSnapshot(
  ownedCards: readonly OwnedCard[],
  context: CollectionExportContext = {},
): CollectionSnapshot {
  const updatedAt =
    context.createdAt ??
    ownedCards.map((card) => card.updatedAt).sort().at(-1) ??
    new Date(0).toISOString();
  const timestamps = sourceTimestamps(undefined, updatedAt, updatedAt);
  const mappedCards = ownedCards.map(mapOwnedCard);
  const printings = mappedCards.flatMap((card) => card.printings);
  const snapshot: CollectionSnapshot = {
    ...baseVersions,
    snapshotId: `collection-snapshot:local:${timestamps.updatedAt}`,
    collectionId: "local-owned-cards",
    collectionName: "Deck Nexus Owned Cards",
    metadata: {
      createdAt: timestamps.createdAt,
      updatedAt: timestamps.updatedAt,
      sourceApplication: DECK_NEXUS_APPLICATION_ID,
      applicationVersion: DECK_NEXUS_APPLICATION_VERSION,
    },
    ownedCards: mappedCards,
    statistics: {
      uniqueCards: mappedCards.length,
      totalQuantity: mappedCards.reduce((sum, card) => sum + card.quantityOwned, 0),
      totalPrintings: printings.length,
    },
    setSummaries: countBy(printings, (printing) => printing.setCode),
    colorSummaries: summarizeColors(mappedCards),
    typeSummaries: countBy(mappedCards, (card) => card.typeLine?.split(" ")[0]),
    raritySummaries: { unspecified: mappedCards.length },
    favorites: mappedCards.filter((card) => card.favorite).map((card) => card.id),
    scannerMetadata: {
      batchCount: context.scanBatches?.length ?? 0,
      recordCount: context.scanRecords?.length ?? 0,
      lastScannedAt: mappedCards
        .map((card) => card.lastScannedAt)
        .filter(Boolean)
        .sort()
        .at(-1),
    },
    sourceApplication: DECK_NEXUS_APPLICATION_ID,
    applicationVersion: DECK_NEXUS_APPLICATION_VERSION,
    exportVersion: CURRENT_EXPORT_VERSION,
    exportFormat: context.exportFormat ?? "primary_json",
    compatibilityVersion: CURRENT_COMPATIBILITY_VERSION,
    createdAt: timestamps.createdAt,
    updatedAt: timestamps.updatedAt,
    checksum: null,
    applicationMetadata: createApplicationMetadata(timestamps),
    exportMetadata: createExportMetadata({
      exportId: `export:collection:${timestamps.updatedAt}`,
      exportFormat: context.exportFormat ?? "primary_json",
      ...timestamps,
    }),
  };
  return withChecksum(snapshot);
}

export function createProfileSnapshot(
  settings: AppSettings = defaultAppSettings,
  createdAt = settings.updatedAt,
): ProfileSnapshot {
  const timestamps = sourceTimestamps(undefined, settings.updatedAt, createdAt);
  return withChecksum({
    ...baseVersions,
    snapshotId: `profile-snapshot:local:${timestamps.updatedAt}`,
    profileId: "local-profile",
    appearanceSettings: {
      reducedMotion: settings.reducedMotion,
      staticHomeScreen: settings.staticHomeScreen,
      homePerformanceMode: settings.homePerformanceMode,
      deviceTiltParallax: settings.deviceTiltParallax,
      glowIntensity: settings.glowIntensity,
      highContrast: settings.highContrast,
      textSize: settings.textSize,
    },
    scannerSettings: {
      scannerBatchPersistence: settings.scannerBatchPersistence,
      scannerConfirmationSound: settings.scannerConfirmationSound,
      scannerConfirmationVolume: settings.scannerConfirmationVolume,
      scannerHapticConfirmation: settings.scannerHapticConfirmation,
      scannerDefaultCameraId: settings.scannerDefaultCameraId,
      scannerTorchDefault: settings.scannerTorchDefault,
      scannerDefaultMode: settings.scannerDefaultMode,
      scannerStableFrameDurationMs: settings.scannerStableFrameDurationMs,
      scannerAutoConfirmHighConfidence: settings.scannerAutoConfirmHighConfidence,
      scannerRequireReviewAssumed: settings.scannerRequireReviewAssumed,
      scannerRequireReviewLowConfidence: settings.scannerRequireReviewLowConfidence,
      scannerSaveUnresolved: settings.scannerSaveUnresolved,
      scannerPreferredDestination: settings.scannerPreferredDestination,
      scannerTrayFullTimeoutMs: settings.scannerTrayFullTimeoutMs,
      scannerPreviewQuality: settings.scannerPreviewQuality,
      scannerPerformanceMode: settings.scannerPerformanceMode,
      scannerStoreCorrectionThumbnails: settings.scannerStoreCorrectionThumbnails,
    },
    accessibilitySettings: {
      reducedMotion: settings.reducedMotion,
      highContrast: settings.highContrast,
      textSize: settings.textSize,
    },
    backupPreferences: {
      localFirstMode: true,
      scryfallBulkDownloadWifiOnly: settings.scryfallBulkDownloadWifiOnly,
      scryfallOfflineDatabaseDownloaded: settings.scryfallOfflineDatabaseDownloaded,
    },
    applicationPreferences: {
      defaultExportFormat: settings.defaultExportFormat,
      defaultBracketLock: settings.defaultBracketLock,
      defaultOwnershipPreference: settings.defaultOwnershipPreference,
      homeOrbitOrder: settings.homeOrbitOrder,
      homeOrbitHiddenIds: settings.homeOrbitHiddenIds,
    },
    favoriteCommanders: [],
    favoriteColors: [] as CommanderColor[],
    favoriteArchetypes: [],
    hubIdentity: null,
    friends: [],
    multiplayerPresence: null,
    sourceApplication: DECK_NEXUS_APPLICATION_ID,
    applicationVersion: DECK_NEXUS_APPLICATION_VERSION,
    exportVersion: CURRENT_EXPORT_VERSION,
    exportFormat: "primary_json",
    compatibilityVersion: CURRENT_COMPATIBILITY_VERSION,
    createdAt: timestamps.createdAt,
    updatedAt: timestamps.updatedAt,
    checksum: null,
    applicationMetadata: createApplicationMetadata(timestamps),
    exportMetadata: createExportMetadata({
      exportId: `export:profile:${timestamps.updatedAt}`,
      exportFormat: "primary_json",
      ...timestamps,
    }),
  });
}

export function createBackupMetadata({
  id,
  name,
  deckCount,
  ownedCardCount,
  createdAt,
}: {
  id: string;
  name: string;
  deckCount: number;
  ownedCardCount: number;
  createdAt: string;
}): BackupMetadata {
  return withChecksum({
    ...baseVersions,
    backupId: id,
    name,
    sourceApplication: DECK_NEXUS_APPLICATION_ID,
    applicationVersion: DECK_NEXUS_APPLICATION_VERSION,
    createdAt,
    updatedAt: createdAt,
    deckCount,
    ownedCardCount,
    checksum: null,
  });
}

export function createEcosystemExportPackage({
  deckSnapshot,
  collectionSnapshot,
  profileSnapshot,
}: {
  deckSnapshot?: DeckSnapshot;
  collectionSnapshot: CollectionSnapshot;
  profileSnapshot: ProfileSnapshot;
}): EcosystemExportPackage {
  const updatedAt = [
    deckSnapshot?.updatedAt,
    collectionSnapshot.updatedAt,
    profileSnapshot.updatedAt,
  ].filter(Boolean).sort().at(-1) ?? new Date(0).toISOString();
  const timestamps = sourceTimestamps(undefined, updatedAt, updatedAt);
  const files = [
    deckSnapshot
      ? { path: "deck-snapshot.json", kind: "deck" as const, checksum: deckSnapshot.checksum }
      : undefined,
    {
      path: "collection-snapshot.json",
      kind: "collection" as const,
      checksum: collectionSnapshot.checksum,
    },
    {
      path: "profile-snapshot.json",
      kind: "profile" as const,
      checksum: profileSnapshot.checksum,
    },
    { path: "metadata.json", kind: "package" as const, checksum: null },
  ].filter((file): file is NonNullable<typeof file> => Boolean(file));
  const manifest: EcosystemManifest = withChecksum({
    ...baseVersions,
    manifestId: `manifest:${timestamps.updatedAt}`,
    sourceApplication: DECK_NEXUS_APPLICATION_ID,
    applicationVersion: DECK_NEXUS_APPLICATION_VERSION,
    exportVersion: CURRENT_EXPORT_VERSION,
    exportFormat: "zip_package",
    createdAt: timestamps.createdAt,
    updatedAt: timestamps.updatedAt,
    files,
    checksum: null,
  });
  return withChecksum({
    ...baseVersions,
    packageId: `package:${timestamps.updatedAt}`,
    sourceApplication: DECK_NEXUS_APPLICATION_ID,
    applicationVersion: DECK_NEXUS_APPLICATION_VERSION,
    exportVersion: CURRENT_EXPORT_VERSION,
    exportFormat: "zip_package",
    compatibilityVersion: CURRENT_COMPATIBILITY_VERSION,
    createdAt: timestamps.createdAt,
    updatedAt: timestamps.updatedAt,
    manifest,
    deckSnapshot,
    collectionSnapshot,
    profileSnapshot,
    metadata: createApplicationMetadata(timestamps),
    checksum: null,
  });
}
