import { db } from "../../db/database";
import {
  getNextImmutableSnapshotSequence,
  listBoardStateValidationResults,
  saveImmutableDeckSnapshotRecord,
} from "../../db/repositories";
import type {
  BoardStateValidationResultRecord,
  Deck,
  DeckCard,
  DeckCardSection,
  ImmutableDeckSnapshotRecord,
} from "../../types/domain";
import { createId, nowIso } from "../../utils/ids";
import { checksumObject } from "../export/checksum";
import {
  createDeckSnapshot,
  DECK_NEXUS_APPLICATION_VERSION,
  serializePrettyJson,
  type DeckSnapshot,
  type SnapshotDeckCard,
} from "../export";
import {
  ADVANCED_GAMEPLAY_ENVELOPE_SCHEMA_VERSION,
  DRY_RUN_ENVELOPE_SCHEMA_VERSION,
  GAMEPLAY_IDENTITY_VERSION,
  IMMUTABLE_DECK_SNAPSHOT_COMPATIBILITY_VERSION,
  IMMUTABLE_DECK_SNAPSHOT_FORMAT_VERSION,
  IMMUTABLE_DECK_SNAPSHOT_SCHEMA_VERSION,
  type AdvancedGameplaySnapshotEnvelope,
  type CreateImmutableSnapshotOptions,
  type DryRunSnapshotEnvelope,
  type ImmutableDeckSnapshot,
  type SnapshotCardEntry,
  type SnapshotComparisonChange,
  type SnapshotComparisonResult,
  type SnapshotConsumerIntent,
  type SnapshotCreationReason,
  type SnapshotCreationResult,
  type SnapshotStatus,
} from "./contracts";

const sectionOrder: Record<DeckCardSection, number> = {
  commander: 0,
  main: 1,
  maybeboard: 2,
  cuts: 3,
};

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizedName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

function normalizeId(value: string | undefined): string {
  return (value ?? "").trim().toLocaleLowerCase();
}

function isGeneratedIdentifier(value: string): boolean {
  return /^(local-|owned-)/i.test(value);
}

function normalizeCard(card: SnapshotDeckCard): SnapshotCardEntry {
  const oracleId = normalizeId(card.oracleId);
  const scryfallId = normalizeId(card.scryfallId);
  const unresolved = !oracleId || !scryfallId || isGeneratedIdentifier(oracleId) || isGeneratedIdentifier(scryfallId);
  const partial = Boolean((oracleId || scryfallId) && unresolved);

  return {
    snapshotCardEntryId: `snapshot-card:${card.section}:${oracleId || scryfallId || normalizedName(card.name)}:${card.id}`,
    sourceDeckCardId: card.id,
    oracleId,
    scryfallId,
    name: card.name,
    normalizedName: normalizedName(card.name),
    quantity: Math.max(0, Math.trunc(card.quantity)),
    section: card.section,
    commander: card.commander,
    companion: /companion/i.test(card.typeLine ?? "") || card.roleTags.some((tag) => /companion/i.test(tag)),
    printingId: card.printingSelection.scryfallId,
    setCode: card.printingSelection.setCode?.toLocaleLowerCase(),
    collectorNumber: card.printingSelection.collectorNumber,
    language: "en",
    foil: undefined,
    manaCost: card.manaCost,
    manaValue: card.manaValue,
    typeLine: card.typeLine,
    oracleText: card.oracleText,
    colorIdentity: [...card.colorIdentity].sort(),
    imageUri: card.printingSelection.imageUri,
    gameplayIdentityVersion: GAMEPLAY_IDENTITY_VERSION,
    unresolved,
    resolutionStatus: unresolved ? (partial ? "partially_resolved" : "unresolved") : "resolved",
    specialExceptionMetadata: {},
    sourceDeckCardCreatedAt: card.createdAt,
    sourceDeckCardUpdatedAt: card.updatedAt,
  };
}

function sortEntries(entries: readonly SnapshotCardEntry[]): SnapshotCardEntry[] {
  return [...entries].sort((a, b) => {
    const section = sectionOrder[a.section] - sectionOrder[b.section];
    if (section !== 0) {
      return section;
    }
    return [
      a.oracleId.localeCompare(b.oracleId),
      a.scryfallId.localeCompare(b.scryfallId),
      a.normalizedName.localeCompare(b.normalizedName),
      a.sourceDeckCardId.localeCompare(b.sourceDeckCardId),
    ].find((value) => value !== 0) ?? 0;
  });
}

