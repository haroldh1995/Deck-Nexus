import { db } from "../../db/database";
import { listOwnedCards, upsertOwnedCard } from "../../db/repositories";
import type {
  CollectionImport,
  CustomCollection,
  CustomCollectionEntry,
  OwnedCard,
} from "../../types/domain";
import { createId, nowIso } from "../../utils/ids";
import type { ImportResolvedEntry } from "./importResolution";

function resolvedCard(entry: ImportResolvedEntry) {
  if (entry.card) {
    return {
      id: entry.card.id,
      oracleId: entry.card.oracleId,
      name: entry.card.name,
      manaCost: entry.card.manaCost,
      manaValue: entry.card.manaValue,
      typeLine: entry.card.typeLine,
      oracleText: entry.card.oracleText,
      colorIdentity: entry.card.colorIdentity,
      imageUri: entry.card.imageUris?.normal ?? entry.card.imageUris?.large ?? entry.card.imageUris?.small,
      rarity: entry.card.rarity,
      releasedAt: entry.card.releasedAt,
      printing: {
        id: entry.card.id,
        scryfallId: entry.card.id,
        oracleId: entry.card.oracleId,
        name: entry.card.name,
        setCode: entry.card.setCode,
        setName: entry.card.setName,
        collectorNumber: entry.card.collectorNumber,
        language: entry.card.lang,
        foil: Boolean(entry.card.foil),
        finish: entry.card.foil ? "foil" as const : "nonfoil" as const,
        condition: "unknown",
        quantityOwned: entry.quantity,
        imageUri: entry.card.imageUris?.normal ?? entry.card.imageUris?.large ?? entry.card.imageUris?.small ?? "",
        prices: entry.card.prices,
        rarity: entry.card.rarity,
        releasedAt: entry.card.releasedAt,
      },
    };
  }
  if (entry.catalogCard) {
    return {
      id: entry.catalogCard.scryfallId,
      oracleId: entry.catalogCard.oracleId,
      name: entry.catalogCard.name,
      manaCost: entry.catalogCard.manaCost,
      manaValue: entry.catalogCard.manaValue,
      typeLine: entry.catalogCard.typeLine,
      oracleText: entry.catalogCard.oracleText,
      colorIdentity: entry.catalogCard.colorIdentity,
      imageUri: undefined,
      rarity: undefined,
      releasedAt: undefined,
      printing: undefined,
    };
  }
  return undefined;
}

function inputForEntry(entry: ImportResolvedEntry, existing: OwnedCard | undefined) {
  const card = resolvedCard(entry);
  if (!card) return undefined;
  const quantity = entry.quantity;
  const existingPrinting = card.printing && existing?.printings.find((printing) => printing.scryfallId === card.printing?.scryfallId);
  return {
    name: card.name,
    quantityOwned: (existing?.quantityOwned ?? 0) + quantity,
    oracleId: card.oracleId,
    scryfallId: card.id,
    manaCost: card.manaCost,
    manaValue: card.manaValue,
    typeLine: card.typeLine,
    oracleText: card.oracleText,
    colorIdentity: card.colorIdentity,
    imageUri: card.imageUri,
    rarity: card.rarity,
    releasedAt: card.releasedAt,
    lastImportedAt: nowIso(),
    printing: card.printing
      ? {
          ...card.printing,
          quantityOwned: (existingPrinting?.quantityOwned ?? 0) + quantity,
        }
      : undefined,
  };
}

function findExisting(entry: ImportResolvedEntry, owned: readonly OwnedCard[]) {
  const card = resolvedCard(entry);
  const name = (card?.name ?? entry.name).trim().toLowerCase();
  return owned.find((item) =>
    (card?.id && item.scryfallId === card.id) ||
    (card?.oracleId && item.oracleId === card.oracleId) ||
    item.name.trim().toLowerCase() === name,
  );
}

export interface CollectionImportResult {
  record: CollectionImport;
  imported: number;
  unresolved: number;
  folder?: CustomCollection;
}

