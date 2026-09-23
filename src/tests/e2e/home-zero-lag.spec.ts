import { expect, test } from "@playwright/test";

test.describe("Home zero-lag residency release gate", () => {
  test("keeps the latest interaction state without rebuilding cards or assets", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    const pageErrors: string[] = [];
    const staticAssetRequests: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("request", (request) => {
      if (
        request.url().includes("deck-nexus-home-reference") ||
        request.url().includes("deck-workspace-reference")
      ) {
        staticAssetRequests.push(request.url());
      }
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/?home-zero-lag=release-gate");
    const scene = page.getByTestId("home-hologram-scene");
    await expect(scene).toBeVisible();
    await expect(scene).toHaveAttribute("data-home-readiness", "ready");
    await expect(page.locator(".home-orbit-card")).toHaveCount(11);
    await page.waitForTimeout(1200);

    const before = await page.evaluate(() => {
      const cards = [...document.querySelectorAll<HTMLElement>(".home-orbit-card")];
      const image = document.querySelector<HTMLImageElement>(
        ".home-reference-layer",
      );
      const metrics = {
        childListMutations: 0,
        imageSourceMutations: 0,
        selectionMutations: 0,
        incompleteSamples: 0,
        incompleteVisualSamples: 0,
        longTasks: 0,
        maxLongTask: 0,
        rafCallbacks: 0,
        peakPendingRafs: 0,
      };
      const observer = new MutationObserver((records) => {
        metrics.childListMutations += records.filter(
          (record) => record.type === "childList",
        ).length;
        metrics.imageSourceMutations += records.filter(
          (record) =>
            record.type === "attributes" && record.attributeName === "src",
        ).length;
        metrics.selectionMutations += records.filter(
          (record) =>
            record.type === "attributes" &&
            (record.attributeName === "aria-current" ||
              record.attributeName === "data-focused"),
        ).length;
      });
      observer.observe(document.querySelector("[data-testid=orbit-layer-active]")!, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["src", "aria-current", "data-focused"],
      });
      const originalRequestAnimationFrame = window.requestAnimationFrame;
      const originalCancelAnimationFrame = window.cancelAnimationFrame;
      const pendingRafs = new Set<number>();
      window.requestAnimationFrame = (callback) => {
        let frameId = 0;
        frameId = originalRequestAnimationFrame((timestamp) => {
          pendingRafs.delete(frameId);
          metrics.rafCallbacks += 1;
          callback(timestamp);
        });
        pendingRafs.add(frameId);
        metrics.peakPendingRafs = Math.max(
          metrics.peakPendingRafs,
          pendingRafs.size,
        );
        return frameId;
      };
      window.cancelAnimationFrame = (frameId) => {
        pendingRafs.delete(frameId);
        originalCancelAnimationFrame(frameId);
      };
      const longTaskObserver =
        typeof PerformanceObserver === "undefined"
          ? null
          : new PerformanceObserver((list) => {
              for (const entry of list.getEntries()) {
                metrics.longTasks += 1;
                metrics.maxLongTask = Math.max(metrics.maxLongTask, entry.duration);
              }
            });
      longTaskObserver?.observe({ type: "longtask", buffered: false });
      (window as unknown as { __homeStress?: unknown }).__homeStress = {
        cards,
        imageSource: image?.src ?? "",
        imageReady: image?.dataset.imageReady ?? "false",
        metrics,
        observer,
        longTaskObserver,
        pendingRafs,
        originalRequestAnimationFrame,
        originalCancelAnimationFrame,
      };
      return {
        cardIds: cards.map((card) => card.dataset.cardId),
        imageSource: image?.src ?? "",
        imageReady: image?.dataset.imageReady ?? "false",
      };
    });

    staticAssetRequests.length = 0;
    await scene.evaluate(async (element) => {
      const target = element;
      const originalSetPointerCapture = target.setPointerCapture;
      const originalReleasePointerCapture = target.releasePointerCapture;
      target.setPointerCapture = () => undefined;
      target.releasePointerCapture = () => undefined;
      const centerX = target.clientWidth / 2;
      const centerY = target.clientHeight * 0.48;
      const dispatch = (
        type: "pointerdown" | "pointermove" | "pointerup",
        clientX: number,
        pointerId: number,
      ) => {
        target.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            clientX,
            clientY: centerY,
            pointerId,
            pointerType: "touch",
            isPrimary: true,
          }),
        );
      };

      const requiredSelectors = [
        ".home-orbit-card__surface",
        ".home-orbit-card__icon-shell",
        ".home-orbit-card__copy strong",
        ".home-orbit-card__copy small",
        ".home-orbit-card__action",
      ];
      const assertComplete = () => {
        const cards = [...document.querySelectorAll<HTMLElement>(".home-orbit-card")];
        const complete = cards.length === 11 && cards.every((card) =>
          card.dataset.staticReady === "true" &&
          requiredSelectors.every((selector) => card.querySelector(selector)),
        );
        const visuallyComplete = cards.every((card) => {
          const copy = card.querySelector<HTMLElement>(".home-orbit-card__copy");
          const action = card.querySelector<HTMLElement>(".home-orbit-card__action");
          if (!copy || !action) {
            return false;
          }
          const copyStyle = getComputedStyle(copy);
          const actionStyle = getComputedStyle(action);
          return copyStyle.display !== "none" && copyStyle.opacity !== "0" &&
            actionStyle.display !== "none" && actionStyle.opacity !== "0";
        });
        const stress = (window as unknown as {
          __homeStress?: {
            metrics: {
              incompleteSamples: number;
              incompleteVisualSamples: number;
            };
          };
        }).__homeStress;
        if (!complete && stress) {
          stress.metrics.incompleteSamples += 1;
        }
        if (!visuallyComplete && stress) {
          stress.metrics.incompleteVisualSamples += 1;
        }
        return complete && visuallyComplete;
      };

      if (!assertComplete()) {
        throw new Error("Home was revealed before every static card was complete");
      }

      for (let index = 0; index < 1000; index += 1) {
        const direction = index % 2 === 0 ? -1 : 1;
        const distance = 48 + (index % 5) * 18;
        const pointerId = index + 1;
        dispatch("pointerdown", centerX, pointerId);
        dispatch("pointermove", centerX + direction * distance, pointerId);
        if (index % 7 === 0) {
          dispatch(
            "pointermove",
            centerX - direction * distance * 0.6,
            pointerId,
          );
        }
        dispatch("pointerup", centerX + direction * distance, pointerId);
        if (!assertComplete()) {
          throw new Error(`Home card content became incomplete at interaction ${index}`);
        }
        if ((index + 1) % 2 === 0) {
          await new Promise<void>((resolve) => {
            window.requestAnimationFrame(() => resolve());
          });
        }
      }

      target.setPointerCapture = originalSetPointerCapture;
      target.releasePointerCapture = originalReleasePointerCapture;
    });

    await page.waitForTimeout(900);
    const after = await page.evaluate(() => {
      const state = (window as unknown as {
        __homeStress?: {
          cards: HTMLElement[];
          imageSource: string;
          imageReady: string;
          metrics: {
            childListMutations: number;
            imageSourceMutations: number;
            selectionMutations: number;
            incompleteSamples: number;
            incompleteVisualSamples: number;
            longTasks: number;
            maxLongTask: number;
            rafCallbacks: number;
            peakPendingRafs: number;
          };
          observer: MutationObserver;
          longTaskObserver: PerformanceObserver | null;
          pendingRafs: Set<number>;
          originalRequestAnimationFrame: typeof window.requestAnimationFrame;
          originalCancelAnimationFrame: typeof window.cancelAnimationFrame;
        };
      }).__homeStress;
      const cards = [...document.querySelectorAll<HTMLElement>(".home-orbit-card")];
      const image = document.querySelector<HTMLImageElement>(
        ".home-reference-layer",
      );
      state?.observer.disconnect();
      state?.longTaskObserver?.disconnect();
      if (state) {
        window.requestAnimationFrame = state.originalRequestAnimationFrame;
        window.cancelAnimationFrame = state.originalCancelAnimationFrame;
      }
      return {
        cardIds: cards.map((card) => card.dataset.cardId),
        stableElements: Boolean(
          state && cards.length === state.cards.length &&
            cards.every((card, index) => card === state.cards[index]),
        ),
        imageSource: image?.src ?? "",
        imageReady: image?.dataset.imageReady ?? "false",
        pendingRafs: state?.pendingRafs.size ?? -1,
        activeAnimations: document.getAnimations().length,
        metrics: state?.metrics ?? {
          childListMutations: -1,
          imageSourceMutations: -1,
          selectionMutations: -1,
          incompleteSamples: -1,
          incompleteVisualSamples: -1,
          longTasks: -1,
          maxLongTask: -1,
          rafCallbacks: -1,
          peakPendingRafs: -1,
        },
      };
    });

    expect(after.cardIds).toEqual(before.cardIds);
    expect(after.stableElements).toBe(true);
    expect(after.imageSource).toBe(before.imageSource);
    expect(after.imageReady).toBe("true");
    expect(after.metrics.childListMutations).toBe(0);
    expect(after.metrics.incompleteSamples).toBe(0);
    expect(after.metrics.incompleteVisualSamples).toBe(0);
    expect(after.metrics.imageSourceMutations).toBe(0);
    expect(after.metrics.selectionMutations).toBeLessThan(5000);
    expect(after.metrics.peakPendingRafs).toBeLessThan(8);
    expect(after.pendingRafs).toBeLessThan(8);
    expect(staticAssetRequests).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