function buildGameplayHashInput(snapshot: ImmutableDeckSnapshot) {
  return {
    format: snapshot.gameplay.format,
    commander: {
      primaryCommander: snapshot.gameplay.commander.primaryCommander
        ? minimalGameplayCard(snapshot.gameplay.commander.primaryCommander)
        : undefined,
      secondaryCommander: snapshot.gameplay.commander.secondaryCommander
        ? minimalGameplayCard(snapshot.gameplay.commander.secondaryCommander)
        : undefined,
      partnerCommanders: snapshot.gameplay.commander.partnerCommanders.map(minimalGameplayCard),
      background: snapshot.gameplay.commander.background
        ? minimalGameplayCard(snapshot.gameplay.commander.background)
        : undefined,
      companion: snapshot.gameplay.commander.companion
        ? minimalGameplayCard(snapshot.gameplay.commander.companion)
        : undefined,
      commanderOracleIds: snapshot.gameplay.commander.commanderOracleIds,
      commanderScryfallIds: snapshot.gameplay.commander.commanderScryfallIds,
      commanderNames: snapshot.gameplay.commander.commanderNames.map(normalizedName),
      combinedColorIdentity: snapshot.gameplay.commander.combinedColorIdentity,
    },
    commanderZone: snapshot.gameplay.commanderZone.map(minimalGameplayCard),
    mainDeck: snapshot.gameplay.mainDeck.map(minimalGameplayCard),
    unresolvedGameplayCards: snapshot.gameplay.unresolvedGameplayCards.map(minimalGameplayCard),
  };
}

function minimalGameplayCard(card: SnapshotCardEntry) {
  return {
    oracleId: card.oracleId,
    scryfallId: card.scryfallId,
    name: card.normalizedName,
    quantity: card.quantity,
    section: card.section,
    commander: card.commander,
    companion: card.companion,
    printingId: card.printingId,
    setCode: card.setCode,
    collectorNumber: card.collectorNumber,
    unresolved: card.unresolved,
    resolutionStatus: card.resolutionStatus,
    gameplayIdentityVersion: card.gameplayIdentityVersion,
  };
}

function buildMetadataHashInput(snapshot: ImmutableDeckSnapshot) {
  return {
    deckIdentity: snapshot.deckIdentity,
    nonGameplaySections: snapshot.nonGameplaySections,
    planningMetadata: snapshot.planningMetadata,
    validationMetadata: snapshot.validationMetadata,
    sourceMetadata: snapshot.sourceMetadata,
    compatibility: snapshot.compatibility,
  };
}

function findMatchingValidation(
  canonicalSnapshot: DeckSnapshot,
  results: readonly BoardStateValidationResultRecord[] = [],
): BoardStateValidationResultRecord | undefined {
  return results.find(
    (result) =>
      result.sourceAuthority === "boardstate" &&
      result.authoritative &&
      !result.testOnly &&
      !result.stale &&
      !result.errorSummary &&
      result.snapshotChecksum === canonicalSnapshot.checksum,
  );
}

function deriveSnapshotStatus(
  unresolvedCount: number,
  consumerIntent: SnapshotConsumerIntent,
  matchingValidation?: BoardStateValidationResultRecord,
): SnapshotStatus {
  if (unresolvedCount > 0) {
    return "unresolved";
  }
  if (matchingValidation) {
    return matchingValidation.legalityStatus === "legal_with_warnings"
      ? "ready_with_warnings"
      : "validated";
  }
  return ["advanced_gameplay", "dry_run", "boardstate_validation", "shared_session"].includes(
    consumerIntent,
  )
    ? "validation_required"
    : "ready";
}

