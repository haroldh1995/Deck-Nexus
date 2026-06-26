import { expect, test, type Page } from "@playwright/test";

const homeRouteChecks = [
  ["create-deck", "/create"],
  ["deck-library", "/library"],
  ["card-search", "/search"],
  ["scan-cards", "/scan"],
  ["owned-cards", "/owned"],
  ["import-deck", "/import"],
  ["analyzer", "/analyzer"],
  ["deck-groups", "/groups"],
  ["tags", "/tags"],
  ["test-deck", "/test"],
  ["export", "/export"],
  ["settings", "/settings"],
] as const;

async function createBlankDeck(page: Page, name: string) {
  await page.goto("/create");
  await page.getByLabel("Deck name").fill(name);
  await page.getByRole("button", { name: "Save Blank Commander Deck" }).click();
  await expect(page).toHaveURL(/deck-builder/);
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

async function fillCardModal(
  page: Page,
  card: {
    name: string;
    typeLine: string;
    colors?: string[];
    roleTags?: string;
    customTags?: string;
    owned?: boolean;
  },
) {
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Card name").fill(card.name);
  await dialog.getByLabel("Card type line").fill(card.typeLine);

  for (const color of card.colors ?? []) {
    await dialog.getByLabel(color, { exact: true }).check();
  }

  if (card.roleTags) {
    await dialog.getByLabel("Role tags").fill(card.roleTags);
  }

  if (card.customTags) {
    await dialog.getByLabel("Custom tags").fill(card.customTags);
  }

  if (card.owned === false) {
    await dialog.getByLabel("Confirmed owned").uncheck();
  }
}

async function addCardToSection(
  page: Page,
  sectionLabel: string,
  card: Parameters<typeof fillCardModal>[1],
) {
  const section = page.locator(`section[aria-label="${sectionLabel}"]`).first();
  await section.getByRole("button", { name: "Add", exact: true }).click();
  await fillCardModal(page, card);
  await page.getByRole("button", { name: "Save Card" }).click();
}

test.describe("Deck Nexus local-first flow", () => {
  test("opens every permanent Home command route from the holographic orbit keyboard controls", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    for (const [id, route] of homeRouteChecks) {
      await page.goto("/");
      const scene = page.getByTestId("home-hologram-scene");
      await expect(scene).toBeVisible();
      await expect(page.getByTestId(`orbit-card-${id}`)).toBeAttached();
      await scene.focus();

      const targetIndex = homeRouteChecks.findIndex(([cardId]) => cardId === id);
      for (let index = 0; index < targetIndex; index += 1) {
        await page.keyboard.press("ArrowRight");
      }

      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(new RegExp(`${route.replace("/", "\\/")}$`));
    }
  });

  test("returns Home without replaying the full intro and opens dynamic favorites", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByTestId("home-hologram-scene").focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/create$/);

    await page.goBack();
    await expect(page.getByTestId("home-hologram-scene")).toHaveAttribute(
      "data-intro",
      /return|reduced/,
    );

    await page.evaluate(async () => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("deck-nexus-local");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction("favorites", "readwrite");
          transaction.objectStore("favorites").put({
            id: "favorite-e2e",
            type: "deck",
            targetId: "deck-e2e",
            title: "E2E Favorite Deck",
            subtitle: "Stored locally",
            route: "/deck-builder/deck-e2e",
            order: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          transaction.oncomplete = () => {
            database.close();
            window.dispatchEvent(new Event("deck-nexus:favorites-updated"));
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
        };
      });
    });

    await expect(
      page.getByTestId("fallback-card-favorite:favorite-e2e"),
    ).toBeVisible();
    await page.getByTestId("fallback-card-favorite:favorite-e2e").click();
    await expect(page).toHaveURL(/deck-builder\/deck-e2e$/);
  });

  test("navigates, creates a blank Commander deck, and shows it in the library", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "No decks summoned" }),
    ).toBeVisible();
    await page.getByRole("link", { name: /Create Deck/ }).first().click();

    await page.getByLabel("Deck name").fill("Starlit Command");
    await page.getByLabel("Commander name").fill("Atraxa");
    await page.getByRole("button", { name: "Save Blank Commander Deck" }).click();

    await expect(page).toHaveURL(/deck-builder/);
    await expect(page.getByRole("heading", { name: "Starlit Command" })).toBeVisible();
    await expect(page.getByText("Atraxa")).toBeVisible();

    await page.getByRole("link", { name: /Library/ }).first().click();
    await expect(page.getByRole("heading", { name: "Deck Library" })).toBeVisible();
    await expect(page.getByText("Starlit Command")).toBeVisible();
    await expect(page.getByText("Commander", { exact: true })).toBeVisible();
  });

  test("settings visibly switch the home orbit into static mode", async ({
    page,
  }) => {
    await page.goto("/settings");

    await page.getByLabel("Static home screen").check();
    await page.getByLabel("Reduced motion").check();
    await page.getByRole("link", { name: /Nexus/ }).click();

    await expect(page.locator(".nexus-orbit--static")).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Create Deck/ }).first(),
    ).toBeVisible();

    await page.reload();
    await expect(page.locator(".nexus-orbit--static")).toBeVisible();
  });

  test("opens a deck from the library and edits the Deck Builder locally", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    await createBlankDeck(page, "Builder Trial");

    await page.getByRole("button", { name: /Add Commander/ }).click();
    await fillCardModal(page, {
      name: "Tatyova, Benthic Druid",
      typeLine: "Legendary Creature",
      colors: ["U", "G"],
    });
    await page.getByRole("button", { name: "Save Card" }).click();
    await expect(
      page.locator(".commander-zone").getByText("Tatyova, Benthic Druid"),
    ).toBeVisible();
    await expect(page.locator(".deck-count-status")).toContainText("1");
    await expect(
      page.locator(".commander-orbit").getByLabel("Blue color identity active."),
    ).toBeVisible();
    await expect(
      page.locator(".commander-orbit").getByLabel("Green color identity active."),
    ).toBeVisible();

    await addCardToSection(page, "Creatures", {
      name: "Etherium-Horn Scout",
      typeLine: "Artifact Creature",
      colors: ["U"],
      roleTags: "synergy",
      owned: false,
    });
    await addCardToSection(page, "Instants", {
      name: "Counterspell",
      typeLine: "Instant",
      colors: ["U"],
      roleTags: "interaction",
    });
    await addCardToSection(page, "Sorceries", {
      name: "Cultivate",
      typeLine: "Sorcery",
      colors: ["G"],
      roleTags: "ramp",
    });
    await addCardToSection(page, "Artifacts", {
      name: "Local Fast Mana Relic",
      typeLine: "Artifact",
      roleTags: "fast mana",
    });
    await addCardToSection(page, "Enchantments", {
      name: "Rancor",
      typeLine: "Enchantment",
      colors: ["G"],
    });
    await addCardToSection(page, "Other Permanents", {
      name: "Jace, Local Adept",
      typeLine: "Planeswalker",
      colors: ["U"],
    });
    await addCardToSection(page, "Lands", {
      name: "Command Tower",
      typeLine: "Artifact Land",
    });

    const workspaceSectionOrder = await page
      .locator(".deck-workspace-grid section.builder-section")
      .evaluateAll((sections) =>
        sections.map((section) => section.getAttribute("aria-label")),
      );
    expect(workspaceSectionOrder).toEqual([
      "Creatures",
      "Instants",
      "Sorceries",
      "Artifacts",
      "Enchantments",
      "Other Permanents",
      "Lands",
    ]);
    await expect(
      page.locator('section[aria-label="Creatures"]').getByLabel("Creatures count 1"),
    ).toBeVisible();
    await expect(
      page.locator('section[aria-label="Lands"]').getByLabel("Lands count 1"),
    ).toBeVisible();
    await expect(page.locator(".builder-card-rail")).toHaveCount(7);

    const creatureRail = page
      .locator('section[aria-label="Creatures"] .builder-card-rail')
      .first();
    const landsRail = page
      .locator('section[aria-label="Lands"] .builder-card-rail')
      .first();
    await creatureRail.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
      element.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    await expect
      .poll(() => landsRail.evaluate((element) => element.scrollLeft))
      .toBe(0);

    await expect(
      page.locator('section[aria-label="Creatures"]').getByText("Etherium-Horn Scout"),
    ).toBeVisible();
    await expect(
      page.locator('section[aria-label="Lands"]').getByText("Command Tower"),
    ).toBeVisible();
    await expect(page.getByText("Fast mana tags: 1")).toBeVisible();

    await addCardToSection(page, "Instants", {
      name: "Red Elemental Burst",
      typeLine: "Instant",
      colors: ["R"],
    });
    await expect(
      page.getByText(
        "This card is outside your commander's color identity. Add anyway and mark deck illegal?",
      ),
    ).toBeVisible();
    await page
      .getByRole("dialog")
      .last()
      .getByRole("button", { name: "Send to Maybeboard" })
      .click();
    await page.getByRole("tab", { name: /Maybeboard/ }).click();
    await expect(
      page.locator('section[aria-label="Instants"]').getByText("Red Elemental Burst"),
    ).toBeVisible();

    await page.getByRole("tab", { name: /Main Deck/ }).click();
    await addCardToSection(page, "Instants", {
      name: "Counterspell",
      typeLine: "Instant",
      colors: ["U"],
    });
    await expect(
      page.getByText("Commander singleton rule allows only one copy."),
    ).toBeVisible();
    await page
      .getByRole("dialog")
      .last()
      .getByRole("button", { name: "Cancel" })
      .click();

    const scoutTile = page
      .locator(".builder-card-tile")
      .filter({ hasText: "Etherium-Horn Scout" })
      .first();
    await scoutTile.click();
    await expect(scoutTile).toHaveAttribute("aria-pressed", "true");
    await scoutTile.click();
    await expect(page.getByRole("dialog").last()).toContainText("Card Detail");
    await page.getByRole("button", { name: "Close" }).click();
    await scoutTile.getByRole("button", { name: "Details" }).click();
    await page.getByLabel("Notes").fill("Keep with artifact synergies.");
    await page.getByLabel("Custom tags").fill("favorite");
    await page.getByRole("button", { name: "Save Tags and Notes" }).click();
    await page.getByRole("button", { name: "Mark Protected" }).click();
    await page.getByRole("button", { name: "Move to Cuts" }).click();
    await page.getByLabel("Optional cut reason").fill("Testing cuts flow");
    await page
      .getByRole("dialog")
      .last()
      .getByRole("button", { name: "Move to Cuts" })
      .click();
    await page.getByRole("tab", { name: /Cuts/ }).click();
    await expect(
      page.locator('section[aria-label="Creatures"]').getByText("Etherium-Horn Scout"),
    ).toBeVisible();

    await page.getByRole("tab", { name: /Main Deck/ }).click();
    await page
      .locator('section[aria-label="Lands"]')
      .getByRole("button", { name: "Expand" })
      .click();
    await page.getByLabel("Search Section").fill("Command");
    await expect(
      page.getByRole("dialog").last().getByText("Command Tower"),
    ).toBeVisible();
    await page.getByRole("button", { name: /Back/ }).click();

    await page.reload();
    await expect(page.getByRole("heading", { name: "Builder Trial" })).toBeVisible();
    await expect(page.getByText("Command Tower")).toBeVisible();

    await page.getByRole("link", { name: /Library/ }).first().click();
    await page.getByRole("link", { name: "Open Deck" }).click();
    await expect(page.getByRole("heading", { name: "Builder Trial" })).toBeVisible();
  });
});
