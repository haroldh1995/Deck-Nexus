import { expect, test } from "@playwright/test";

test.describe("interaction performance and responsive motion", () => {
  test("moves the Home orbit continuously during drag without page overflow", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByTestId("home-hologram-scene")).toBeVisible();
    await expect(page.locator(".home-center-cursor, .selection-reticle, .orbit-cursor, .focus-target"))
      .toHaveCount(0);

    const sceneBox = await page.getByTestId("home-hologram-scene").boundingBox();
    expect(sceneBox).not.toBeNull();

    const card = page.getByTestId("orbit-card-create-deck");
    const beforeTransform = await card.evaluate(
      (node) => getComputedStyle(node).transform,
    );

    await page.mouse.move(sceneBox!.x + 330, sceneBox!.y + 410);
    await page.mouse.down();
    await page.mouse.move(sceneBox!.x + 280, sceneBox!.y + 410, { steps: 4 });
    const midOne = await card.evaluate((node) => getComputedStyle(node).transform);
    await page.mouse.move(sceneBox!.x + 210, sceneBox!.y + 410, { steps: 4 });
    const midTwo = await card.evaluate((node) => getComputedStyle(node).transform);
    await page.mouse.move(sceneBox!.x + 140, sceneBox!.y + 410, { steps: 4 });
    const midThree = await card.evaluate((node) => getComputedStyle(node).transform);
    await page.mouse.up();

    expect(new Set([beforeTransform, midOne, midTwo, midThree]).size)
      .toBeGreaterThanOrEqual(4);

    const overflow = await page.evaluate(() => {
      const root = document.scrollingElement ?? document.documentElement;
      return {
        horizontal: root.scrollWidth - root.clientWidth,
        vertical: root.scrollHeight - root.clientHeight,
      };
    });
    expect(overflow.horizontal).toBeLessThanOrEqual(2);
    expect(overflow.vertical).toBeLessThanOrEqual(2);
  });

  test("keeps the selected Home card above the core and beam", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByTestId("home-hologram-scene")).toBeVisible();
    await expect
      .poll(() =>
        page
          .locator('.home-orbit-card[aria-current="true"]')
          .evaluate((node) => getComputedStyle(node).opacity),
      )
      .toBe("1");

    const layering = await page.evaluate(() => {
      const selected = document.querySelector<HTMLElement>(
        '.home-orbit-card[aria-current="true"]',
      );
      const crystal = document.querySelector<HTMLElement>(".central-crystal");
      const beam = document.querySelector<HTMLElement>(".central-beam");
      const icon = selected?.querySelector<HTMLElement>(
        ".home-orbit-card__icon-shell",
      );
      const iconRect = icon?.getBoundingClientRect();
      const hit = iconRect
        ? document.elementFromPoint(
            iconRect.left + iconRect.width / 2,
            iconRect.top + iconRect.height / 2,
          )
        : null;

      return {
        cardOpacity: getComputedStyle(selected!).opacity,
        cardBackgroundColor: getComputedStyle(selected!).backgroundColor,
        selectedLayer: selected?.dataset.cardLayer ?? "",
        selectedZ: Number(getComputedStyle(selected!).zIndex),
        surfaceBackgroundColor: selected
          ? getComputedStyle(
              selected.querySelector(".home-orbit-card__surface")!,
            ).backgroundColor
          : "",
        surfaceOpacity: selected
          ? getComputedStyle(
              selected.querySelector(".home-orbit-card__surface")!,
            ).opacity
          : "",
        edgeBlendMode: selected
          ? getComputedStyle(
              selected.querySelector(".home-orbit-card__edge")!,
            ).mixBlendMode
          : "",
        crystalPointerEvents: crystal
          ? getComputedStyle(crystal).pointerEvents
          : "",
        crystalZ: crystal ? Number(getComputedStyle(crystal).zIndex) : 0,
        beamPointerEvents: beam ? getComputedStyle(beam).pointerEvents : "",
        beamZ: beam ? Number(getComputedStyle(beam).zIndex) : 0,
        hitCardId: hit?.closest<HTMLElement>(".home-orbit-card")?.dataset
          .cardId ?? "",
        selectedCardId: selected?.dataset.cardId ?? "",
        surfaceCount: selected?.querySelectorAll(".home-orbit-card__surface")
          .length ?? 0,
      };
    });

    expect(layering.selectedLayer).toBe("front-orbit-cards");
    expect(layering.cardOpacity).toBe("1");
    expect(layering.cardBackgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(layering.surfaceBackgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(layering.surfaceOpacity).toBe("1");
    expect(layering.edgeBlendMode).toBe("normal");
    expect(layering.selectedZ).toBeGreaterThan(layering.crystalZ);
    expect(layering.selectedZ).toBeGreaterThan(layering.beamZ);
    expect(layering.crystalPointerEvents).toBe("none");
    expect(layering.beamPointerEvents).toBe("none");
    expect(layering.hitCardId).toBe(layering.selectedCardId);
    expect(layering.surfaceCount).toBe(1);
  });

  test("starts route navigation from Home within the interaction budget", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByTestId("orbit-card-create-deck")).toBeVisible();

    const delay = await page.evaluate(async () => {
      const card = document.querySelector(
        '[data-testid="orbit-card-create-deck"]',
      );
      const started = performance.now();
      (card as HTMLButtonElement | null)?.click();
      while (
        location.pathname !== "/create" &&
        performance.now() - started < 2000
      ) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      return performance.now() - started;
    });

    expect(delay).toBeLessThan(220);
    await expect(page).toHaveURL(/\/create$/);
  });

  test("selects a visible off-center card before one-tap opening the centered card", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByTestId("orbit-card-create-deck")).toHaveAttribute(
      "aria-current",
      "true",
    );

    const libraryCard = page.getByTestId("orbit-card-deck-library");
    const libraryBox = await libraryCard.boundingBox();
    expect(libraryBox).not.toBeNull();
    await page.mouse.click(
      libraryBox!.x + libraryBox!.width / 2,
      libraryBox!.y + libraryBox!.height / 2,
    );
    await expect(page).toHaveURL(/\/$/);
    await expect(libraryCard).toHaveAttribute("aria-current", "true", {
      timeout: 1200,
    });

    const delay = await page.evaluate(async () => {
      const card = document.querySelector(
        '[data-testid="orbit-card-deck-library"]',
      );
      const started = performance.now();
      (card as HTMLButtonElement | null)?.click();
      while (
        location.pathname !== "/library" &&
        performance.now() - started < 2000
      ) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      return performance.now() - started;
    });

    expect(delay).toBeLessThan(220);
    await expect(page).toHaveURL(/\/library$/);
  });

  test("keeps Home focus and readability through portrait and landscape reflow", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByTestId("home-hologram-scene")).toBeVisible();
    await page.getByTestId("home-hologram-scene").focus();
    await page.keyboard.press("ArrowRight");

    const focusedBefore = await page
      .locator('.home-orbit-card[aria-current="true"]')
      .getAttribute("data-card-id");

    await page.setViewportSize({ width: 568, height: 320 });
    await expect(page.getByTestId("home-hologram-scene")).toBeVisible();
    await expect(page.locator('.home-orbit-card[aria-current="true"]'))
      .toHaveAttribute("data-card-id", focusedBefore ?? "");

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('.home-orbit-card[aria-current="true"]'))
      .toHaveAttribute("data-card-id", focusedBefore ?? "");
  });

  test("keeps Search typing immediate for fast input", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/search");
    const input = page.getByLabel("Search Scryfall cards");
    await input.type("blue black creatures under 3 mana", { delay: 1 });

    await expect(input).toHaveValue("blue black creatures under 3 mana");
  });
});