function createSnapshotPayload(
  deck: Deck,
  options: Required<Pick<CreateImmutableSnapshotOptions, "sequenceNumber">> &
    Omit<CreateImmutableSnapshotOptions, "sequenceNumber">,
): ImmutableDeckSnapshot {
  const createdAt = options.createdAt ?? nowIso();
  const canonicalSnapshot =
    options.canonicalSnapshot ?? createDeckSnapshot(deck, { createdAt });
  const creationReason: SnapshotCreationReason =
    options.creationReason ?? "manual";
  const consumerIntent: SnapshotConsumerIntent =
    options.consumerIntent ?? "archival";
  const entries = sortEntries(
    [
      ...canonicalSnapshot.mainDeck,
      ...canonicalSnapshot.maybeboard,
      ...canonicalSnapshot.cuts,
    ].map(normalizeCard),
  );
  const commanderZone = entries.filter((entry) => entry.section === "commander");
  const mainDeck = entries.filter((entry) => entry.section === "main");
  const maybeboard = entries.filter((entry) => entry.section === "maybeboard");
  const cuts = entries.filter((entry) => entry.section === "cuts");
  const gameplayIncludedCards = sortEntries([...commanderZone, ...mainDeck]);
  const unresolvedGameplayCards = gameplayIncludedCards.filter((entry) => entry.unresolved);
  const matchingValidation = findMatchingValidation(
    canonicalSnapshot,
    options.validationResults,
  );
  const primaryCommander = commanderZone[0];
  const secondaryCommander = commanderZone[1];
  const partnerCommanders = commanderZone.filter((entry) =>
    /partner/i.test(entry.typeLine ?? ""),
  );
  const background = commanderZone.find((entry) =>
    /background/i.test(entry.typeLine ?? ""),
  );
  const companion = entries.find((entry) => entry.companion);
  const colorIdentity = [...new Set(deck.colorIdentity)].sort();

  const skeleton: ImmutableDeckSnapshot = {
    metadata: {
      snapshotId: `immutable-snapshot:${deck.id}:${options.sequenceNumber}:${createdAt}`,
      deckId: deck.id,
      snapshotSequenceNumber: options.sequenceNumber,
      snapshotSchemaVersion: IMMUTABLE_DECK_SNAPSHOT_SCHEMA_VERSION,
      snapshotFormatVersion: IMMUTABLE_DECK_SNAPSHOT_FORMAT_VERSION,
      compatibilityVersion: IMMUTABLE_DECK_SNAPSHOT_COMPATIBILITY_VERSION,
      sourceApplication: "deck_nexus",
      sourceApplicationVersion: DECK_NEXUS_APPLICATION_VERSION,
      createdAt,
      creationReason,
      consumerIntent,
      sourceDeckUpdatedAt: deck.updatedAt,
      snapshotChecksum: "",
      gameplayChecksum: "",
      metadataChecksum: "",
    },
    deckIdentity: {
      deckName: deck.name,
      format: deck.format,
      deckDescription: deck.notes,
      deckImage: canonicalSnapshot.deckImage,
      originalDeckId: deck.id,
    },
    gameplay: {
      format: deck.format,
      commanderFormat: deck.format === "commander",
      commander: {
        primaryCommander,
        secondaryCommander,
        partnerCommanders,
        background,
        companion,
        commanderOracleIds: commanderZone.map((entry) => entry.oracleId).filter(Boolean),
        commanderScryfallIds: commanderZone.map((entry) => entry.scryfallId).filter(Boolean),
        commanderNames: commanderZone.map((entry) => entry.name),
        combinedColorIdentity: colorIdentity,
      },
      commanderZone,
      mainDeck,
      gameplayIncludedCards,
      unresolvedGameplayCards,
    },
    nonGameplaySections: {
      maybeboard,
      cuts,
      tokensAndExtras: [],
      sidePlanningLists: [],
    },
    planningMetadata: {
      deckGoals: cloneJson(deck.goals),
      bracketLock: cloneJson(deck.bracketLock),
      estimatedBracket: canonicalSnapshot.estimatedBracket,
      customTags: [...deck.tags].sort(),
      analyticsSummary: cloneJson(canonicalSnapshot.analyticsMetadata),
      recommendationSummary: cloneJson(canonicalSnapshot.recommendationMetadata),
      ownershipSummary: cloneJson(canonicalSnapshot.ownershipSummary) as unknown as Record<string, unknown>,
      missingCardSummary: {
        missingQuantity: canonicalSnapshot.ownershipSummary.missingQuantity,
        missingCards: canonicalSnapshot.missingCards.map((card) => card.name),
      },
      notesIncludedInArchivalSnapshot: true,
      deckNotes: deck.notes,
    },
    validationMetadata: {
      localGuidanceStatus: "available",
      boardStateValidationStatus: matchingValidation ? "validated" : "not_validated",
      validationResultId: matchingValidation?.id,
      validatedSnapshotChecksum: matchingValidation?.snapshotChecksum,
      validatedAt: matchingValidation?.validatedAt,
      boardStateApplicationVersion: matchingValidation?.boardStateVersion,
      boardStateRulesVersion: matchingValidation?.rulesVersion,
      authoritativeValidationStatus: matchingValidation?.legalityStatus,
      unsupportedChecks: matchingValidation?.unsupportedChecks ?? [],
    },
    sourceMetadata: {
      sourceDeckId: deck.id,
      sourceDeckUpdatedAt: deck.updatedAt,
      sourceCanonicalSnapshotId: canonicalSnapshot.snapshotId,
      sourceCanonicalSnapshotChecksum: canonicalSnapshot.checksum ?? "",
      sourceImportReference: deck.originalImportText ? "local_import_text" : undefined,
    },
    compatibility: {
      boardState: {
        preparedForExport: true,
        launchBridgeConnected: false,
        validationRequired: !matchingValidation,
      },
      hub: {
        adapterConnected: false,
      },
    },
  };
  const gameplayChecksum = checksumObject(buildGameplayHashInput(skeleton));
  const metadataChecksum = checksumObject(buildMetadataHashInput(skeleton));
  const snapshotChecksum = checksumObject({
    ...skeleton,
    metadata: {
      ...skeleton.metadata,
      snapshotChecksum: null,
      gameplayChecksum,
      metadataChecksum,
    },
  });
  return {
    ...skeleton,
    metadata: {
      ...skeleton.metadata,
      snapshotChecksum,
      gameplayChecksum,
      metadataChecksum,
    },
  };
}

