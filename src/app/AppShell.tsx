import {
  lazy,
  Suspense,
  useCallback,
  useState,
  type CSSProperties,
} from "react";
import { NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AppIcon } from "../components/AppIcon";
import { HolographicPanel } from "../components/HolographicPanel";
import { permanentHomeRoutes } from "../data/routes";
import { getRecoverableScanBatch, updateScanBatch } from "../db/repositories";
import { FoundationScreen } from "../features/foundation/FoundationScreen";
import type { ScanBatch } from "../types/domain";
import { preloadAppRoute } from "./routePreloaders";
import { useSettings } from "./useSettings";

const HomeScreen = lazy(async () => ({
  default: (await import("../features/home/HomeScreen")).HomeScreen,
}));
const CreateDeckScreen = lazy(async () => ({
  default: (await import("../features/decks/CreateDeckScreen")).CreateDeckScreen,
}));
const DeckLibraryScreen = lazy(async () => ({
  default: (await import("../features/decks/DeckLibraryScreen")).DeckLibraryScreen,
}));
const CardSearchScreen = lazy(async () => ({
  default: (await import("../features/cards/CardSearchScreen")).CardSearchScreen,
}));
const CardDirectoriesScreen = lazy(async () => ({
  default: (await import("../features/directories/CardDirectoriesScreen")).CardDirectoriesScreen,
}));
const ScanCardsScreen = lazy(async () => ({
  default: (await import("../features/scanner/ScanCardsScreen")).ScanCardsScreen,
}));
const OwnedCardsScreen = lazy(async () => ({
  default: (await import("../features/owned/OwnedCardsScreen")).OwnedCardsScreen,
}));
const AnalyzerScreen = lazy(async () => ({
  default: (await import("../features/analyzer/AnalyzerScreen")).AnalyzerScreen,
}));
const SettingsScreen = lazy(async () => ({
  default: (await import("../features/settings/SettingsScreen")).SettingsScreen,
}));
const ExportScreen = lazy(async () => ({
  default: (await import("../features/export/ExportScreen")).ExportScreen,
}));
const DeckBuilderScreen = lazy(async () => ({
  default: (await import("../features/decks/DeckBuilderScreen")).DeckBuilderScreen,
}));

function RouteLoading() {
  return (
    <div className="route-loading-shell" role="status" aria-live="polite">
      Loading
    </div>
  );
}

