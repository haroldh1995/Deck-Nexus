import {
  lazy,
  Suspense,
  useEffect,
  type CSSProperties,
} from "react";
import { NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AppIcon } from "../components/AppIcon";
import { FoundationScreen } from "../features/foundation/FoundationScreen";
import { useSettings } from "./useSettings";
import { MagicalStartupScreen } from "./startup/MagicalStartupScreen";
import {
  adaptStartupSnapshot,
} from "./startup/startupStatusAdapter";
import {
  startupCoordinator,
  useStartupSnapshot,
} from "./startup/startupCoordinator";
import {
  getStartupSimulationMode,
  simulateStartupTask,
} from "./startup/startupSimulation";
import { prepareHomeStaticAssets } from "../features/home/scene/homeReadiness";
import {
  hasResidentOwnedCards,
  hydrateResidentOwnedCards,
} from "../db/residentData";
import "../styles/startup.css";

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
const ImportDeckScreen = lazy(async () => ({
  default: (await import("../features/import/ImportDeckScreen")).ImportDeckScreen,
}));
const ImportCenterScreen = lazy(async () => ({
  default: (await import("../features/import/ImportCenterScreen")).ImportCenterScreen,
}));

function RouteLoading() {
  return (
    <div className="route-loading-shell" role="status" aria-live="polite">
      Loading
    </div>
  );
}

let launchedGeneration = 0;

function launchStartup(generation: number) {
  if (launchedGeneration === generation) {
    return;
  }
  launchedGeneration = generation;
  const simulationMode = getStartupSimulationMode();

  void startupCoordinator
    .runTask("app-core", async (reporter) => {
      reporter.started("hit");
      await simulateStartupTask("app-core", reporter, simulationMode);
    }, generation)
    .then(() => {
      const fonts = startupCoordinator.runTask(
        "fonts",
        async (reporter) => {
          const fontsAvailable =
            typeof document !== "undefined" && Boolean(document.fonts?.ready);
          reporter.started(fontsAvailable ? "miss" : "hit");
          if (typeof document !== "undefined" && document.fonts?.ready) {
            await document.fonts.ready;
          }
        },
        generation,
      );

      void fonts
        .then(() => startupCoordinator.runTask(
          "home-assets",
          async (reporter) => {
            reporter.started("miss");
            await simulateStartupTask("home-assets", reporter, simulationMode);
            await prepareHomeStaticAssets();
          },
          generation,
        ))
        .catch(() => undefined);

      void startupCoordinator.runTask(
        "optional-collection-hydration",
        async (reporter) => {
          reporter.started(hasResidentOwnedCards() ? "hit" : "miss");
          await hydrateResidentOwnedCards();
        },
        generation,
      ).catch(() => undefined);
    })
    .catch(() => undefined);
}

export function AppShell() {
  const { settings, loading: settingsLoading } = useSettings();
  const location = useLocation();
  const navigate = useNavigate();
  const startupSnapshot = useStartupSnapshot();
  const isHomeRoute = location.pathname === "/";

  useEffect(() => {
    const generation = startupCoordinator.ensureStarted();
    launchStartup(generation);
  }, []);

  useEffect(() => {
    const generation = startupCoordinator.ensureStarted();
    if (settingsLoading) {
      startupCoordinator.taskStarted("preferences", generation, "miss");
    } else {
      startupCoordinator.taskReady("preferences", generation, "hit");
    }
  }, [settingsLoading, startupSnapshot.generation]);

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
            onClick={() => navigate("/")}
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
            <Route path="/owned" element={<OwnedCardsScreen />} />
            <Route path="/import" element={<ImportCenterScreen />} />
            <Route path="/import/deck" element={<ImportDeckScreen />} />
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

      {isHomeRoute && !startupSnapshot.homeReady ? (
        <MagicalStartupScreen
          onRetry={() => {
            const generation = startupCoordinator.retry();
            launchStartup(generation);
          }}
          presentation={adaptStartupSnapshot(startupSnapshot)}
        />
      ) : null}

    </div>
  );
}