export function toImmutableSnapshotRecord(
  snapshot: ImmutableDeckSnapshot,
  status: SnapshotStatus,
): ImmutableDeckSnapshotRecord {
  return {
    snapshotId: snapshot.metadata.snapshotId,
    deckId: snapshot.metadata.deckId,
    deckName: snapshot.deckIdentity.deckName,
    snapshotSequenceNumber: snapshot.metadata.snapshotSequenceNumber,
    snapshotSchemaVersion: snapshot.metadata.snapshotSchemaVersion,
    snapshotFormatVersion: snapshot.metadata.snapshotFormatVersion,
    compatibilityVersion: snapshot.metadata.compatibilityVersion,
    sourceApplication: "deck_nexus",
    sourceApplicationVersion: snapshot.metadata.sourceApplicationVersion,
    createdAt: snapshot.metadata.createdAt,
    creationReason: snapshot.metadata.creationReason,
    consumerIntent: snapshot.metadata.consumerIntent,
    sourceDeckUpdatedAt: snapshot.metadata.sourceDeckUpdatedAt,
    gameplayChecksum: snapshot.metadata.gameplayChecksum,
    fullChecksum: snapshot.metadata.snapshotChecksum,
    metadataChecksum: snapshot.metadata.metadataChecksum,
    status,
    archivalState: "active",
    matchingValidationResultId: snapshot.validationMetadata.validationResultId,
    immutablePayload: cloneJson(snapshot) as unknown as Record<string, unknown>,
  };
}

export function snapshotFromRecord(record: ImmutableDeckSnapshotRecord): ImmutableDeckSnapshot {
  return cloneJson(record.immutablePayload) as unknown as ImmutableDeckSnapshot;
}

export function previewImmutableDeckSnapshot(
  deck: Deck,
  options: CreateImmutableSnapshotOptions,
): SnapshotCreationResult {
  const snapshot = createSnapshotPayload(deck, options);
  const status = deriveSnapshotStatus(
    snapshot.gameplay.unresolvedGameplayCards.length,
    snapshot.metadata.consumerIntent,
    options.validationResults?.find(
      (result) => result.id === snapshot.validationMetadata.validationResultId,
    ),
  );
  const warnings = [
    ...(snapshot.gameplay.unresolvedGameplayCards.length > 0
      ? [`${snapshot.gameplay.unresolvedGameplayCards.length} gameplay card entries are unresolved.`]
      : []),
    ...(snapshot.validationMetadata.boardStateValidationStatus === "not_validated"
      ? ["BoardState validation is not attached to this exact snapshot."]
      : []),
  ];
  return {
    record: toImmutableSnapshotRecord(snapshot, status),
    snapshot,
    status,
    warnings,
  };
}