export async function applyCollectionImport(options: {
  entries: readonly ImportResolvedEntry[];
  sourceName: string;
  detectedFormat: string;
  strategy: CollectionImport["strategy"];
  folderName?: string;
  originalText: string;
}): Promise<CollectionImportResult> {
  const ownedBefore = await listOwnedCards();
  const unresolvedEntries = options.entries.filter((entry) => entry.status !== "resolved" || entry.removed || !resolvedCard(entry));
  const accepted = options.entries.filter((entry) => entry.status === "resolved" && !entry.removed && resolvedCard(entry));
  const now = nowIso();
  const importId = createId("collection-import");
  const workingOwned = options.strategy === "replace" ? [] : [...ownedBefore];
  let folder: CustomCollection | undefined;

  if (options.strategy === "replace") {
    await db.transaction("rw", db.ownedCards, db.ownedPrintings, async () => {
      await db.ownedCards.clear();
      await db.ownedPrintings.clear();
    });
  }

  if (options.strategy === "folder") {
    folder = {
      id: createId("collection"),
      name: options.folderName?.trim() || "Imported Collection",
      description: `Imported from ${options.sourceName}.`,
      tags: ["imported"],
      favorite: false,
      showOnHome: false,
      icon: "library",
      associatedDeckIds: [],
      sortMode: "name",
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    await db.customCollections.put(folder);
  }

  let imported = 0;
  for (const entry of accepted) {
    const card = resolvedCard(entry);
    if (!card) continue;
    imported += entry.quantity;
    if (options.strategy !== "folder") {
      const existing = findExisting(entry, workingOwned);
      const input = inputForEntry(entry, existing);
      if (input) {
        const updated = await upsertOwnedCard(input);
        const existingIndex = workingOwned.findIndex((card) => card.id === updated.id);
        if (existingIndex >= 0) workingOwned[existingIndex] = updated;
        else workingOwned.push(updated);
      }
    } else if (folder) {
      const entryRecord: CustomCollectionEntry = {
        id: createId("collection-entry"),
        collectionId: folder.id,
        scryfallId: card.id,
        oracleId: card.oracleId,
        cardName: card.name,
        quantity: entry.quantity,
        notes: "",
        tags: [],
        customStatus: "imported",
        ownedStatus: "owned",
        sourceQuery: entry.originalLine,
        customOrder: imported,
        createdAt: now,
        updatedAt: now,
      };
      await db.customCollectionEntries.put(entryRecord);
    }
  }

  const record: CollectionImport = {
    id: importId,
    sourceName: options.sourceName,
    detectedFormat: options.detectedFormat,
    strategy: options.strategy,
    folderName: folder?.name,
    status: unresolvedEntries.length > 0 ? "needs_review" : "completed",
    totalEntries: options.entries.length,
    importedQuantity: imported,
    unresolvedEntries: unresolvedEntries.map((entry) => entry.name),
    originalText: options.originalText,
    undoData: JSON.stringify({ ownedBefore, folderId: folder?.id }),
    createdAt: now,
    completedAt: now,
  };
  await db.collectionImports.put(record);
  return { record, imported, unresolved: unresolvedEntries.length, folder };
}

export async function undoCollectionImport(record: CollectionImport): Promise<void> {
  if (!record.undoData) throw new Error("This import does not contain recovery data.");
  const payload = JSON.parse(record.undoData) as { ownedBefore?: OwnedCard[]; folderId?: string };
  await db.transaction("rw", db.ownedCards, db.ownedPrintings, db.customCollections, db.customCollectionEntries, db.collectionImports, async () => {
    if (payload.folderId) {
      await db.customCollectionEntries.where("collectionId").equals(payload.folderId).delete();
      await db.customCollections.delete(payload.folderId);
    } else if (payload.ownedBefore) {
      await db.ownedCards.clear();
      await db.ownedPrintings.clear();
      await db.ownedCards.bulkPut(payload.ownedBefore);
      await db.ownedPrintings.bulkPut(payload.ownedBefore.flatMap((card) => card.printings));
    }
    await db.collectionImports.put({ ...record, status: "undone" });
  });
}
