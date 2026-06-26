import { expect, test } from "@playwright/test";

test.describe("Deck Nexus local-first flow", () => {
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
  });
});
