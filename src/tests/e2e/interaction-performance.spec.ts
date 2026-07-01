import { expect, test } from "@playwright/test";

test.describe("interaction performance and responsive motion", () => {
  test("moves the Home orbit continuously during drag without page overflow", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByTestId("home-hologram-scene")).toBeVisible();

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