export async function createImmutableDeckSnapshot(
  deck: Deck,
  options: Omit<CreateImmutableSnapshotOptions, "sequenceNumber"> = {},
): Promise<SnapshotCreationResult> {
  const sequenceNumber = await getNextImmutableSnapshotSequence(deck.id);
  const validationResults =
    options.validationResults ?? (await listBoardStateValidationResults(deck.id));
  const result = previewImmutableDeckSnapshot(deck, {
    ...options,
    sequenceNumber,
    validationResults,
  });
  await saveImmutableDeckSnapshotRecord(result.record);
  return result;
}

export function verifyImmutableDeckSnapshot(record: ImmutableDeckSnapshotRecord) {
  const snapshot = snapshotFromRecord(record);
  if (record.snapshotSchemaVersion !== IMMUTABLE_DECK_SNAPSHOT_SCHEMA_VERSION) {
    return { status: "unsupported_schema" as const, verified: false };
  }
  const gameplayChecksum = checksumObject(buildGameplayHashInput(snapshot));
  const metadataChecksum = checksumObject(buildMetadataHashInput(snapshot));
  const fullChecksum = checksumObject({
    ...snapshot,
    metadata: {
      ...snapshot.metadata,
      snapshotChecksum: null,
      gameplayChecksum,
      metadataChecksum,
    },
  });
  if (gameplayChecksum !== record.gameplayChecksum) {
    return { status: "gameplay_mismatch" as const, verified: false };
  }
  if (fullChecksum !== record.fullChecksum || metadataChecksum !== record.metadataChecksum) {
    return { status: "full_snapshot_mismatch" as const, verified: false };
  }
  return { status: "verified" as const, verified: true };
}

function cardKey(card: SnapshotCardEntry): string {
  return card.oracleId || card.scryfallId || card.normalizedName;
}

function quantityMap(cards: readonly SnapshotCardEntry[]): Map<string, SnapshotCardEntry> {
  return cards.reduce((map, card) => {
    const key = cardKey(card);
    const existing = map.get(key);
    map.set(key, {
      ...card,
      quantity: (existing?.quantity ?? 0) + card.quantity,
    });
    return map;
  }, new Map<string, SnapshotCardEntry>());
}

function compareCards(
  before: readonly SnapshotCardEntry[],
  after: readonly SnapshotCardEntry[],
): SnapshotComparisonChange[] {
  const beforeMap = quantityMap(before);
  const afterMap = quantityMap(after);
  const keys = [...new Set([...beforeMap.keys(), ...afterMap.keys()])].sort();
  return keys.flatMap<SnapshotComparisonChange>((key) => {
    const previous = beforeMap.get(key);
    const current = afterMap.get(key);
    if (!previous && current) {
      return [{
        type: "card_added" as const,
        label: `${current.name} added`,
        after: String(current.quantity),
        gameplayRelevant: true,
      }];
    }
    if (previous && !current) {
      return [{
        type: "card_removed" as const,
        label: `${previous.name} removed`,
        before: String(previous.quantity),
        gameplayRelevant: true,
      }];
    }
    if (previous && current && previous.quantity !== current.quantity) {
      return [{
        type: "quantity_changed" as const,
        label: `${current.name} quantity changed`,
        before: String(previous.quantity),
        after: String(current.quantity),
        gameplayRelevant: true,
      }];
    }
    return [];
  });
}

export function compareSnapshots(
  beforeRecord: ImmutableDeckSnapshotRecord,
  afterRecord: ImmutableDeckSnapshotRecord,
): SnapshotComparisonResult {
  const before = snapshotFromRecord(beforeRecord);
  const after = snapshotFromRecord(afterRecord);
  const gameplayChanges = [
    ...(before.gameplay.format !== after.gameplay.format
      ? [{
          type: "format_changed" as const,
          label: "Format changed",
          before: before.gameplay.format,
          after: after.gameplay.format,
          gameplayRelevant: true,
        }]
      : []),
    ...compareCards(before.gameplay.gameplayIncludedCards, after.gameplay.gameplayIncludedCards),
  ];
  const metadataChanges =
    beforeRecord.fullChecksum !== afterRecord.fullChecksum && gameplayChanges.length === 0
      ? [{
          type: "metadata_changed" as const,
          label: "Planning or archival metadata changed",
          gameplayRelevant: false,
        }]
      : [];
  const status =
    gameplayChanges.length > 0
      ? "gameplay_changed"
      : metadataChanges.length > 0
        ? "metadata_only_changed"
        : "matches";
  return {
    status,
    summary:
      status === "matches"
        ? "Snapshots match."
        : status === "metadata_only_changed"
          ? "Snapshots have metadata-only changes."
          : "Snapshots have gameplay changes.",
    gameplayChecksumBefore: beforeRecord.gameplayChecksum,
    gameplayChecksumAfter: afterRecord.gameplayChecksum,
    fullChecksumBefore: beforeRecord.fullChecksum,
    fullChecksumAfter: afterRecord.fullChecksum,
    gameplayChanges,
    metadataChanges,
  };
}

