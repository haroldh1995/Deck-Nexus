import { describe, expect, it, vi } from "vitest";
import { resetDatabaseForTests } from "../db/database";
import {
  buildScryfallQuery,
  cardSearchUrl,
  chunkScryfallCollectionIdentifiers,
  hasNoPriceFields,
  isAdvancedScryfallQuery,
  mapScryfallCard,
  normalizeScryfallText,
  ScryfallRequestQueue,
  ScryfallServiceError,
} from "../services/scryfall";
import type { ScryfallCard } from "../services/scryfall";

function baseCard(overrides: Partial<ScryfallCard> = {}): ScryfallCard {
  return {
    object: "card",
    id: "scryfall-id",
    oracle_id: "oracle-id",
    name: "Test Card",
    lang: "en",
    uri: "https://api.scryfall.com/cards/scryfall-id",
    scryfall_uri: "https://scryfall.com/card/tst/1/test-card",
    layout: "normal",
    mana_cost: "{1}{U}",
    cmc: 2,
    type_line: "Creature - Wizard",
    oracle_text: "Draw a card.",
    colors: ["U"],
    color_identity: ["U"],
    keywords: ["Flying"],
    legalities: { commander: "legal" },
    games: ["paper"],
    set: "tst",
    set_name: "Test Set",
    collector_number: "1",
    rarity: "rare",
    prices: { usd: "1.00", eur: "1.00", tix: "1.00" },
    purchase_uris: { tcgplayer: "https://example.invalid" },
    ...overrides,
  };
}

describe("Scryfall endpoint and query helpers", () => {
  it("encodes search URLs and preserves advanced Scryfall syntax", () => {
    const advanced = "t:creature legal:commander mv<=2";
    expect(isAdvancedScryfallQuery(advanced)).toBe(true);
    expect(buildScryfallQuery({ query: advanced })).toContain(advanced);

    const normal = buildScryfallQuery({ query: "Sol Ring" });
    expect(normal).toBe('name:"Sol Ring"');
    const url = cardSearchUrl({ query: "Sol Ring", builtQuery: normal });
    expect(url).toContain("/cards/search");
    expect(url).toContain("q=name%3A%22Sol+Ring%22");
  });

  it("normalizes autocomplete text without destructive punctuation stripping", () => {
    expect(normalizeScryfallText("  Urza's   Saga  ")).toBe("Urza's Saga");
    expect(normalizeScryfallText("Fable-of-the-Mirror-Breaker")).toBe("Fable-of-the-Mirror-Breaker");
  });
});

describe("Scryfall card mapping", () => {
  it("maps card data while stripping price and purchase fields", () => {
    const mapped = mapScryfallCard(baseCard());
    expect(mapped.name).toBe("Test Card");
    expect(mapped.colorIdentity).toEqual(["U"]);
    expect(mapped.legalities.commander).toBe("legal");
    expect(hasNoPriceFields(mapped)).toBe(true);
    expect(JSON.stringify(mapped)).not.toMatch(/tcgplayer|usd|eur|tix|purchase_uris|prices/i);
  });

  it("uses card face data and imagery for double-faced cards", () => {
    const mapped = mapScryfallCard(
      baseCard({
        layout: "transform",
        image_uris: undefined,
        mana_cost: undefined,
        type_line: undefined,
        oracle_text: undefined,
        card_faces: [
          {
            name: "Front Face",
            mana_cost: "{G}",
            type_line: "Creature - Human",
            oracle_text: "Front rules.",
            colors: ["G"],
            image_uris: { small: "front-small.jpg", normal: "front-normal.jpg" },
          },
          {
            name: "Back Face",
            type_line: "Creature - Werewolf",
            oracle_text: "Back rules.",
            colors: ["G"],
          },
        ],
      }),
    );

    expect(mapped.cardFaces).toHaveLength(2);
    expect(mapped.imageUris?.normal).toBe("front-normal.jpg");
    expect(mapped.oracleText).toContain("Front rules.");
    expect(mapped.oracleText).toContain("Back rules.");
  });
});

describe("Scryfall collection and request pacing helpers", () => {
  it("batches collection identifiers at Scryfall's supported batch size", () => {
    const identifiers = Array.from({ length: 80 }, (_, index) => ({ name: `Card ${index}` }));
    const chunks = chunkScryfallCollectionIdentifiers(identifiers);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(75);
    expect(chunks[1]).toHaveLength(5);
  });

  it("deduplicates identical in-flight requests", async () => {
    await resetDatabaseForTests();
    const queue = new ScryfallRequestQueue({ minDelayMs: 0 });
    const request = vi.fn(async () => "ok");

    const [left, right] = await Promise.all([
      queue.schedule({ key: "same", request }),
      queue.schedule({ key: "same", request }),
    ]);

    expect(left).toBe("ok");
    expect(right).toBe("ok");
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("retries transient 429 responses with controlled backoff", async () => {
    const queue = new ScryfallRequestQueue({ minDelayMs: 0, maxAttempts: 2 });
    const request = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(
        new ScryfallServiceError("Rate limited", {
          status: 429,
          code: "rate_limited",
          retryAfterMs: 0,
        }),
      )
      .mockResolvedValueOnce("ok");

    await expect(queue.schedule({ key: "rate", request })).resolves.toBe("ok");
    expect(request).toHaveBeenCalledTimes(2);
  });
});
