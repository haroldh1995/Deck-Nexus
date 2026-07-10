import type { DeckSnapshot, EcosystemExportPackage } from "./schemas";
import { stableStringify } from "./stableJson";
import { createZipArchive } from "./zip";

const encoder = new TextEncoder();

export type ArenaExportMode = "all" | "owned_only" | "optimal";

export function serializePrimaryJson(value: unknown): string {
  return stableStringify(value);
}

export function serializePrettyJson(value: unknown): string {
  return stableStringify(value, 2);
}

export async function serializeCompressedJson(value: unknown): Promise<Uint8Array> {
  const jsonBytes = encoder.encode(serializePrimaryJson(value));
  if (
    typeof CompressionStream === "undefined" ||
    typeof Blob.prototype.stream === "undefined"
  ) {
    return jsonBytes;
  }

  const stream = new Blob([jsonBytes]).stream().pipeThrough(
    new CompressionStream("gzip"),
  );
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function arenaLine(quantity: number, name: string): string {
  return `${quantity} ${name}`;
}

export function createArenaDeckExport(
  snapshot: DeckSnapshot,
  mode: ArenaExportMode = "all",
): string {
  const commanderCards = snapshot.mainDeck.filter((card) => card.commander);
  const deckCards = snapshot.mainDeck.filter((card) => !card.commander);
  const includeCard = (card: (typeof snapshot.mainDeck)[number]) => {
    if (mode !== "owned_only") {
      return card.quantity;
    }
    return card.ownershipState === "owned"
      ? card.quantity
      : Math.max(0, card.quantity - card.missingQuantity);
  };
  const lines: string[] = [];

  if (commanderCards.length > 0) {
    lines.push("Commander");
    for (const card of commanderCards) {
      const quantity = includeCard(card);
      if (quantity > 0) {
        lines.push(arenaLine(quantity, card.name));
      }
    }
    lines.push("");
  }

  lines.push("Deck");
  for (const card of deckCards) {
    const quantity = includeCard(card);
    if (quantity > 0) {
      lines.push(arenaLine(quantity, card.name));
    }
  }

  if (mode === "optimal") {
    lines.push("", "# Includes missing cards from the canonical Deck Nexus snapshot.");
  }

  return `${lines.join("\n").trim()}\n`;
}

export function createEcosystemZipPackage(
  ecosystemPackage: EcosystemExportPackage,
): Uint8Array {
  const entries = [
    ecosystemPackage.deckSnapshot
      ? {
          path: "deck-snapshot.json",
          content: serializePrettyJson(ecosystemPackage.deckSnapshot),
        }
      : undefined,
    {
      path: "collection-snapshot.json",
      content: serializePrettyJson(ecosystemPackage.collectionSnapshot),
    },
    {
      path: "profile-snapshot.json",
      content: serializePrettyJson(ecosystemPackage.profileSnapshot),
    },
    { path: "metadata.json", content: serializePrettyJson(ecosystemPackage.metadata) },
    { path: "manifest.json", content: serializePrettyJson(ecosystemPackage.manifest) },
  ].filter((entry): entry is { path: string; content: string } => Boolean(entry));

  return createZipArchive(entries);
}

export function createDownloadBlob(
  content: string | Uint8Array,
  type: string,
): Blob {
  if (typeof content !== "string") {
    const buffer = new ArrayBuffer(content.byteLength);
    new Uint8Array(buffer).set(content);
    return new Blob([buffer], { type });
  }
  return new Blob([content], { type });
}