export function compareDeckToSnapshot(
  deck: Deck,
  record: ImmutableDeckSnapshotRecord,
): SnapshotComparisonResult {
  const verification = verifyImmutableDeckSnapshot(record);
  if (!verification.verified) {
    return {
      status: "corrupted",
      summary: "Snapshot integrity could not be verified.",
      gameplayChecksumBefore: record.gameplayChecksum,
      gameplayChecksumAfter: "",
      gameplayChanges: [],
      metadataChanges: [],
    };
  }
  const current = previewImmutableDeckSnapshot(deck, {
    sequenceNumber: record.snapshotSequenceNumber,
    createdAt: record.createdAt,
    consumerIntent: record.consumerIntent as SnapshotConsumerIntent,
  }).record;
  const result = compareSnapshots(record, current);
  return {
    ...result,
    summary:
      result.status === "matches"
        ? "Current deck matches this snapshot."
        : result.status === "metadata_only_changed"
          ? "Current deck has metadata-only changes."
          : "Current deck has gameplay changes.",
  };
}

export function createAdvancedGameplaySnapshotEnvelope(
  record: ImmutableDeckSnapshotRecord,
  createdAt = nowIso(),
): AdvancedGameplaySnapshotEnvelope {
  const snapshot = snapshotFromRecord(record);
  return {
    envelopeSchemaVersion: ADVANCED_GAMEPLAY_ENVELOPE_SCHEMA_VERSION,
    consumerIntent: "advanced_gameplay",
    sourceApplication: "deck_nexus",
    sourceApplicationVersion: snapshot.metadata.sourceApplicationVersion,
    createdAt,
    snapshotId: record.snapshotId,
    gameplayChecksum: record.gameplayChecksum,
    immutableGameplayPayload: cloneJson(snapshot.gameplay),
    commanderConfiguration: cloneJson(snapshot.gameplay.commander),
    format: snapshot.gameplay.format,
    boardStateCompatibility: snapshot.compatibility.boardState,
    matchingBoardStateValidationResultId: snapshot.validationMetadata.validationResultId,
    localStructuralReadinessStatus: snapshot.gameplay.unresolvedGameplayCards.length > 0
      ? "unresolved"
      : record.status === "validated"
        ? "validated"
        : "validation_required",
    unresolvedCards: cloneJson(snapshot.gameplay.unresolvedGameplayCards),
    displayMetadata: {
      deckName: snapshot.deckIdentity.deckName,
    },
    correlationId: createId("advanced-gameplay-envelope"),
  };
}

export function createDryRunSnapshotEnvelope(
  record: ImmutableDeckSnapshotRecord,
  createdAt = nowIso(),
): DryRunSnapshotEnvelope {
  const snapshot = snapshotFromRecord(record);
  return {
    envelopeSchemaVersion: DRY_RUN_ENVELOPE_SCHEMA_VERSION,
    consumerIntent: "dry_run",
    sourceApplication: "deck_nexus",
    sourceApplicationVersion: snapshot.metadata.sourceApplicationVersion,
    createdAt,
    snapshotId: record.snapshotId,
    gameplayChecksum: record.gameplayChecksum,
    immutableGameplayPayload: cloneJson(snapshot.gameplay),
    commanderConfiguration: cloneJson(snapshot.gameplay.commander),
    format: snapshot.gameplay.format,
    planningMetadata: {
      deckGoals: cloneJson(snapshot.planningMetadata.deckGoals),
      bracketLock: cloneJson(snapshot.planningMetadata.bracketLock),
      estimatedBracket: snapshot.planningMetadata.estimatedBracket,
    },
    matchingBoardStateValidationResultId: snapshot.validationMetadata.validationResultId,
    localStructuralReadinessStatus: snapshot.gameplay.unresolvedGameplayCards.length > 0
      ? "unresolved"
      : record.status === "validated"
        ? "validated"
        : "validation_required",
    unresolvedCards: cloneJson(snapshot.gameplay.unresolvedGameplayCards),
    correlationId: createId("dry-run-envelope"),
  };
}

