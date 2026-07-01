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
      await page.evaluate(() => {
        localStorage.removeItem("deck-nexus-home-focused-card");
      });
      await page.reload();
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

  test("uses the floating orbit as the only visible Home navigation and saves gear customization", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByTestId("home-hologram-scene")).toBeVisible();
    await expect(page.getByTestId("home-hologram-scene")).toHaveAttribute(
      "data-orbit-system",
      "chamber",
    );
    await expect(
      page.getByRole("button", { name: "Customize Home menu" }),
    ).toBeVisible();
    await expect(page.getByText(/Orbit order/i)).toHaveCount(0);
    await expect(page.locator(".home-accessibility-nav")).toHaveCount(0);
    await expect(page.locator(".bottom-command-bar")).toHaveCount(0);
    await expect(page.locator(".home-overlay-carousel")).toHaveCount(0);

    const homeOverflow = await page.evaluate(() => {
      const scrollingElement = document.scrollingElement ?? document.documentElement;
      const referenceStyle = getComputedStyle(
        document.querySelector(".home-reference-layer") as HTMLElement,
      );
      return {
        bodyOverflow:
          document.body.scrollHeight - document.body.clientHeight,
        documentOverflow:
          scrollingElement.scrollHeight - scrollingElement.clientHeight,
        horizontalOverflow:
          scrollingElement.scrollWidth - scrollingElement.clientWidth,
        referenceObjectFit: referenceStyle.objectFit,
        referenceOpacity: referenceStyle.opacity,
      };
    });
    expect(homeOverflow.bodyOverflow).toBeLessThanOrEqual(2);
    expect(homeOverflow.documentOverflow).toBeLessThanOrEqual(2);
    expect(homeOverflow.horizontalOverflow).toBeLessThanOrEqual(2);
    expect(homeOverflow.referenceObjectFit).toBe("cover");
    expect(Number(homeOverflow.referenceOpacity)).toBeLessThan(0.3);

    const focusedBeforeDrag = await page
      .locator('.home-orbit-card[aria-current="true"]')
      .getAttribute("data-testid");
    await page.mouse.move(340, 420);
    await page.mouse.down();
    await page.mouse.move(220, 424, { steps: 8 });
    await expect
      .poll(() =>
        page
          .locator('.home-orbit-card[aria-current="true"]')
          .getAttribute("data-testid"),
      )
      .not.toBe(focusedBeforeDrag);
    await expect(page.getByTestId("home-hologram-scene")).toHaveClass(
      /home-hologram-scene--interacting/,
    );
    await page.mouse.up();
    await expect(page).toHaveURL(/\/$/);

    await page
      .getByRole("button", { name: "Customize Home menu" })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Customize Home Menu" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Move Deck Library earlier" })
      .click();
    await page.getByRole("button", { name: "Save Order" }).click();
    await expect(
      page.getByRole("dialog", { name: "Customize Home Menu" }),
    ).toHaveCount(0);

    const savedHomeOrder = await page.evaluate(async () => {
      return await new Promise<string[]>((resolve, reject) => {
        const request = indexedDB.open("deck-nexus-local");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction("settings", "readonly");
          const getRequest = transaction.objectStore("settings").get("app");
          getRequest.onsuccess = () => {
            resolve(getRequest.result.homeOrbitOrder);
            database.close();
          };
          getRequest.onerror = () => reject(getRequest.error);
        };
      });
    });
    expect(savedHomeOrder.slice(0, 2)).toEqual([
      "deck-library",
      "create-deck",
    ]);

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
      page.getByTestId("orbit-card-favorite:favorite-e2e"),
    ).toBeAttached();
    await page.getByTestId("home-hologram-scene").focus();
    for (let index = 0; index < homeRouteChecks.length; index += 1) {
      await page.keyboard.press("ArrowRight");
    }
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/deck-builder\/deck-e2e$/);
  });

  test("navigates, creates a blank Commander deck, and shows it in the library", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "No decks summoned" }),
    ).toBeVisible();
    await page
      .locator(".home-core-status__actions")
      .getByRole("link", { name: /Create Deck/ })
      .click();

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
    await expect(page.getByTestId("orbit-card-create-deck")).toBeVisible();
    await expect(page.locator(".bottom-command-bar")).toHaveCount(0);

    await page.reload();
    await expect(page.locator(".nexus-orbit--static")).toBeVisible();
  });

  test("uses Card Search, Owned Cards, Scanner feeder persistence, and Analyzer Smart Build", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    await page.goto("/search");
    await expect(page.getByRole("heading", { name: "Card Search" })).toBeVisible();
    await page.getByLabel("Search Scryfall cards").fill("Countersp");
    await expect(page.getByRole("option", { name: "Counterspell" })).toBeVisible();
    await page.getByRole("option", { name: "Counterspell" }).click();
    await expect(page.getByRole("heading", { name: "Counterspell" })).toBeVisible();
    await expect(page).toHaveURL(/\/search$/);
    const counterspellResult = page
      .locator(".search-result-card")
      .filter({ hasText: "Counterspell" })
      .first();
    await counterspellResult.getByRole("button", { name: "Add To..." }).click();
    await expect(page.getByRole("dialog", { name: /Add selected cards/i })).toBeVisible();
    await page.getByRole("button", { name: /Wishlist/i }).click();
    await page.getByRole("button", { name: /Confirm/i }).click();
    await expect(page.locator(".search-action-confirmation").getByText(/Added Counterspell to Wishlist/i)).toBeVisible();
    await counterspellResult.getByRole("button", { name: "Add To..." }).click();
    await page.getByRole("button", { name: /Owned Cards/i }).click();
    await page.getByRole("button", { name: /Confirm/i }).click();
    await expect(
      page.locator(".search-action-confirmation").getByText(/Owned Cards/i),
    ).toBeVisible();

    await page.goto("/owned");
    await expect(page.getByRole("heading", { name: "Owned Cards" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Counterspell" })).toBeVisible();
    await page.goto("/wishlist");
    await expect(page.locator("h1", { hasText: "Wishlist" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Counterspell" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Return to Home" })).toBeVisible();
    await page.getByRole("button", { name: "Return to Home" }).click();
    await expect(page.getByTestId("home-hologram-scene")).toBeVisible();
    await expect(page.getByRole("button", { name: "Return to Home" })).toHaveCount(0);

    await page.addInitScript(() => {
      const testWindow = window as unknown as {
        __deckNexusScannerTestHarness?: boolean;
        __deckNexusScannerTestCards?: Array<{
          name: string;
          scryfallId: string;
          oracleId: string;
          typeLine: string;
          colorIdentity: string[];
          confidence: number;
        }>;
        __deckNexusScannerBeepCount?: number;
        __deckNexusAdvanceFakeCard?: boolean;
        __deckNexusDrawFakeScanner?: () => void;
      };
      testWindow.__deckNexusScannerTestHarness = true;
      testWindow.__deckNexusScannerTestCards = [
        {
          name: "Counterspell",
          scryfallId: "fake-counterspell",
          oracleId: "fake-oracle-counterspell",
          typeLine: "Instant",
          colorIdentity: ["U"],
          confidence: 0.94,
        },
        {
          name: "Sol Ring",
          scryfallId: "fake-sol-ring",
          oracleId: "fake-oracle-sol-ring",
          typeLine: "Artifact",
          colorIdentity: [],
          confidence: 0.92,
        },
      ];
      testWindow.__deckNexusScannerBeepCount = 0;
      window.addEventListener("deck-nexus:scan-beep", () => {
        testWindow.__deckNexusScannerBeepCount =
          (testWindow.__deckNexusScannerBeepCount ?? 0) + 1;
      });

      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 896;
      const context = canvas.getContext("2d")!;
      function draw() {
        const secondCard = Boolean(testWindow.__deckNexusAdvanceFakeCard);
        context.fillStyle = secondCard ? "#102030" : "#18243d";
        context.fillRect(0, 0, canvas.width, canvas.height);
        const cardX = secondCard ? 48 : 76;
        const cardY = secondCard ? 132 : 96;
        const cardWidth = secondCard ? 516 : 488;
        const cardHeight = secondCard ? 720 : 682;
        context.fillStyle = secondCard ? "#c8b276" : "#8da7d0";
        context.fillRect(cardX, cardY, cardWidth, cardHeight);
        for (let stripe = 0; stripe < 14; stripe += 1) {
          context.fillStyle = stripe % 2 === 0
            ? secondCard ? "#a98c42" : "#5d7fb8"
            : secondCard ? "#d7c083" : "#a9bad8";
          context.fillRect(cardX + 24, cardY + 82 + stripe * 34, cardWidth - 48, 16);
        }
        context.strokeStyle = secondCard ? "#5c4518" : "#173c78";
        context.lineWidth = 4;
        for (let line = 0; line < 9; line += 1) {
          const x = cardX + 42 + line * 46;
          context.beginPath();
          context.moveTo(x, cardY + 112);
          context.lineTo(x, cardY + cardHeight - 42);
          context.stroke();
        }
        for (let line = 0; line < 10; line += 1) {
          const y = cardY + 132 + line * 48;
          context.beginPath();
          context.moveTo(cardX + 34, y);
          context.lineTo(cardX + cardWidth - 34, y);
          context.stroke();
        }
        context.strokeStyle = secondCard ? "#a88c32" : "#2f78ff";
        context.lineWidth = 18;
        context.strokeRect(cardX, cardY, cardWidth, cardHeight);
        context.fillStyle = secondCard ? "#2b2112" : "#07152e";
        context.font = "40px sans-serif";
        context.fillText(secondCard ? "Sol Ring" : "Counterspell", cardX + 32, cardY + 72);
      }
      draw();
      testWindow.__deckNexusDrawFakeScanner = draw;
      window.setInterval(draw, 120);
      const stream = canvas.captureStream(12);
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          getUserMedia: async () => stream,
          enumerateDevices: async () => [
            {
              kind: "videoinput",
              deviceId: "fake-rear-camera",
              groupId: "fake",
              label: "Back Camera",
            },
          ],
        },
      });
      Object.defineProperty(window, "isSecureContext", {
        configurable: true,
        value: true,
      });
      class FakeAudioContext {
        currentTime = 0;
        destination = {};
        state = "running";
        resume = async () => undefined;
        close = async () => undefined;
        createOscillator = () => ({
          type: "triangle",
          frequency: {
            setValueAtTime: () => undefined,
            exponentialRampToValueAtTime: () => undefined,
          },
          connect: () => undefined,
          start: () => undefined,
          stop: () => {
            window.setTimeout(() => undefined, 0);
          },
          disconnect: () => undefined,
          onended: undefined,
        });
        createGain = () => ({
          gain: {
            setValueAtTime: () => undefined,
            exponentialRampToValueAtTime: () => undefined,
          },
          connect: () => undefined,
          disconnect: () => undefined,
        });
      }
      Object.defineProperty(window, "AudioContext", {
        configurable: true,
        value: FakeAudioContext,
      });
    });

    await page.goto("/scan");
    await expect(page.getByRole("heading", { name: "Scan Cards" })).toBeVisible();
    await page.getByRole("button", { name: /Allow Camera/ }).first().click();
    await expect(page.getByText(/Camera live/i)).toBeVisible();
    await expect(page.locator(".scanner-batch-summary").getByText(/1 records/i)).toBeVisible({
      timeout: 20_000,
    });
    const beepCountAfterFirst = await page.evaluate(
      () =>
        (window as unknown as { __deckNexusScannerBeepCount?: number })
          .__deckNexusScannerBeepCount ?? 0,
    );
    expect(beepCountAfterFirst).toBe(1);
    await page.getByRole("button", { name: "Mute scan confirmation sound" }).click();
    await page.evaluate(() => {
      const scannerWindow = window as unknown as {
        __deckNexusAdvanceFakeCard?: boolean;
        __deckNexusDrawFakeScanner?: () => void;
      };
      scannerWindow.__deckNexusAdvanceFakeCard = true;
      scannerWindow.__deckNexusDrawFakeScanner?.();
    });
    await expect(page.locator(".scanner-batch-summary").getByText(/2 records/i)).toBeVisible({
      timeout: 20_000,
    });
    const beepCountAfterSecond = await page.evaluate(
      () =>
        (window as unknown as { __deckNexusScannerBeepCount?: number })
          .__deckNexusScannerBeepCount ?? 0,
    );
    expect(beepCountAfterSecond).toBe(beepCountAfterFirst);
    await page.reload();
    await expect(page.getByText(/Unfinished scan batch found/i)).toBeVisible();
    await expect(page.locator(".scanner-batch-summary").getByText(/2 records/i)).toBeVisible();
    await page.getByLabel("Scanner mode").selectOption("stacking_feeder");
    await page.getByRole("button", { name: "Start Batch" }).click();
    await page.getByText("Manual fallback and feeder controls").click();
    await page.getByRole("button", { name: "Simulate Scan" }).click();
    await page.getByRole("button", { name: "Too-Close Cue" }).click();
    await expect(page.getByText(/Too-close cue detected/i)).toBeVisible();
    await page.getByRole("button", { name: "Trigger Tray Full Prompt" }).click();
    await expect(page.locator(".scanner-tray-prompt").getByText(/Tray may be full/i)).toBeVisible();
    await page.getByRole("button", { name: "Review Batch" }).first().click();
    await expect(page.getByRole("dialog", { name: "Batch Review" })).toBeVisible();
    await page.getByRole("button", { name: /Confirm All High Confidence/ }).click();
    await page.getByRole("button", { name: "Apply All Confirmed to Owned" }).click();
    await expect(page.getByText(/applied to Owned Cards/i)).toBeVisible();

    await createBlankDeck(page, "Analysis Flow");
    await page.getByRole("button", { name: /Add Commander/ }).click();
    await fillCardModal(page, {
      name: "Tatyova, Benthic Druid",
      typeLine: "Legendary Creature",
      colors: ["U", "G"],
      roleTags: "commander, draw",
    });
    await page.getByRole("button", { name: "Save Card" }).click();
    await page.goto("/analyzer");
    await expect(page.getByRole("heading", { name: "Analyzer" })).toBeVisible();
    await page.getByRole("tab", { name: "Recommendations" }).click();
    await expect(page.getByLabel("Recommendation tab")).toBeVisible();
    await expect(page.getByText("Lightning Bolt")).toHaveCount(0);
    await page.getByRole("tab", { name: "Smart Build" }).click();
    await page.getByRole("button", { name: /Generate Smart Build Review/i }).click();
    await expect(page.getByText("Build Summary")).toBeVisible();
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
