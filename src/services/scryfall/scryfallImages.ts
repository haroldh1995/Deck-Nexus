import type { DeckstateCardImageUris } from "../../types/domain";
import type { ScryfallCard } from "./scryfallTypes";

export function mapImageUris(
  imageUris: {
    small?: string;
    normal?: string;
    large?: string;
    png?: string;
    art_crop?: string;
    border_crop?: string;
  } = {},
): DeckstateCardImageUris {
  return {
    small: imageUris.small,
    normal: imageUris.normal,
    large: imageUris.large,
    png: imageUris.png,
    artCrop: imageUris.art_crop,
    borderCrop: imageUris.border_crop,
  };
}

export function getCardImageUris(card: ScryfallCard): DeckstateCardImageUris | undefined {
  if (card.image_uris) {
    return mapImageUris(card.image_uris);
  }

  const faceWithImage = card.card_faces?.find((face) => face.image_uris);
  return faceWithImage?.image_uris ? mapImageUris(faceWithImage.image_uris) : undefined;
}

export function pickCardImage(
  imageUris?: DeckstateCardImageUris,
  preference: "small" | "normal" | "large" | "artCrop" = "normal",
): string | undefined {
  if (!imageUris) {
    return undefined;
  }

  if (preference === "artCrop") {
    return imageUris.artCrop ?? imageUris.normal ?? imageUris.small ?? imageUris.large;
  }

  if (preference === "small") {
    return imageUris.small ?? imageUris.normal ?? imageUris.large ?? imageUris.artCrop;
  }

  if (preference === "large") {
    return imageUris.large ?? imageUris.normal ?? imageUris.small ?? imageUris.artCrop;
  }

  return imageUris.normal ?? imageUris.small ?? imageUris.large ?? imageUris.artCrop;
}
