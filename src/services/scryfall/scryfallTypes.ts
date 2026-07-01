import type {
  CommanderColor,
  DeckstateCardFace,
  DeckstateCardImageUris,
  DeckstateScryfallCard,
} from "../../types/domain";

export type ScryfallPriority = "high" | "medium" | "low";

export interface ScryfallList<T> {
  object: "list";
  total_cards?: number;
  has_more: boolean;
  next_page?: string;
  data: T[];
  warnings?: string[];
}

export interface ScryfallAutocompleteList {
  object: "catalog";
  total_values: number;
  data: string[];
}

export interface ScryfallErrorObject {
  object: "error";
  code: string;
  status: number;
  warnings?: string[];
  details: string;
}

export interface ScryfallImageUris {
  small?: string;
  normal?: string;
  large?: string;
  png?: string;
  art_crop?: string;
  border_crop?: string;
}

export interface ScryfallCardFace {
  object?: "card_face";
  name: string;
  mana_cost?: string;
  type_line?: string;
  oracle_text?: string;
  colors?: string[];
  image_uris?: ScryfallImageUris;
}

export interface ScryfallRelatedCard {
  object: "related_card";
  id: string;
  component: string;
  name: string;
  type_line: string;
  uri: string;
}

export interface ScryfallCard {
  object: "card";
  id: string;
  oracle_id?: string;
  name: string;
  lang: string;
  released_at?: string;
  uri: string;
  scryfall_uri?: string;
  layout: string;
  highres_image?: boolean;
  image_status?: string;
  image_uris?: ScryfallImageUris;
  mana_cost?: string;
  cmc?: number;
  type_line?: string;
  oracle_text?: string;
  power?: string;
  toughness?: string;
  loyalty?: string;
  defense?: string;
  colors?: string[];
  color_identity?: string[];
  keywords?: string[];
  legalities?: Record<string, string>;
  games?: string[];
  reserved?: boolean;
  foil?: boolean;
  nonfoil?: boolean;
  oversized?: boolean;
  promo?: boolean;
  reprint?: boolean;
  variation?: boolean;
  set_id?: string;
  set?: string;
  set_name?: string;
  set_type?: string;
  collector_number?: string;
  rarity?: string;
  artist?: string;
  border_color?: string;
  frame?: string;
  full_art?: boolean;
  textless?: boolean;
  booster?: boolean;
  story_spotlight?: boolean;
  card_faces?: ScryfallCardFace[];
  all_parts?: ScryfallRelatedCard[];
  prices?: Record<string, string | null>;
  purchase_uris?: Record<string, string>;
}

export interface ScryfallBulkData {
  object: "bulk_data";
  id: string;
  type: string;
  name: string;
  description?: string;
  updated_at: string;
  uri: string;
  download_uri?: string;
  content_type?: string;
  content_encoding?: string;
  compressed_size?: number;
}

export interface ScryfallSearchOptions {
  query: string;
  exactPhrase?: string;
  typeText?: string;
  oracleText?: string;
  keyword?: string;
  commanderIdentity?: CommanderColor[];
  commanderLegal?: boolean;
  commanderCandidates?: boolean;
  includeExtras?: boolean;
  unique?: "cards" | "art" | "prints";
  sort?: string;
  direction?: "auto" | "asc" | "desc";
  page?: number;
  pageUrl?: string;
  cachedOnly?: boolean;
  priority?: ScryfallPriority;
}

export interface ScryfallSearchResultPage {
  cards: DeckstateScryfallCard[];
  query: string;
  page: number;
  totalCards?: number;
  hasMore: boolean;
  nextPage?: string;
  warnings: string[];
  source: "live" | "cache" | "offline";
}

export interface ScryfallAutocompleteResult {
  query: string;
  suggestions: string[];
  source: "live" | "cache" | "offline";
}

export interface NamedCardLookupOptions {
  exact?: string;
  fuzzy?: string;
  set?: string;
  priority?: ScryfallPriority;
}

export interface ScryfallCollectionIdentifier {
  id?: string;
  mtgo_id?: number;
  multiverse_id?: number;
  oracle_id?: string;
  illustration_id?: string;
  name?: string;
  set?: string;
  collector_number?: string;
}

export interface ScryfallCollectionResult {
  found: DeckstateScryfallCard[];
  notFound: ScryfallCollectionIdentifier[];
}

export type { DeckstateCardFace, DeckstateCardImageUris, DeckstateScryfallCard };
