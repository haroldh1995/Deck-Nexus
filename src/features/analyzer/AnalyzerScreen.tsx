import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BarChart3, BrainCircuit, Clock3, History, Sparkles } from "lucide-react";
import { HolographicPanel } from "../../components/HolographicPanel";
import { PageHeader } from "../../components/PageHeader";
import { StatusPill } from "../../components/StatusPill";
import { useDecks, useOwnedCards } from "../../db/hooks";
import {
  addDeckCard,
  createBlankCommanderDeck,
  listDecisionEvents,
  listSmartBuildResults,
  moveDeckCard,
  recordDecisionEvent,
  saveAnalysisSnapshot,
  saveSmartBuildResult,
} from "../../db/repositories";
import type {
  DeckRecommendation,
  DecisionEvent,
  SmartBuildMode,
  SmartBuildResult,
} from "../../types/domain";
import { catalogCardToManualInput } from "../cards/cardSearch";
import { findCatalogCardByName } from "../../data/cardCatalog";
import { analyzeLiveBracket, formatBracket } from "../decks/bracketAnalysis";
import { getMainDeckCount } from "../decks/cardClassification";
import {
  analyzeDeck,
  createSmartBuildConfig,
  getDeckRecommendations,
  runSmartBuild,
} from "./deckAnalysis";

type AnalyzerTab =
  | "overview"
  | "legality"
  | "composition"
  | "curve"
  | "synergy"
  | "goals"
  | "bracket"
  | "ownership"
  | "recommendations"
  | "cuts"
  | "smart_build"
  | "timeline";

const analyzerTabs: { id: AnalyzerTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "legality", label: "Legality" },
  { id: "composition", label: "Deck Composition" },
  { id: "curve", label: "Mana Curve" },
  { id: "synergy", label: "Commander Synergy" },
  { id: "goals", label: "Goal Alignment" },
  { id: "bracket", label: "Bracket Lock" },
  { id: "ownership", label: "Ownership" },
  { id: "recommendations", label: "Recommendations" },
  { id: "cuts", label: "Cuts/Replacements" },
  { id: "smart_build", label: "Smart Build" },
  { id: "timeline", label: "Timeline" },
];

const recommendationTabs: { id: DeckRecommendation["tab"]; label: string }[] = [
  { id: "best_fits", label: "Best Fits" },
  { id: "owned_first", label: "Owned First" },
  { id: "role_fixes", label: "Role Fixes" },
  { id: "goal_support", label: "Goal Support" },
  { id: "goal_specific", label: "Commander Voltron / Goal-Specific" },
  { id: "mana_curve", label: "Mana Curve Fixes" },
  { id: "staples", label: "Staples" },
  { id: "replacements", label: "Replacements" },
  { id: "wild", label: "Wild Within-Color" },
];

const smartBuildModes: { id: SmartBuildMode; label: string }[] = [
  { id: "owned_only", label: "Owned Cards Only" },
  { id: "owned_first_missing_upgrades", label: "Owned First + Missing Upgrades" },
  { id: "ideal_goal_based", label: "Ideal Goal-Based Build" },
  { id: "bracket_locked", label: "Bracket-Locked Build" },
  { id: "rebuild_existing", label: "Rebuild Existing Deck" },
];

function tabFromParam(value: string | null): AnalyzerTab {
  if (value === "recommendations") return "recommendations";
  if (value === "smart-build" || value === "smart_build") return "smart_build";
  if (value === "bracket") return "bracket";
  return "overview";
}

