import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import "./styles/global.css";
import "./styles/featureScreens.css";

declare global {
  interface Window {
    __DECK_NEXUS_BOOTSTRAPPED__?: boolean;
  }
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Deck Nexus root element was not found.");
}

if (!window.__DECK_NEXUS_BOOTSTRAPPED__) {
  window.__DECK_NEXUS_BOOTSTRAPPED__ = true;

  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );

  if ("serviceWorker" in navigator && import.meta.env.PROD) {
    window.addEventListener("load", () => {
      void navigator.serviceWorker.register(
        `${import.meta.env.BASE_URL}service-worker.js`,
      ).catch(() => undefined);
    });
  }
}
