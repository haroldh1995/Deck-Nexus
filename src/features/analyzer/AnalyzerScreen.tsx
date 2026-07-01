import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BarChart3, BrainCircuit, Clock3, History, Sparkles } from "lucide-react";
import { HolographicPanel } from "../../components/HolographicPanel";
import { PageHeader } from "../../components/PageHeader";
import { StatusPill } from "../../components/StatusPill";
import { useDecks, useOwnedCards } from "../../db/hooks";
import {
  addDeckCard,
  createBlankCommanderDeck,
  createUpgradeListFromSmartBuildResult,
  listDeckVersions,
  listDecisionEvents,
  listRecommendationFeedback,
  listReplacementRecords,
  listSmartBuildResults,
  moveDeckCard,
  recordDecisionEvent,
  removeDeckCard,
  replaceDeckCard,
  restoreDeckVersion,
  saveAnalysisSnapshot,
  saveDeckVersionFromDecks,
  saveRecommendationFeedback,
  saveReplacementRecord,
  saveSmartBuildResult,
  updateDeckCard,
} from "../../db/repositories";
import type {
  CutReason,
  DeckRecommendation,
  DeckVersion,
  DecisionEvent,
  OwnershipPreference,
  RecommendationFeedback,
  ReplacementRecord,
  SmartBuildMode,
  SmartBuildOutputPreference,
  SmartBuildResult,
} from "../../types/domain";
import { catalogCardToManualInput } from "../cards/cardSearch";
import { findCatalogCardByName } from "../../data/cardCatalog";
import { analyzeLiveBracket, formatBracket } from "../decks/bracketAnalysis";
import { getMainDeckCount } from "../decks/cardClassification";
import {
  analyzeDeck,
  createSmartBuildConfig,
  estimateManaValue,
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

const outputPreferences: { id: SmartBuildOutputPreference; label: string }[] = [
  { id: "apply_after_review", label: "Apply to Current Deck After Review" },
  { id: "save_as_new_deck", label: "Save as New Deck" },
  { id: "send_to_maybeboard", label: "Send Suggestions to Maybeboard" },
  { id: "upgrade_list_only", label: "Create Upgrade List Only" },
];

const ownershipPreferences: { id: OwnershipPreference; label: string }[] = [
  { id: "owned_only", label: "Owned Cards Only" },
  { id: "owned_first", label: "Owned First" },
  { id: "allow_missing", label: "Allow Missing Cards" },
];

const existingDeckBehaviors = [
  { id: "keep_everything_fill", label: "Keep everything and fill missing slots" },
  { id: "keep_protected_only", label: "Keep protected cards only" },
  { id: "keep_commander_goals_only", label: "Keep commander and goals only" },
  { id: "suggest_only", label: "Suggest changes without applying" },
  { id: "create_new_version", label: "Create new deck version" },
] as const;

const cutReasons: CutReason[] = [
  "Too high mana value",
  "Low synergy",
  "Off-theme",
  "Role overlap",
  "Above Bracket Lock",
  "Not owned",
  "Better replacement found",
  "Too many of this role",
  "Mana curve issue",
  "Commander color issue",
  "Testing cut",
  "Manual cut",
  "Other",
];

const timelineFilters = [
  { id: "all", label: "All" },
  { id: "adds", label: "Adds" },
  { id: "cuts", label: "Cuts" },
  { id: "replacements", label: "Replacements" },
  { id: "smart_build", label: "Smart Build" },
  { id: "imports", label: "Imports" },
  { id: "scanner", label: "Scanner" },
  { id: "ownership", label: "Ownership" },
  { id: "bracket", label: "Bracket changes" },
  { id: "goals", label: "Goal changes" },
] as const;

function tabFromParam(value: string | null): AnalyzerTab {
  if (value === "recommendations") return "recommendations";
  if (value === "smart-build" || value === "smart_build") return "smart_build";
  if (value === "bracket") return "bracket";
  return "overview";
}

function normalized(value: string): string {
  return value.trim().toLowerCase();
}

function parseCommaList(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function timelineMatchesFilter(
  event: DecisionEvent,
  filter: (typeof timelineFilters)[number]["id"],
): boolean {
  if (filter === "all") return true;
  if (filter === "adds") return event.type.includes("added");
  if (filter === "cuts") return event.type.includes("cut") || event.message.toLowerCase().includes("cuts");
  if (filter === "replacements") return event.type.includes("replace") || event.type.includes("replacement");
  if (filter === "smart_build") return event.type.includes("smart_build");
  if (filter === "imports") return event.type.includes("import");
  if (filter === "scanner") return event.type.includes("scan") || event.type.includes("batch");
  if (filter === "ownership") return event.type.includes("owned") || event.type.includes("ownership");
  if (filter === "bracket") return event.type.includes("bracket");
  if (filter === "goals") return event.type.includes("goal");
  return true;
}

export function AnalyzerScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { decks } = useDecks();
  const { ownedCards } = useOwnedCards();
  const [deckId, setDeckId] = useState(searchParams.get("deckId") ?? "");
  const [activeTab, setActiveTab] = useState<AnalyzerTab>(tabFromParam(searchParams.get("tab")));
  const [recommendationTab, setRecommendationTab] = useState<DeckRecommendation["tab"]>("best_fits");
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [notOwnedOnly, setNotOwnedOnly] = useState(false);
  const [legalOnly, setLegalOnly] = useState(true);
  const [inBracketOnly, setInBracketOnly] = useState(true);
  const [roleFilter, setRoleFilter] = useState("");
  const [manaValueFilter, setManaValueFilter] = useState("");
  const [cardTypeFilter, setCardTypeFilter] = useState("");
  const [goalFilter, setGoalFilter] = useState("");
  const [commanderSynergyOnly, setCommanderSynergyOnly] = useState(false);
  const [notAlreadyInDeck, setNotAlreadyInDeck] = useState(true);
  const [notInMaybeboard, setNotInMaybeboard] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [smartBuildMode, setSmartBuildMode] = useState<SmartBuildMode>("owned_first_missing_upgrades");
  const [outputPreference, setOutputPreference] = useState<SmartBuildOutputPreference>("apply_after_review");
  const [ownershipPreference, setOwnershipPreference] = useState<OwnershipPreference>("owned_first");
  const [useCurrentDeckAsCore, setUseCurrentDeckAsCore] = useState(true);
  const [manaCurveGoal, setManaCurveGoal] = useState("Balanced Commander curve");
  const [doNotSuggestText, setDoNotSuggestText] = useState("");
  const [existingDeckBehavior, setExistingDeckBehavior] =
    useState<(typeof existingDeckBehaviors)[number]["id"]>("keep_everything_fill");
  const [cardReviewMode, setCardReviewMode] = useState(false);
  const [excludedSmartCardIds, setExcludedSmartCardIds] = useState<string[]>([]);
  const [smartBuildResult, setSmartBuildResult] = useState<SmartBuildResult | null>(null);
  const [smartBuildHistory, setSmartBuildHistory] = useState<SmartBuildResult[]>([]);
  const [deckVersions, setDeckVersions] = useState<DeckVersion[]>([]);
  const [recommendationFeedback, setRecommendationFeedback] = useState<RecommendationFeedback[]>([]);
  const [replacementRecords, setReplacementRecords] = useState<ReplacementRecord[]>([]);
  const [timeline, setTimeline] = useState<DecisionEvent[]>([]);
  const [timelineFilter, setTimelineFilter] = useState<(typeof timelineFilters)[number]["id"]>("all");
  const [cutReasonDrafts, setCutReasonDrafts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("Analyzer is local-first and keeps ownership separate from legality.");
  const deck = decks.find((candidate) => candidate.id === deckId) ?? decks[0];
  const analysis = useMemo(
    () => (deck ? analyzeDeck(deck, ownedCards) : null),
    [deck, ownedCards],
  );
  const bracket = useMemo(() => (deck ? analyzeLiveBracket(deck) : null), [deck]);
  const doNotSuggest = useMemo(() => {
    const typed = parseCommaList(doNotSuggestText);
    const persisted = recommendationFeedback
      .filter((feedback) => feedback.type === "never_suggest_card")
      .map((feedback) => feedback.oracleId)
      .filter(Boolean) as string[];
    return [...typed, ...persisted];
  }, [doNotSuggestText, recommendationFeedback]);
  const allRecommendations = useMemo(
    () =>
      deck
        ? getDeckRecommendations({
            deck,
            ownedCards,
            tab: recommendationTab,
            ownedOnly: false,
            doNotSuggest,
          })
        : [],
    [deck, doNotSuggest, ownedCards, recommendationTab],
  );
  const favoriteOracleIds = useMemo(
    () =>
      new Set(
        recommendationFeedback
          .filter((feedback) => feedback.type === "favorite")
          .map((feedback) => feedback.oracleId)
          .filter(Boolean),
      ),
    [recommendationFeedback],
  );
  const recommendations = useMemo(() => {
    const deckNames = new Set(deck?.cards.map((card) => normalized(card.name)) ?? []);
    const maybeboardNames = new Set(deck?.maybeboard.map((card) => normalized(card.name)) ?? []);
    return allRecommendations.filter((recommendation) => {
      if (ownedOnly && recommendation.ownedQuantity <= 0) return false;
      if (notOwnedOnly && recommendation.ownedQuantity > 0) return false;
      if (legalOnly && recommendation.colorIdentity.some((color) => !deck?.colorIdentity.includes(color))) {
        return false;
      }
      if (inBracketOnly && recommendation.bracketFit.includes("Review")) return false;
      if (roleFilter && !recommendation.roleTags.some((role) => normalized(role).includes(normalized(roleFilter)))) {
        return false;
      }
      if (manaValueFilter && estimateManaValue(recommendation.manaCost) > Number(manaValueFilter)) {
        return false;
      }
      if (cardTypeFilter && !normalized(recommendation.typeLine).includes(normalized(cardTypeFilter))) {
        return false;
      }
      if (goalFilter && !recommendation.goalMatches.some((goal) => normalized(goal).includes(normalized(goalFilter)))) {
        return false;
      }
      if (commanderSynergyOnly && !recommendation.reason.toLowerCase().includes("commander")) {
        return false;
      }
      if (notAlreadyInDeck && deckNames.has(normalized(recommendation.name))) return false;
      if (notInMaybeboard && maybeboardNames.has(normalized(recommendation.name))) return false;
      if (favoritesOnly && !favoriteOracleIds.has(recommendation.oracleId)) return false;
      return true;
    });
  }, [
    allRecommendations,
    cardTypeFilter,
    commanderSynergyOnly,
    deck,
    favoriteOracleIds,
    favoritesOnly,
    goalFilter,
    inBracketOnly,
    legalOnly,
    manaValueFilter,
    notAlreadyInDeck,
    notInMaybeboard,
    notOwnedOnly,
    ownedOnly,
    roleFilter,
  ]);

  useEffect(() => {
    if (!deck) {
      return;
    }

    void listSmartBuildResults(deck.id).then(setSmartBuildHistory);
    void listDeckVersions(deck.id).then(setDeckVersions);
    void listRecommendationFeedback(deck.id).then(setRecommendationFeedback);
    void listReplacementRecords(deck.id).then(setReplacementRecords);
    void listDecisionEvents(deck.id).then(setTimeline);
  }, [deck]);

  async function saveAnalysis() {
    if (!analysis) {
      return;
    }

    await saveAnalysisSnapshot(analysis);
    setMessage("Analysis snapshot saved locally.");
  }

  async function refreshDeckArtifacts(activeDeckId: string) {
    const [history, versions, feedback, replacements, events] = await Promise.all([
      listSmartBuildResults(activeDeckId),
      listDeckVersions(activeDeckId),
      listRecommendationFeedback(activeDeckId),
      listReplacementRecords(activeDeckId),
      listDecisionEvents(activeDeckId),
    ]);
    setSmartBuildHistory(history);
    setDeckVersions(versions);
    setRecommendationFeedback(feedback);
    setReplacementRecords(replacements);
    setTimeline(events);
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
      {
        ...catalogCardToManualInput({
          card: catalogCard,
          ownedQuantity: recommendation.ownedQuantity,
          destination,
        }),
        notes: `Source: Recommend. ${recommendation.reason}`,
      },
      destination,
    );
    await recordDecisionEvent({
      deckId: deck.id,
      type: destination === "maybeboard" ? "card_moved_to_maybeboard" : "card_added",
      message: `${recommendation.name} added from Recommend Panel.`,
      payload: {
        source: "Recommend",
        destination,
        oracleId: recommendation.oracleId,
        reason: recommendation.reason,
      },
    });
    await refreshDeckArtifacts(deck.id);
    setMessage(`${recommendation.name} ${destination === "main" ? "added to Main Deck" : "sent to Maybeboard"}.`);
  }

  async function replaceWithRecommendation(recommendation: DeckRecommendation) {
    if (!deck) {
      return;
    }

    const replacementTarget =
      deck.cards.find((card) =>
        card.section === "main" &&
        !card.protected &&
        card.roleTags.some((role) => recommendation.roleTags.includes(role)),
      ) ??
      deck.cards.find((card) => card.section === "main" && !card.protected);
    const catalogCard = findCatalogCardByName(recommendation.name);

    if (!replacementTarget || !catalogCard) {
      setMessage("No unprotected Main Deck replacement target is available.");
      return;
    }

    const nextDeck = await replaceDeckCard(
      deck.id,
      replacementTarget.id,
      {
        ...catalogCardToManualInput({
          card: catalogCard,
          ownedQuantity: recommendation.ownedQuantity,
          destination: "main",
        }),
        notes: `Replacement from Recommend Panel. ${recommendation.reason}`,
      },
    );
    const newCard = nextDeck.cards.find((card) => card.name === recommendation.name);
    if (newCard) {
      await saveReplacementRecord({
        deckId: deck.id,
        removedCardId: replacementTarget.id,
        replacementCardId: newCard.id,
        reason: recommendation.reason,
      });
    }
    await refreshDeckArtifacts(deck.id);
    setMessage(`${replacementTarget.name} replaced with ${recommendation.name} after review.`);
  }

  async function recordRecommendationFeedback(
    recommendation: DeckRecommendation,
    type: RecommendationFeedback["type"],
  ) {
    setMessage(`${recommendation.name} marked as ${type.replace(/_/g, " ")}.`);
    await saveRecommendationFeedback({
      deckId: recommendation.deckId ?? deck?.id,
      oracleId: recommendation.oracleId,
      strategy: recommendation.roleTags[0],
      type,
    });
    if (deck) {
      await refreshDeckArtifacts(deck.id);
    }
  }

  async function generateSmartBuild() {
    if (!deck) {
      return;
    }

    const config = createSmartBuildConfig({
      deck,
      mode: smartBuildMode,
      ownedCards,
      outputPreference,
      ownershipPreference,
      doNotSuggest,
      useCurrentDeckAsCore,
      manaCurveGoal,
      existingDeckBehavior,
    });
    const result = runSmartBuild({ deck, config, ownedCards });
    await saveSmartBuildResult(result);
    setSmartBuildResult(result);
    setExcludedSmartCardIds([]);
    setCardReviewMode(false);
    await refreshDeckArtifacts(deck.id);
    setMessage("Smart Build review generated. Nothing has been overwritten.");
  }

  async function applySmartBuild(destination: "main" | "maybeboard") {
    if (!deck || !smartBuildResult?.proposedCards) {
      return;
    }

    let nextDeck = deck;
    const selectedCards = smartBuildResult.proposedCards.filter(
      (card) => !excludedSmartCardIds.includes(card.id),
    );

    for (const smartCard of selectedCards) {
      const catalogCard = findCatalogCardByName(smartCard.name);
      if (!catalogCard) {
        continue;
      }

      nextDeck = await addDeckCard(
        deck.id,
        {
          ...catalogCardToManualInput({
            card: catalogCard,
            ownedQuantity: smartCard.ownedQuantity,
            destination,
          }),
          notes: `Source: Smart Build. ${smartCard.reason}`,
        },
        destination,
      );
    }

    const version = await saveDeckVersionFromDecks({
      beforeDeck: deck,
      afterDeck: nextDeck,
      label: `Smart Build ${destination === "main" ? "apply" : "maybeboard"} ${new Date().toLocaleString()}`,
      source: "smart_build",
      summary: smartBuildResult.summary,
    });

    await saveSmartBuildResult({
      ...smartBuildResult,
      applied: true,
      summary: `Applied ${selectedCards.length} reviewed cards to ${destination}.`,
    });
    await recordDecisionEvent({
      deckId: deck.id,
      type: "smart_build_applied",
      message: `Smart Build applied to ${destination}.`,
      payload: {
        beforeCount: getMainDeckCount(deck.cards),
        afterCount: getMainDeckCount(nextDeck.cards),
        proposedCards: selectedCards.map((card) => card.name),
        destination,
        versionId: version.id,
      },
    });
    await refreshDeckArtifacts(deck.id);
    setMessage(`Smart Build applied ${selectedCards.length} reviewed cards to ${destination}.`);
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
    await refreshDeckArtifacts(deck.id);
    setMessage(`${nextDeck.name} saved locally without altering ${deck.name}.`);
  }

  async function createSmartBuildUpgradeList() {
    if (!smartBuildResult) {
      return;
    }

    const list = await createUpgradeListFromSmartBuildResult(
      {
        ...smartBuildResult,
        proposedCards: smartBuildResult.proposedCards?.filter(
          (card) => !excludedSmartCardIds.includes(card.id),
        ),
      },
      `${deck?.name ?? "Deck"} Smart Build Upgrades`,
    );
    if (deck) {
      await refreshDeckArtifacts(deck.id);
    }
    setMessage(`${list.name} created locally from Smart Build suggestions.`);
  }

  async function moveMaybeboardCard(cardId: string) {
    if (!deck) {
      return;
    }

    await moveDeckCard(deck.id, cardId, "main");
    await recordDecisionEvent({
      deckId: deck.id,
      type: "card_restored_from_maybeboard",
      message: "Maybeboard card moved to Main Deck.",
      payload: { cardId },
    });
    await refreshDeckArtifacts(deck.id);
    setMessage("Maybeboard card restored to Main through local rules flow.");
  }

  async function moveMaybeboardToCuts(cardId: string) {
    if (!deck) {
      return;
    }

    const cutReason = cutReasonDrafts[cardId] || "Manual cut";
    await moveDeckCard(deck.id, cardId, "cuts", cutReason);
    await recordDecisionEvent({
      deckId: deck.id,
      type: "card_cut",
      message: "Maybeboard card moved to Cuts.",
      payload: { cardId, cutReason, source: "Analyzer" },
    });
    await refreshDeckArtifacts(deck.id);
    setMessage("Maybeboard card moved to Cuts with history.");
  }

  async function restoreCut(cardId: string) {
    if (!deck) {
      return;
    }

    await moveDeckCard(deck.id, cardId, "main");
    await recordDecisionEvent({
      deckId: deck.id,
      type: "card_restored_from_cuts",
      message: "Cut card restored to Main Deck.",
      payload: { cardId },
    });
    await refreshDeckArtifacts(deck.id);
    setMessage("Cut card restored to Main.");
  }

  async function moveCutToMaybeboard(cardId: string) {
    if (!deck) {
      return;
    }

    await moveDeckCard(deck.id, cardId, "maybeboard");
    await recordDecisionEvent({
      deckId: deck.id,
      type: "card_moved_to_maybeboard",
      message: "Cut card moved to Maybeboard.",
      payload: { cardId, source: "Analyzer" },
    });
    await refreshDeckArtifacts(deck.id);
    setMessage("Cut card moved to Maybeboard.");
  }

  async function deleteCut(cardId: string) {
    if (!deck) {
      return;
    }

    await removeDeckCard(deck.id, cardId);
    await recordDecisionEvent({
      deckId: deck.id,
      type: "cut_deleted",
      message: "Cut entry deleted locally.",
      payload: { cardId },
    });
    await refreshDeckArtifacts(deck.id);
    setMessage("Cut entry deleted.");
  }

  async function updateCutReason(cardId: string) {
    if (!deck) {
      return;
    }

    const cutReason = cutReasonDrafts[cardId] ?? "";
    await updateDeckCard(deck.id, cardId, {
      cutReason,
      reason: cutReason,
    });
    await recordDecisionEvent({
      deckId: deck.id,
      type: "cut_reason_updated",
      message: "Cut reason updated locally.",
      payload: { cardId, cutReason },
    });
    await refreshDeckArtifacts(deck.id);
    setMessage("Cut reason saved.");
  }

  async function markMaybeboardProtected(cardId: string) {
    if (!deck) {
      return;
    }

    await updateDeckCard(deck.id, cardId, { protected: true });
    await refreshDeckArtifacts(deck.id);
    setMessage("Maybeboard card marked protected.");
  }

  async function removeMaybeboardEntry(cardId: string) {
    if (!deck) {
      return;
    }

    await removeDeckCard(deck.id, cardId);
    await recordDecisionEvent({
      deckId: deck.id,
      type: "maybeboard_removed",
      message: "Card removed from Maybeboard.",
      payload: { cardId },
    });
    await refreshDeckArtifacts(deck.id);
    setMessage("Maybeboard entry removed.");
  }

  async function restoreVersion(versionId: string) {
    const restoredDeck = await restoreDeckVersion(versionId, "before");
    await refreshDeckArtifacts(restoredDeck.id);
    setMessage("Previous deck version restored locally.");
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
            <label>
              <input checked={notOwnedOnly} type="checkbox" onChange={(event) => setNotOwnedOnly(event.target.checked)} />
              Not owned
            </label>
            <label>
              <input checked={legalOnly} type="checkbox" onChange={(event) => setLegalOnly(event.target.checked)} />
              Legal only
            </label>
            <label>
              <input checked={inBracketOnly} type="checkbox" onChange={(event) => setInBracketOnly(event.target.checked)} />
              In bracket
            </label>
            <label>
              Role
              <input value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} />
            </label>
            <label>
              Mana value max
              <input inputMode="numeric" value={manaValueFilter} onChange={(event) => setManaValueFilter(event.target.value)} />
            </label>
            <label>
              Card type
              <input value={cardTypeFilter} onChange={(event) => setCardTypeFilter(event.target.value)} />
            </label>
            <label>
              Goal
              <input value={goalFilter} onChange={(event) => setGoalFilter(event.target.value)} />
            </label>
            <label>
              <input checked={commanderSynergyOnly} type="checkbox" onChange={(event) => setCommanderSynergyOnly(event.target.checked)} />
              Commander synergy
            </label>
            <label>
              <input checked={notAlreadyInDeck} type="checkbox" onChange={(event) => setNotAlreadyInDeck(event.target.checked)} />
              Not already in deck
            </label>
            <label>
              <input checked={notInMaybeboard} type="checkbox" onChange={(event) => setNotInMaybeboard(event.target.checked)} />
              Not in maybeboard
            </label>
            <label>
              <input checked={favoritesOnly} type="checkbox" onChange={(event) => setFavoritesOnly(event.target.checked)} />
              Favorites
            </label>
          </div>
          <p className="feature-status" role="status">
            Showing {recommendations.length} of {allRecommendations.length} within-color recommendations.
          </p>
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
                      <span className="badge">{recommendation.goalMatches.length ? recommendation.goalMatches.join(", ") : "General fit"}</span>
                      {favoriteOracleIds.has(recommendation.oracleId) ? <span className="badge">Favorite</span> : null}
                    </div>
                  </div>
                  <div className="result-actions">
                    <button type="button" onClick={() => addRecommendation(recommendation, "main")}>
                      Add to Main
                    </button>
                    <button type="button" onClick={() => addRecommendation(recommendation, "maybeboard")}>
                      Send to Maybeboard
                    </button>
                    <button type="button" onClick={() => replaceWithRecommendation(recommendation)}>
                      Replace Existing
                    </button>
                    <button type="button" onClick={() => navigate(`/search?q=${encodeURIComponent(recommendation.name)}`)}>
                      View Details
                    </button>
                    <button type="button" onClick={() => navigate(`/search?q=${encodeURIComponent(recommendation.roleTags[0] ?? recommendation.name)}`)}>
                      Find Similar
                    </button>
                    <button type="button" onClick={() => setMessage(`Compare foundation staged for ${recommendation.name}.`)}>
                      Compare
                    </button>
                    <button type="button" onClick={() => recordRecommendationFeedback(recommendation, "favorite")}>
                      Favorite
                    </button>
                    <button type="button" onClick={() => recordRecommendationFeedback(recommendation, "not_interested")}>
                      Not Interested
                    </button>
                    <button type="button" onClick={() => recordRecommendationFeedback(recommendation, "never_suggest_card")}>
                      Never Suggest This Card
                    </button>
                    <button type="button" onClick={() => recordRecommendationFeedback(recommendation, "never_suggest_strategy")}>
                      Never Suggest This Strategy
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
            <label>
              Output Preference
              <select value={outputPreference} onChange={(event) => setOutputPreference(event.target.value as SmartBuildOutputPreference)}>
                {outputPreferences.map((preference) => (
                  <option key={preference.id} value={preference.id}>{preference.label}</option>
                ))}
              </select>
            </label>
            <label>
              Ownership Preference
              <select value={ownershipPreference} onChange={(event) => setOwnershipPreference(event.target.value as OwnershipPreference)}>
                {ownershipPreferences.map((preference) => (
                  <option key={preference.id} value={preference.id}>{preference.label}</option>
                ))}
              </select>
            </label>
            <label>
              Existing Deck Behavior
              <select value={existingDeckBehavior} onChange={(event) => setExistingDeckBehavior(event.target.value as typeof existingDeckBehavior)}>
                {existingDeckBehaviors.map((behavior) => (
                  <option key={behavior.id} value={behavior.id}>{behavior.label}</option>
                ))}
              </select>
            </label>
            <label>
              Mana Curve Goal
              <input value={manaCurveGoal} onChange={(event) => setManaCurveGoal(event.target.value)} />
            </label>
            <label>
              Do-Not-Suggest Rules
              <input
                aria-label="Do-Not-Suggest Rules"
                placeholder="Comma-separated card names or oracle ids"
                value={doNotSuggestText}
                onChange={(event) => setDoNotSuggestText(event.target.value)}
              />
            </label>
            <label>
              <input
                checked={useCurrentDeckAsCore}
                type="checkbox"
                onChange={(event) => setUseCurrentDeckAsCore(event.target.checked)}
              />
              Use Current Deck As Core
            </label>
            <button type="button" onClick={generateSmartBuild}>
              <BrainCircuit aria-hidden="true" /> Generate Smart Build Review
            </button>
          </div>
          <div className="smart-build-setup">
            <span>Commander Zone: {deck.commanderNames.join(" / ") || "Not set"}</span>
            <span>Color Identity: {deck.colorIdentity.join(" ") || "Colorless / Unknown"}</span>
            <span>Bracket Lock: {deck.bracketLock.enabled ? formatBracket(deck.bracketLock.bracket) : "Unlocked"}</span>
            <span>Ownership Preference: {ownershipPreference}</span>
            <span>Deck Goals: {deck.goals.map((goal) => `${goal.name} (${goal.priority})`).join(", ") || "None"}</span>
            <span>Protected Cards: {deck.cards.filter((card) => card.protected).length}</span>
            <span>Output: {outputPreferences.find((preference) => preference.id === outputPreference)?.label}</span>
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
                <HolographicPanel variant="quiet"><strong>{smartBuildResult.legalityStatus ?? "Review"}</strong><span>Legality Status</span></HolographicPanel>
                <HolographicPanel variant="quiet"><strong>{smartBuildResult.bracketFit ?? "Review"}</strong><span>Bracket Fit</span></HolographicPanel>
              </div>
              <div className="analysis-bars">
                <p><strong>Goal Alignment</strong> {smartBuildResult.goalAlignment ?? "Review proposed card explanations."}</p>
                <p><strong>Mana Curve Goal</strong> {smartBuildResult.config?.manaCurveGoal ?? "Balanced Commander curve"}</p>
                <p><strong>Average Proposed Mana Value</strong> {smartBuildResult.manaCurve?.averageManaValue ?? 0}</p>
                {Object.entries(smartBuildResult.roleBreakdown ?? {}).map(([role, count]) => (
                  <span key={role}><strong>{role}</strong> {count}</span>
                ))}
              </div>
              {smartBuildResult.cutCards?.length ? (
                <div className="recommendation-list">
                  <h3>Cards Cut</h3>
                  {smartBuildResult.cutCards.map((card) => (
                    <article className="recommendation-card" key={card.id}>
                      <div>
                        <h2>{card.name}</h2>
                        <small>{card.reason}</small>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
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
                        <span className="badge">{card.ownedQuantity > 0 ? "Owned Cards Used" : "Unowned Card"}</span>
                      </div>
                    </div>
                    {cardReviewMode ? (
                      <label>
                        <input
                          checked={!excludedSmartCardIds.includes(card.id)}
                          type="checkbox"
                          onChange={(event) =>
                            setExcludedSmartCardIds((current) =>
                              event.target.checked
                                ? current.filter((cardId) => cardId !== card.id)
                                : [...current, card.id],
                            )
                          }
                        />
                        Include in reviewed output
                      </label>
                    ) : null}
                  </article>
                ))}
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => applySmartBuild("main")}>Apply Build</button>
                <button type="button" onClick={saveSmartBuildAsNewDeck}>Save as New Deck</button>
                <button type="button" onClick={() => applySmartBuild("maybeboard")}>Send Suggestions to Maybeboard</button>
                <button type="button" onClick={createSmartBuildUpgradeList}>Create Upgrade List Only</button>
                <button type="button" onClick={() => setCardReviewMode((current) => !current)}>Review Card by Card</button>
                <button type="button" onClick={() => setMessage("Export preview staged in plain text without prices or marketplace links.")}>Export Preview</button>
                <button type="button" onClick={() => setSmartBuildResult(null)}>Cancel</button>
              </div>
            </div>
          ) : null}
          <div className="smart-build-history">
            <h2>Version History</h2>
            {smartBuildHistory.length === 0 && deckVersions.length === 0 ? <p>No Smart Build versions saved yet.</p> : null}
            {deckVersions.map((version) => (
              <article className="timeline-event" key={version.id}>
                <History aria-hidden="true" />
                <div>
                  <strong>{version.label}</strong>
                  <span>
                    Before {version.beforeCardIds.length} cards · After {version.afterCardIds.length} cards · {new Date(version.createdAt).toLocaleString()}
                  </span>
                  <small>{version.summary ?? "Local deck version snapshot."}</small>
                  <div className="result-actions">
                    <button type="button" onClick={() => restoreVersion(version.id)}>Restore Previous Version</button>
                    <button type="button" onClick={() => setMessage(`${version.label}: before ${version.beforeCardIds.length}, after ${version.afterCardIds.length}.`)}>
                      Compare Versions
                    </button>
                    <button type="button" onClick={saveSmartBuildAsNewDeck}>Duplicate Version</button>
                  </div>
                </div>
              </article>
            ))}
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
                <small>{card.notes || card.reason || "Maybeboard source retained locally."}</small>
                <div className="badge-row">
                  {card.roleTags.map((role) => <span className="badge" key={role}>{role}</span>)}
                  {card.goalMatches?.map((goal) => <span className="badge" key={goal}>{goal}</span>)}
                  <span className="badge">Does not count toward 100</span>
                </div>
                <span>{card.typeLine ?? "Type pending"} · {card.missingQuantity > 0 ? "Missing/not confirmed owned" : "Owned"}</span>
              </div>
              <button type="button" onClick={() => moveMaybeboardCard(card.id)}>Move to Main Deck</button>
              <button type="button" onClick={() => moveMaybeboardToCuts(card.id)}>Move to Cuts</button>
              <button type="button" onClick={() => navigate(`/search?q=${encodeURIComponent(card.name)}`)}>View Details</button>
              <button type="button" onClick={() => navigate(`/search?q=${encodeURIComponent(card.roleTags[0] ?? card.name)}`)}>Find Similar</button>
              <button type="button" onClick={() => setMessage(`Compare staged for ${card.name}.`)}>Compare</button>
              <button type="button" onClick={() => markMaybeboardProtected(card.id)}>Mark Protected</button>
              <button type="button" onClick={() => setMessage(`Tags and notes editor staged for ${card.name}.`)}>Edit Tags / Notes</button>
              <button type="button" onClick={() => setMessage(`Ownership confirmation staged for ${card.name}.`)}>Confirm Ownership</button>
              <button type="button" onClick={() => setMessage(`Scanner correction staged for ${card.name}.`)}>Scan Copy</button>
              <button type="button" onClick={() => removeMaybeboardEntry(card.id)}>Remove from Maybeboard</button>
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
              <label>
                Cut reason
                <select
                  value={cutReasonDrafts[card.id] ?? card.cutReason ?? ""}
                  onChange={(event) =>
                    setCutReasonDrafts((current) => ({
                      ...current,
                      [card.id]: event.target.value,
                    }))
                  }
                >
                  <option value="">No cut reason</option>
                  {cutReasons.map((reason) => (
                    <option key={reason} value={reason}>{reason}</option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={() => restoreCut(card.id)}>Restore to Main Deck</button>
              <button type="button" onClick={() => moveCutToMaybeboard(card.id)}>Move to Maybeboard</button>
              <button type="button" onClick={() => navigate(`/search?q=${encodeURIComponent(card.name)}`)}>View Details</button>
              <button type="button" onClick={() => updateCutReason(card.id)}>Edit Cut Reason</button>
              <button type="button" onClick={() => navigate(`/search?q=${encodeURIComponent(card.roleTags[0] ?? card.name)}`)}>Find Similar</button>
              <button type="button" onClick={() => setMessage(`Compare with replacement staged for ${card.name}.`)}>Compare with Replacement</button>
              <button type="button" onClick={() => deleteCut(card.id)}>Delete From Cuts</button>
            </article>
          ))}
        </HolographicPanel>
      ) : null}

      {deck && activeTab === "timeline" ? (
        <HolographicPanel className="timeline-panel">
          <h2>Decision Timeline</h2>
          <label>
            Timeline filter
            <select value={timelineFilter} onChange={(event) => setTimelineFilter(event.target.value as typeof timelineFilter)}>
              {timelineFilters.map((filter) => (
                <option key={filter.id} value={filter.id}>{filter.label}</option>
              ))}
            </select>
          </label>
          {replacementRecords.length > 0 ? (
            <div className="analysis-bars">
              <strong>Replacement History</strong>
              {replacementRecords.map((record) => (
                <span key={record.id}>{record.reason} · {new Date(record.createdAt).toLocaleString()}</span>
              ))}
            </div>
          ) : null}
          {timeline.filter((event) => timelineMatchesFilter(event, timelineFilter)).length === 0 ? (
            <p>No local decision events for this filter yet.</p>
          ) : null}
          {timeline.filter((event) => timelineMatchesFilter(event, timelineFilter)).map((event) => (
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