export function AnalyzerScreen() {
  const [searchParams] = useSearchParams();
  const { decks } = useDecks();
  const { ownedCards } = useOwnedCards();
  const [deckId, setDeckId] = useState(searchParams.get("deckId") ?? "");
  const [activeTab, setActiveTab] = useState<AnalyzerTab>(tabFromParam(searchParams.get("tab")));
  const [recommendationTab, setRecommendationTab] = useState<DeckRecommendation["tab"]>("best_fits");
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [smartBuildMode, setSmartBuildMode] = useState<SmartBuildMode>("owned_first_missing_upgrades");
  const [smartBuildResult, setSmartBuildResult] = useState<SmartBuildResult | null>(null);
  const [smartBuildHistory, setSmartBuildHistory] = useState<SmartBuildResult[]>([]);
  const [timeline, setTimeline] = useState<DecisionEvent[]>([]);
  const [message, setMessage] = useState("Analyzer is local-first and keeps ownership separate from legality.");
  const deck = decks.find((candidate) => candidate.id === deckId) ?? decks[0];
  const analysis = useMemo(
    () => (deck ? analyzeDeck(deck, ownedCards) : null),
    [deck, ownedCards],
  );
  const bracket = useMemo(() => (deck ? analyzeLiveBracket(deck) : null), [deck]);
  const recommendations = useMemo(
    () =>
      deck
        ? getDeckRecommendations({
            deck,
            ownedCards,
            tab: recommendationTab,
            ownedOnly,
          })
        : [],
    [deck, ownedCards, ownedOnly, recommendationTab],
  );

  useEffect(() => {
    if (!deck) {
      return;
    }

    void listSmartBuildResults(deck.id).then(setSmartBuildHistory);
    void listDecisionEvents(deck.id).then(setTimeline);
  }, [deck]);

  async function saveAnalysis() {
    if (!analysis) {
      return;
    }

    await saveAnalysisSnapshot(analysis);
    setMessage("Analysis snapshot saved locally.");
  }

  async function addRecommendation(recommendation: DeckRecommendation, destination: "main" | "maybeboard") {
    if (!deck) {
      return;
    }

    const catalogCard = findCatalogCardByName(recommendation.name);
    if (!catalogCard) {
      setMessage("Recommendation card is not in the local cache.");
      return;
    }

    await addDeckCard(
      deck.id,
      catalogCardToManualInput({
        card: catalogCard,
        ownedQuantity: recommendation.ownedQuantity,
        destination,
      }),
      destination,
    );
    setMessage(`${recommendation.name} ${destination === "main" ? "added to Main Deck" : "sent to Maybeboard"}.`);
  }

  async function generateSmartBuild() {
    if (!deck) {
      return;
    }

    const config = createSmartBuildConfig({ deck, mode: smartBuildMode, ownedCards });
    const result = runSmartBuild({ deck, config, ownedCards });
    await saveSmartBuildResult(result);
    setSmartBuildResult(result);
    setSmartBuildHistory(await listSmartBuildResults(deck.id));
    setMessage("Smart Build review generated. Nothing has been overwritten.");
  }

  async function applySmartBuild(destination: "main" | "maybeboard") {
    if (!deck || !smartBuildResult?.proposedCards) {
      return;
    }

    for (const smartCard of smartBuildResult.proposedCards) {
      const catalogCard = findCatalogCardByName(smartCard.name);
      if (!catalogCard) {
        continue;
      }

      await addDeckCard(
        deck.id,
        catalogCardToManualInput({
          card: catalogCard,
          ownedQuantity: smartCard.ownedQuantity,
          destination,
        }),
        destination,
      );
    }

    await saveSmartBuildResult({
      ...smartBuildResult,
      applied: true,
      summary: `Applied to ${destination} after review.`,
    });
    await recordDecisionEvent({
      deckId: deck.id,
      type: "smart_build_applied",
      message: `Smart Build applied to ${destination}.`,
      payload: {
        beforeCount: getMainDeckCount(deck.cards),
        proposedCards: smartBuildResult.proposedCards.map((card) => card.name),
        destination,
      },
    });
    setTimeline(await listDecisionEvents(deck.id));
    setMessage(`Smart Build applied to ${destination} after review.`);
  }

  async function saveSmartBuildAsNewDeck() {
    if (!deck || !smartBuildResult?.proposedCards) {
      return;
    }

    const nextDeck = await createBlankCommanderDeck({
      name: `${deck.name} Smart Build`,
      commanderName: deck.commanderNames.join(" / "),
      bracketLock: deck.bracketLock,
      ownershipPreference: deck.ownershipPreference,
      goals: deck.goals.map((goal) => goal.name),
    });

    for (const smartCard of smartBuildResult.proposedCards) {
      const catalogCard = findCatalogCardByName(smartCard.name);
      if (catalogCard) {
        await addDeckCard(
          nextDeck.id,
          catalogCardToManualInput({
            card: catalogCard,
            ownedQuantity: smartCard.ownedQuantity,
            destination: "main",
          }),
          "main",
        );
      }
    }

    await recordDecisionEvent({
      deckId: nextDeck.id,
      type: "smart_build_saved_as_new_deck",
      message: "Smart Build saved as a new deck without altering the original.",
      payload: { sourceDeckId: deck.id },
    });
    setMessage(`${nextDeck.name} saved locally without altering ${deck.name}.`);
  }

  async function moveMaybeboardCard(cardId: string) {
    if (!deck) {
      return;
    }

    await moveDeckCard(deck.id, cardId, "main");
    setMessage("Maybeboard card restored to Main through local rules flow.");
  }

  async function restoreCut(cardId: string) {
    if (!deck) {
      return;
    }

    await moveDeckCard(deck.id, cardId, "main");
    setMessage("Cut card restored to Main.");
  }

  return (
    <section className="screen feature-screen analyzer-screen">
      <PageHeader title="Analyzer">
        <StatusPill tone={analysis?.health === "Illegal" ? "violet" : "cyan"}>
          {analysis?.health ?? "No Deck"}
        </StatusPill>
      </PageHeader>

      <HolographicPanel className="feature-toolbar analyzer-toolbar">
        <label>
          Active deck
          <select value={deck?.id ?? ""} onChange={(event) => setDeckId(event.target.value)}>
            {decks.length === 0 ? <option value="">No decks saved</option> : null}
            {decks.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </select>
        </label>
        <div className="feature-status" role="status">
          <BarChart3 aria-hidden="true" />
          <span>{message}</span>
        </div>
        <button type="button" onClick={saveAnalysis} disabled={!analysis}>
          Save Analysis Snapshot
        </button>
      </HolographicPanel>

      <div className="feature-tabs" role="tablist" aria-label="Analyzer tabs">
        {analyzerTabs.map((tab) => (
          <button
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? "is-active" : ""}
            key={tab.id}
            role="tab"
            type="button"
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {!deck || !analysis ? (
        <HolographicPanel className="feature-empty">
          <Sparkles aria-hidden="true" />
          <strong>No Commander deck selected</strong>
          <span>Create or import a deck before running full analysis.</span>
        </HolographicPanel>
      ) : null}

      {deck && analysis && activeTab === "overview" ? (
        <div className="analysis-grid">
          <HolographicPanel>
            <h2>Health</h2>
            <strong className="feature-metric">{analysis.health}</strong>
            {analysis.notes.map((note) => (
              <p key={note}>{note}</p>
            ))}
          </HolographicPanel>
          <HolographicPanel>
            <h2>Commander Count</h2>
            <strong className="feature-metric">{analysis.cardCount} / 100</strong>
            <p>Commander zone and Main Deck count. Maybeboard, Cuts, and Extras are excluded.</p>
          </HolographicPanel>
          <HolographicPanel>
            <h2>Bracket</h2>
            <strong className="feature-metric">{bracket ? formatBracket(bracket.estimatedBracket) : "Unknown"}</strong>
            <p>Selected lock: {bracket ? formatBracket(bracket.selectedBracket) : "None"}</p>
            <p>Confidence: {bracket?.confidence ?? "Low"}</p>
          </HolographicPanel>
          <HolographicPanel>
            <h2>Ownership</h2>
            <strong className="feature-metric">{analysis.ownership?.missingCount ?? 0} missing</strong>
            <p>Ownership is planning-only and separate from legality.</p>
          </HolographicPanel>
        </div>
      ) : null}

      {deck && analysis && ["legality", "composition", "curve", "synergy", "goals", "bracket", "ownership"].includes(activeTab) ? (
        <HolographicPanel className="analysis-detail-panel">
          <h2>{analyzerTabs.find((tab) => tab.id === activeTab)?.label}</h2>
          {activeTab === "legality" ? (
            analysis.legalityIssues?.length ? (
              analysis.legalityIssues.map((issue) => (
                <article className="analysis-issue" key={issue.id}>
                  <strong>{issue.title}</strong>
                  <p>{issue.detail}</p>
                  <small>{issue.action}</small>
                </article>
              ))
            ) : (
              <p>No legality issues detected by the local soft rules engine.</p>
            )
          ) : null}
          {activeTab === "composition" ? (
            <div className="analysis-bars">
              {Object.entries(analysis.categoryCounts).map(([section, count]) => (
                <span key={section}>
                  <strong>{section}</strong> {count}
                </span>
              ))}
            </div>
          ) : null}
          {activeTab === "curve" ? (
            <div className="analysis-bars">
              <p>Average mana value: {analysis.manaCurve?.averageManaValue ?? 0}</p>
              {Object.entries(analysis.manaCurve?.buckets ?? {}).map(([bucket, count]) => (
                <span key={bucket}>
                  <strong>{bucket}</strong> {count}
                </span>
              ))}
            </div>
          ) : null}
          {activeTab === "synergy" || activeTab === "goals" ? (
            <div className="analysis-bars">
              {deck.goals.length === 0 ? <p>No explicit deck goals saved yet.</p> : null}
              {deck.goals.map((goal) => (
                <span key={goal.id}>
                  <strong>{goal.name}</strong> priority {goal.priority}
                </span>
              ))}
              <p>Recommendation and Smart Build outputs explain card-level goal fit.</p>
            </div>
          ) : null}
          {activeTab === "bracket" && bracket ? (
            <div className="analysis-bars">
              {bracket.factors.map((factor) => (
                <span key={factor.label}>
                  <strong>{factor.label}</strong> {factor.count} · impact {factor.impact.toFixed(2)}
                </span>
              ))}
            </div>
          ) : null}
          {activeTab === "ownership" ? (
            <div className="analysis-bars">
              <span><strong>Owned</strong> {analysis.ownership?.ownedCount ?? 0}</span>
              <span><strong>Missing/not confirmed owned</strong> {analysis.ownership?.missingCount ?? 0}</span>
              <span><strong>Duplicate/share warnings</strong> {analysis.ownership?.duplicateWarnings ?? 0}</span>
            </div>
          ) : null}
        </HolographicPanel>
      ) : null}

      {deck && activeTab === "recommendations" ? (
        <HolographicPanel className="recommend-panel">
          <div className="feature-toolbar">
            <label>
              Recommendation tab
              <select
                value={recommendationTab}
                onChange={(event) => setRecommendationTab(event.target.value as DeckRecommendation["tab"])}
              >
                {recommendationTabs.map((tab) => (
                  <option key={tab.id} value={tab.id}>
                    {tab.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <input checked={ownedOnly} type="checkbox" onChange={(event) => setOwnedOnly(event.target.checked)} />
              Owned only
            </label>
          </div>
          <div className="recommendation-list">
            {recommendations.length === 0 ? (
              <p>No within-color recommendations match these filters.</p>
            ) : (
              recommendations.map((recommendation) => (
                <article className="recommendation-card" key={recommendation.id}>
                  <div>
                    <h2>{recommendation.name}</h2>
                    <p>{recommendation.typeLine} · {recommendation.manaCost ?? "No mana cost"}</p>
                    <small>{recommendation.reason}</small>
                    <div className="badge-row">
                      {recommendation.roleTags.map((role) => <span className="badge" key={role}>{role}</span>)}
                      <span className="badge">{recommendation.ownedQuantity} owned</span>
                      <span className="badge">{recommendation.bracketFit}</span>
                    </div>
                  </div>
                  <div className="result-actions">
                    <button type="button" onClick={() => addRecommendation(recommendation, "main")}>
                      Add to Main
                    </button>
                    <button type="button" onClick={() => addRecommendation(recommendation, "maybeboard")}>
                      Send to Maybeboard
                    </button>
                    <button type="button" onClick={() => setMessage(`Find Similar foundation opened for ${recommendation.name}.`)}>
                      Find Similar
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </HolographicPanel>
      ) : null}

      {deck && activeTab === "smart_build" ? (
        <HolographicPanel className="smart-build-panel">
          <div className="feature-toolbar">
            <label>
              Build Mode
              <select value={smartBuildMode} onChange={(event) => setSmartBuildMode(event.target.value as SmartBuildMode)}>
                {smartBuildModes.map((mode) => (
                  <option key={mode.id} value={mode.id}>{mode.label}</option>
                ))}
              </select>
            </label>
            <button type="button" onClick={generateSmartBuild}>
              <BrainCircuit aria-hidden="true" /> Generate Smart Build Review
            </button>
          </div>
          <div className="smart-build-setup">
            <span>Commander Zone: {deck.commanderNames.join(" / ") || "Not set"}</span>
            <span>Color Identity: {deck.colorIdentity.join(" ") || "Colorless / Unknown"}</span>
            <span>Bracket Lock: {deck.bracketLock.enabled ? formatBracket(deck.bracketLock.bracket) : "Unlocked"}</span>
            <span>Ownership Preference: {deck.ownershipPreference}</span>
            <span>Protected Cards: {deck.cards.filter((card) => card.protected).length}</span>
          </div>
          {smartBuildResult ? (
            <div className="smart-build-review">
              <h2>Build Summary</h2>
              <p>{smartBuildResult.summary}</p>
              <div className="analysis-grid">
                <HolographicPanel variant="quiet"><strong>{smartBuildResult.proposedCards?.length ?? 0}</strong><span>Cards Added</span></HolographicPanel>
                <HolographicPanel variant="quiet"><strong>{smartBuildResult.cutCards?.length ?? 0}</strong><span>Cards Cut</span></HolographicPanel>
                <HolographicPanel variant="quiet"><strong>{smartBuildResult.keptCards?.length ?? 0}</strong><span>Cards Kept</span></HolographicPanel>
                <HolographicPanel variant="quiet"><strong>{smartBuildResult.missingCards?.length ?? 0}</strong><span>Cards Missing</span></HolographicPanel>
              </div>
              <div className="recommendation-list">
                {smartBuildResult.proposedCards?.map((card) => (
                  <article className="recommendation-card" key={card.id}>
                    <div>
                      <h2>{card.name}</h2>
                      <p>{card.typeLine} · {card.manaCost ?? "No mana cost"}</p>
                      <small>{card.reason}</small>
                      <div className="badge-row">
                        <span className="badge">{card.ownedQuantity} owned</span>
                        <span className="badge">{card.bracketFit}</span>
                        {card.goalMatches.map((goal) => <span className="badge" key={goal}>{goal}</span>)}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => applySmartBuild("main")}>Apply Build</button>
                <button type="button" onClick={saveSmartBuildAsNewDeck}>Save as New Deck</button>
                <button type="button" onClick={() => applySmartBuild("maybeboard")}>Send Suggestions to Maybeboard</button>
                <button type="button" onClick={() => setMessage("Card-by-card review is represented by the proposal list above.")}>Review Card by Card</button>
                <button type="button" onClick={() => setSmartBuildResult(null)}>Cancel</button>
              </div>
            </div>
          ) : null}
          <div className="smart-build-history">
            <h2>Version History</h2>
            {smartBuildHistory.length === 0 ? <p>No Smart Build versions saved yet.</p> : null}
            {smartBuildHistory.map((result) => (
              <span key={result.id}>
                <History aria-hidden="true" /> {result.mode ?? "smart_build"} · {new Date(result.createdAt).toLocaleString()} · {result.applied ? "Applied" : "Review"}
              </span>
            ))}
          </div>
        </HolographicPanel>
      ) : null}

      {deck && activeTab === "cuts" ? (
        <HolographicPanel className="archive-panel">
          <h2>Maybeboard</h2>
          {deck.maybeboard.length === 0 ? <p>No maybeboard cards saved.</p> : null}
          {deck.maybeboard.map((card) => (
            <article className="scanner-record" key={card.id}>
              <div>
                <strong>{card.name}</strong>
                <span>{card.typeLine ?? "Type pending"} · {card.missingQuantity > 0 ? "Missing/not confirmed owned" : "Owned"}</span>
              </div>
              <button type="button" onClick={() => moveMaybeboardCard(card.id)}>Move to Main Deck</button>
              <button type="button" onClick={() => moveDeckCard(deck.id, card.id, "cuts", "Manual cut")}>Move to Cuts</button>
            </article>
          ))}
          <h2>Cuts</h2>
          {deck.cuts.length === 0 ? <p>No cuts saved.</p> : null}
          {deck.cuts.map((card) => (
            <article className="scanner-record" key={card.id}>
              <div>
                <strong>{card.name}</strong>
                <span>{card.cutReason || "No cut reason"} · previous section retained in local card history</span>
              </div>
              <button type="button" onClick={() => restoreCut(card.id)}>Restore to Main Deck</button>
              <button type="button" onClick={() => moveDeckCard(deck.id, card.id, "maybeboard")}>Move to Maybeboard</button>
            </article>
          ))}
        </HolographicPanel>
      ) : null}

      {deck && activeTab === "timeline" ? (
        <HolographicPanel className="timeline-panel">
          <h2>Decision Timeline</h2>
          {timeline.length === 0 ? <p>No local decision events for this deck yet.</p> : null}
          {timeline.map((event) => (
            <article className="timeline-event" key={event.id}>
              <Clock3 aria-hidden="true" />
              <div>
                <strong>{event.message}</strong>
                <span>{event.type} · {new Date(event.createdAt).toLocaleString()}</span>
              </div>
            </article>
          ))}
        </HolographicPanel>
      ) : null}
    </section>
  );
}
