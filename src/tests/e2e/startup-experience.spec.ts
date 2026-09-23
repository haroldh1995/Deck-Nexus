import { expect, test } from "@playwright/test";

test.describe("truthful startup experience", () => {
  test("keeps Home behind the magical readiness barrier during a slow real-event simulation", async ({
    page,
  }) => {
    test.setTimeout(30_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/?startup-sim=slow");

    const loader = page.getByTestId("magical-startup");
    await expect(loader).toBeVisible();
    await expect(loader.locator(".magical-startup__status-copy strong")).toContainText(
      "AWAKENING THE NEXUS",
    );
    await expect(page.getByTestId("home-hologram-scene")).toHaveAttribute(
      "data-home-readiness",
      "preparing",
    );

    await expect(page.getByTestId("home-hologram-scene")).toHaveAttribute(
      "data-home-readiness",
      "ready",
      { timeout: 20_000 },
    );
    await expect(loader).toHaveCount(0);
    await expect(page.locator(".home-orbit-card")).toHaveCount(11);
    await expect(page.locator(".home-orbit-card").first().locator(".home-orbit-card__copy strong")).toBeVisible();
    await page.screenshot({ path: "output/playwright/startup-home-ready.png", fullPage: true });
  });
});
