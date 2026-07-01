import type { CommanderColor, DeckstateScryfallCard } from "../../types/domain";
import type { AddDestination, BuilderSectionId, ManualCardInput } from "../../features/decks/builderTypes";
import { pickCardImage, getCardImageUris, mapImageUris } from "./scryfallImages";
import type { ScryfallCard, ScryfallCardFace } from "./scryfallTypes";

const commanderColorOrder: CommanderColor[] = ["W", "U", "B", "R", "G"];

function toCommanderColors(colors: readonly string[] = []): CommanderColor[] {
  const selected = new Set(colors.filter((color): color is CommanderColor =>
    commanderColorOrder.includes(color as CommanderColor),
  ));
  return commanderColorOrder.filter((color) => selected.has(color));
}

function faceToDomain(face: ScryfallCardFace) {
  return {
    name: face.name,
    manaCost: face.mana_cost,
    typeLine: face.type_line,
    oracleText: face.oracle_text,
    colors: toCommanderColors(face.colors),
    imageUris: face.image_uris ? mapImageUris(face.image_uris) : undefined,
  };
}

export function mapScryfallCard(card: ScryfallCard): DeckstateScryfallCard {
  const imageUris = getCardImageUris(card);
  const cardFaces = card.card_faces?.map(faceToDomain) ?? [];
  const faceOracle = cardFaces
    .map((face) => [face.name, face.oracleText].filter(Boolean).join("\n"))
    .filter(Boolean)
    .join("\n\n");
  const now = new Date().toISOString();

  return {
    id: card.id,
    oracleId: card.oracle_id ?? card.id,
    name: card.name,
    lang: card.lang,
    releasedAt: card.released_at,
    apiUri: card.uri,
    scryfallUri: card.scryfall_uri,
    layout: card.layout,
    highresImage: card.highres_image,
    imageStatus: card.image_status,
    imageUris,
    manaCost: card.mana_cost ?? cardFaces.map((face) => face.manaCost).filter(Boolean).join(" // "),
    manaValue: card.cmc ?? 0,
    typeLine: card.type_line ?? cardFaces.map((face) => face.typeLine).filter(Boolean).join(" // ") ?? "Card",
    oracleText: card.oracle_text ?? faceOracle,
    power: card.power,
    toughness: card.toughness,
    loyalty: card.loyalty,
    defense: card.defense,
    colors: toCommanderColors(card.colors),
    colorIdentity: toCommanderColors(card.color_identity),
    keywords: card.keywords ?? [],
    legalities: card.legalities ?? {},
    games: card.games ?? [],
    reserved: card.reserved,
    foil: card.foil,
    nonfoil: card.nonfoil,
    oversized: card.oversized,
    promo: card.promo,
    reprint: card.reprint,
    variation: card.variation,
    setId: card.set_id,
    setCode: card.set ?? "",
    setName: card.set_name ?? "",
    setType: card.set_type,
    collectorNumber: card.collector_number ?? "",
    rarity: card.rarity ?? "",
    artist: card.artist,
    borderColor: card.border_color,
    frame: card.frame,
    fullArt: card.full_art,
    textless: card.textless,
    booster: card.booster,
    storySpotlight: card.story_spotlight,
    cardFaces,
    allParts: card.all_parts?.map((part) => ({
      id: part.id,
      component: part.component,
      name: part.name,
      typeLine: part.type_line,
      uri: part.uri,
    })),
    lastFetchedAt: now,
  };
}

export function scryfallCardToManualInput({
  card,
  ownedQuantity = 0,
  destination = "main",
  requestedSection,
  roleTags = ["scryfall"],
}: {
  card: DeckstateScryfallCard;
  ownedQuantity?: number;
  destination?: AddDestination;
  requestedSection?: BuilderSectionId;
  roleTags?: string[];
}): ManualCardInput {
  return {
    scryfallId: card.id,
    oracleId: card.oracleId,
    name: card.name,
    manaCost: card.manaCost,
    manaValue: card.manaValue,
    typeLine: card.typeLine,
    oracleText: card.oracleText,
    colorIdentity: card.colorIdentity,
    imageUri: pickCardImage(card.imageUris, "normal"),
    setCode: card.setCode,
    setName: card.setName,
    collectorNumber: card.collectorNumber,
    legalities: card.legalities,
    roleTags,
    customTags: [],
    notes: "",
    owned: ownedQuantity > 0,
    destination,
    requestedSection,
  };
}

export function hasNoPriceFields(value: unknown): boolean {
  const serialized = JSON.stringify(value);
  return !serialized.includes("prices") && !serialized.includes("purchase_uris");
}