function deckCardFromSnapshotEntry(
  deckId: string,
  entry: SnapshotCardEntry,
  section: DeckCardSection,
  createdAt: string,
): DeckCard {
  return {
    id: createId("card"),
    deckId,
    scryfallId: entry.scryfallId || createId("local-scryfall"),
    oracleId: entry.oracleId || createId("local-oracle"),
    name: entry.name,
    manaCost: entry.manaCost,
    manaValue: entry.manaValue,
    typeLine: entry.typeLine ?? "",
    oracleText: entry.oracleText,
    colorIdentity: [...entry.colorIdentity],
    imageUri: entry.imageUri,
    setCode: entry.setCode,
    collectorNumber: entry.collectorNumber,
    quantity: entry.quantity,
    section,
    categories: section === "commander" ? ["commander"] : [],
    roleTags: section === "commander" ? ["commander"] : [],
    customTags: [],
    notes: "",
    protected: false,
    ownedQuantityAtAdd: 0,
    missingQuantity: 0,
    addedAt: createdAt,
    updatedAt: createdAt,
  };
}

export async function duplicateImmutableSnapshotToDeck(
  record: ImmutableDeckSnapshotRecord,
): Promise<Deck> {
  const snapshot = snapshotFromRecord(record);
  const createdAt = nowIso();
  const deckId = createId("deck");
  const cards = [
    ...snapshot.gameplay.commanderZone.map((entry) =>
      deckCardFromSnapshotEntry(deckId, entry, "commander", createdAt),
    ),
    ...snapshot.gameplay.mainDeck.map((entry) =>
      deckCardFromSnapshotEntry(deckId, entry, "main", createdAt),
    ),
  ];
  const maybeboard = snapshot.nonGameplaySections.maybeboard.map((entry) =>
    deckCardFromSnapshotEntry(deckId, entry, "maybeboard", createdAt),
  );
  const cuts = snapshot.nonGameplaySections.cuts.map((entry) =>
    deckCardFromSnapshotEntry(deckId, entry, "cuts", createdAt),
  );
  const deck: Deck = {
    id: deckId,
    name: `${snapshot.deckIdentity.deckName} Snapshot Copy`,
    format: snapshot.deckIdentity.format,
    commanderIds: snapshot.gameplay.commander.commanderScryfallIds.filter(Boolean),
    commanderNames: [...snapshot.gameplay.commander.commanderNames],
    colorIdentity: [...snapshot.gameplay.commander.combinedColorIdentity],
    cards,
    maybeboard,
    cuts,
    goals: cloneJson([...snapshot.planningMetadata.deckGoals]),
    tags: [...snapshot.planningMetadata.customTags],
    style: "unspecified",
    powerTarget: 5,
    bracketLock: cloneJson(snapshot.planningMetadata.bracketLock),
    ownershipPreference: "allow_missing",
    categoryStyle: "commander_roles",
    notes: "",
    status: "draft",
    createdFromSnapshotId: record.snapshotId,
    sourceDeckId: record.deckId,
    sourceSnapshotChecksum: record.fullChecksum,
    originalImportText: "",
    unresolvedImports: snapshot.gameplay.unresolvedGameplayCards.map((entry) => entry.name),
    createdFrom: "snapshot_duplicate",
    createdAt,
    updatedAt: createdAt,
  };
  await db.transaction(
    "rw",
    db.decks,
    db.deckCards,
    db.maybeboardCards,
    db.cutCards,
    db.decisionEvents,
    async () => {
      await db.decks.add(deck);
      await db.deckCards.bulkPut(deck.cards);
      await db.maybeboardCards.bulkPut(deck.maybeboard);
      await db.cutCards.bulkPut(deck.cuts);
      await db.decisionEvents.add({
        id: createId("decision"),
        deckId,
        type: "deck_duplicated",
        message: "Immutable snapshot duplicated as a new mutable deck.",
        payload: {
          sourceDeckId: record.deckId,
          createdFromSnapshotId: record.snapshotId,
          sourceSnapshotChecksum: record.fullChecksum,
        },
        createdAt,
      });
    },
  );
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("deck-nexus:decks-updated"));
  }
  return deck;
}

export function serializeImmutableSnapshot(record: ImmutableDeckSnapshotRecord): string {
  return serializePrettyJson(snapshotFromRecord(record));
}
