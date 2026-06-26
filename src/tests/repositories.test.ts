import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabaseForTests } from "../db/database";
import {
  createBlankCommanderDeck,
  deleteDeck,
  ensureAppSettings,
  listDecks,
  updateAppSettings,
} from "../db/repositories";

describe("local IndexedDB repositories", () => {
  beforeEach(async () => {
    await resetDatabaseForTests();
  });

  it("creates default app settings locally and keeps local-first mode enabled", async () => {
    const settings = await ensureAppSettings();

    expect(settings.id).toBe("app");
    expect(settings.localFirstMode).toBe(true);
    expect(settings.scannerBatchPersistence).toBe(true);
  });

  it("saves settings updates to IndexedDB", async () => {
    await ensureAppSettings();
    const settings = await updateAppSettings({
      reducedMotion: true,
      staticHomeScreen: true,
      glowIntensity: 0.7,
    });

    expect(settings.reducedMotion).toBe(true);
    expect(settings.staticHomeScreen).toBe(true);
    expect(settings.glowIntensity).toBe(0.7);
    expect((await ensureAppSettings()).staticHomeScreen).toBe(true);
  });

  it("creates and deletes a blank Commander deck", async () => {
    const deck = await createBlankCommanderDeck({
      name: "Moonlit Nexus",
      commanderName: "Alela, Artful Provocateur",
      goals: ["Flyers", "Artifacts"],
    });

    expect(deck.format).toBe("commander");
    expect(deck.commanderNames).toEqual(["Alela, Artful Provocateur"]);
    expect(deck.goals).toHaveLength(2);

    const decks = await listDecks();
    expect(decks).toHaveLength(1);
    expect(decks[0].name).toBe("Moonlit Nexus");

    await deleteDeck(deck.id);
    expect(await listDecks()).toHaveLength(0);
  });
});
