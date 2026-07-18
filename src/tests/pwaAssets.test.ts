import { describe, expect, it } from "vitest";
import indexHtml from "../../index.html?raw";
import manifestText from "../../public/manifest.webmanifest?raw";
import serviceWorker from "../../public/service-worker.js?raw";

describe("PWA shell assets", () => {
  it("ships a local manifest and production service worker without external endpoints", async () => {
    const manifest = JSON.parse(manifestText) as {
      name: string;
      start_url: string;
      scope: string;
      display: string;
      icons: { src: string }[];
    };

    expect(indexHtml).toContain('rel="manifest"');
    expect(manifest.name).toBe("Deck Nexus");
    expect(manifest.start_url).toBe(".");
    expect(manifest.scope).toBe(".");
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons[0].src).toBe("assets/deck-nexus-mark.svg");
    expect(serviceWorker).toContain("deck-nexus-shell-");
    expect(serviceWorker).toContain('request.mode === "navigate"');
    expect(serviceWorker.indexOf("fetch(request)")).toBeLessThan(
      serviceWorker.indexOf("caches.match(\"./index.html\")"),
    );
    expect(serviceWorker).not.toMatch(/localhost|example\.com|console\./i);
  });
});