export function AppShell() {
  const { settings } = useSettings();
  const location = useLocation();
  const navigate = useNavigate();
  const isHomeRoute = location.pathname === "/";
  const [protectedBatch, setProtectedBatch] = useState<ScanBatch | null>(null);
  const preloadRoute = useCallback((path: string) => preloadAppRoute(path), []);

  const textScale =
    settings.textSize === "large"
      ? 1.08
      : settings.textSize === "compact"
        ? 0.94
        : 1;

  return (
    <div
      className={`app-root${isHomeRoute ? " app-root--home" : ""}`}
      data-reduced-motion={settings.reducedMotion}
      data-static-home={settings.staticHomeScreen}
      data-high-contrast={settings.highContrast}
      style={
        {
          "--glow-strength": settings.glowIntensity,
          "--text-scale": textScale,
        } as CSSProperties
      }
    >
      <div className="cosmic-backdrop" aria-hidden="true">
        <span className="cosmic-backdrop__star cosmic-backdrop__star--one" />
        <span className="cosmic-backdrop__star cosmic-backdrop__star--two" />
        <span className="cosmic-backdrop__star cosmic-backdrop__star--three" />
      </div>

      <header className="app-topbar">
        <NavLink className="brand-mark" to="/" aria-label="Deck Nexus home">
          <span className="brand-mark__crystal" aria-hidden="true" />
          <span>
            <strong>Deck Nexus</strong>
            <small>Commander Hub</small>
          </span>
        </NavLink>
        {!isHomeRoute ? (
          <button
            type="button"
            className="app-home-button"
            aria-label="Return to Home"
            title="Home"
            onClick={() => {
              void (async () => {
                if (location.pathname.startsWith("/scan")) {
                  const batch = await getRecoverableScanBatch();
                  if (batch) {
                    setProtectedBatch(batch);
                    return;
                  }
                }
                navigate("/");
              })();
            }}
          >
            <AppIcon name="home" />
          </button>
        ) : null}
      </header>

      <main className="route-surface">
        <Suspense fallback={<RouteLoading />}>
          <Routes>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/create" element={<CreateDeckScreen />} />
            <Route path="/library" element={<DeckLibraryScreen />} />
            <Route path="/search" element={<CardSearchScreen />} />
            <Route path="/wishlist" element={<CardDirectoriesScreen kind="wishlist" />} />
            <Route path="/upgrade-lists" element={<CardDirectoriesScreen kind="upgradeLists" />} />
            <Route path="/collections" element={<CardDirectoriesScreen kind="collections" />} />
            <Route path="/scan" element={<ScanCardsScreen />} />
            <Route path="/owned" element={<OwnedCardsScreen />} />
            <Route
              path="/import"
              element={
                <FoundationScreen
                  title="Import Deck"
                  status="Unavailable"
                  summary="Deck import records are preserved locally, but full text-import UI is not active on this route yet. Use Search or Scanner to add cards without losing legacy import data."
                />
              }
            />
            <Route path="/analyzer" element={<AnalyzerScreen />} />
            <Route
              path="/groups"
              element={
                <FoundationScreen
                  title="Deck Groups"
                  status="Local"
                  summary="Deck group records are preserved locally for organization metadata. Current deck editing remains available through Library and Deck Builder."
                />
              }
            />
            <Route
              path="/tags"
              element={
                <FoundationScreen
                  title="Tags"
                  status="Local"
                  summary="Tag and category records are preserved locally for decks, cards, owned cards, and analysis metadata."
                />
              }
            />
            <Route
              path="/test"
              element={
                <FoundationScreen
                  title="Test Deck"
                  status="BoardState owned"
                  summary="Gameplay testing and Dry Run simulation belong to BoardState. Deck Nexus can prepare immutable snapshot exports without claiming a session has started."
                />
              }
            />
            <Route
              path="/export"
              element={<ExportScreen />}
            />
            <Route path="/settings" element={<SettingsScreen />} />
            <Route path="/deck-builder" element={<DeckBuilderScreen />} />
            <Route path="/deck-builder/:deckId" element={<DeckBuilderScreen />} />
          </Routes>
        </Suspense>
      </main>

      {!isHomeRoute ? (
        <nav className="bottom-command-bar" aria-label="Primary navigation">
          {permanentHomeRoutes.map((route) => (
            <NavLink
              className={({ isActive }) =>
                `bottom-command-bar__item${isActive ? " is-active" : ""}`
              }
              key={route.id}
              onFocus={() => preloadRoute(route.path)}
              onPointerEnter={() => preloadRoute(route.path)}
              to={route.path}
            >
              <AppIcon name={route.icon} />
              <span>{route.shortLabel}</span>
            </NavLink>
          ))}
        </nav>
      ) : null}

      {protectedBatch ? (
        <div className="builder-modal-backdrop" role="presentation">
          <HolographicPanel className="builder-modal builder-modal--compact" role="alertdialog" aria-modal="true">
            <div className="builder-modal__header">
              <h2>You have an unfinished scan batch.</h2>
              <button type="button" onClick={() => setProtectedBatch(null)} aria-label="Stay here">
                x
              </button>
            </div>
            <p className="foundation-summary">
              Scanner batches are preserved until applied, saved, or explicitly discarded.
            </p>
            <div className="form-actions">
              <button
                type="button"
                onClick={() => {
                  void updateScanBatch(protectedBatch.id, { status: "saved_for_later" }).then(() => {
                    setProtectedBatch(null);
                    navigate("/");
                  });
                }}
              >
                Save Batch and Go Home
              </button>
              <button
                type="button"
                onClick={() => {
                  const batchId = protectedBatch.id;
                  setProtectedBatch(null);
                  navigate(`/scan?batchId=${batchId}&review=1`);
                }}
              >
                Review Batch
              </button>
              <button type="button" onClick={() => setProtectedBatch(null)}>
                Continue Scanning
              </button>
            </div>
          </HolographicPanel>
        </div>
      ) : null}
    </div>
  );
}
