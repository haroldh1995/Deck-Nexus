import {
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Archive,
  ArrowLeft,
  BarChart3,
  Copy,
  Download,
  Eye,
  FileInput,
  Layers3,
  Lock,
  MoreHorizontal,
  NotebookPen,
  Plus,
  RotateCcw,
  ScanLine,
  Scissors,
  Search,
  Settings,
  Shield,
  Sparkles,
  Tags,
  Trash2,
  Unlock,
  X,
} from "lucide-react";
import { HolographicPanel } from "../../components/HolographicPanel";
import { PageHeader } from "../../components/PageHeader";
import { StatusPill } from "../../components/StatusPill";
import {
  addDeckCard,
  createGoalFromName,
  deleteDeck,
  duplicateDeck,
  getDeck,
  moveDeckCard,
  removeDeckCard,
  replaceDeckCard,
  updateDeckCard,
  updateDeckMetadata,
} from "../../db/repositories";
import type {
  Bracket,
  BracketLock,
  CommanderColor,
  Deck,
  DeckCard,
  DeckGoal,
} from "../../types/domain";
import { analyzeLiveBracket, formatBracket } from "./bracketAnalysis";
import {
  classifyCardSection,
  getCardBadges,
  getCardBuilderSection,
  getMainDeckCount,
  getSeedTypeLine,
  parseColorIdentityInput,
  parseTagInput,
} from "./cardClassification";
import {
  evaluateAddCardRules,
  evaluateDeckRules,
  getBannedStatusLabel,
  getCardLegalityLabel,
} from "./commanderRules";
import {
  builderSections,
  mainBuilderSectionIds,
  type AddDestination,
  type BuilderSectionId,
  type BuilderTab,
  type ManualCardInput,
  type RuleEnforcementMode,
  type RuleWarning,
  type SectionHealth,
} from "./builderTypes";
import { formatBracketLock, formatCommanderNames } from "./deckPresentation";

type CardFormState = {
  name: string;
  manaCost: string;
  typeLine: string;
  oracleText: string;
  colorIdentity: CommanderColor[];
  colorless: boolean;
  roleTags: string;
  customTags: string;
  notes: string;
  owned: boolean;
  destination: AddDestination;
  requestedSection: BuilderSectionId;
};

type AddModalState = {
  section: BuilderSectionId;
  destination: AddDestination;
  replaceTarget?: DeckCard;
};

type PendingWarningState = {
  input: ManualCardInput;
  warnings: RuleWarning[];
  blocked: boolean;
  replaceTarget?: DeckCard;
  moveCard?: DeckCard;
  showReplacePicker: boolean;
  selectedReplacementId: string;
};

type CutModalState = {
  card: DeckCard;
  reason: string;
};

type MetadataModal = "rename" | "notes" | "goals" | "bracket" | "delete";

const colorOptions: { value: CommanderColor; label: string }[] = [
  { value: "W", label: "W" },
  { value: "U", label: "U" },
  { value: "B", label: "B" },
  { value: "R", label: "R" },
  { value: "G", label: "G" },
];

const bracketOptions: Bracket[] = [
  "bracket_1",
  "bracket_2",
  "bracket_3",
  "bracket_4",
  "bracket_5",
  "custom",
];

const tabLabels: Record<BuilderTab, string> = {
  main: "Main Deck",
  maybeboard: "Maybeboard",
  cuts: "Cuts",
};

function destinationForTab(tab: BuilderTab): AddDestination {
  return tab === "main" ? "main" : tab;
}

function createCardForm(
  section: BuilderSectionId,
  destination: AddDestination,
): CardFormState {
  return {
    name: "",
    manaCost: "",
    typeLine: getSeedTypeLine(section),
    oracleText: "",
    colorIdentity: [],
    colorless: false,
    roleTags: "",
    customTags: "",
    notes: "",
    owned: true,
    destination,
    requestedSection: section,
  };
}

function buildManualInput(form: CardFormState): ManualCardInput {
  return {
    name: form.name.trim(),
    manaCost: form.manaCost.trim(),
    typeLine: form.typeLine.trim() || getSeedTypeLine(form.requestedSection),
    oracleText: form.oracleText.trim(),
    colorIdentity: form.colorless ? [] : form.colorIdentity,
    roleTags: parseTagInput(form.roleTags),
    customTags: parseTagInput(form.customTags),
    notes: form.notes.trim(),
    owned: form.owned,
    destination: form.destination,
    requestedSection: form.requestedSection,
  };
}

function manualInputFromCard(
  card: DeckCard,
  destination: AddDestination,
): ManualCardInput {
  const section = getCardBuilderSection(card);

  return {
    name: card.name,
    manaCost: card.manaCost ?? "",
    typeLine: card.typeLine ?? getSeedTypeLine(section),
    oracleText: card.oracleText ?? "",
    colorIdentity: card.colorIdentity ?? [],
    roleTags: card.roleTags,
    customTags: card.customTags,
    notes: card.notes,
    owned: card.missingQuantity === 0,
    destination,
    requestedSection: section,
  };
}

function getAllDeckCards(deck: Deck): DeckCard[] {
  return [...deck.cards, ...deck.maybeboard, ...deck.cuts];
}

function getDeckCardById(deck: Deck, cardId: string): DeckCard | undefined {
  return getAllDeckCards(deck).find((card) => card.id === cardId);
}

function getCardsForTab(deck: Deck, tab: BuilderTab): DeckCard[] {
  if (tab === "maybeboard") {
    return deck.maybeboard;
  }

  if (tab === "cuts") {
    return deck.cuts;
  }

  return deck.cards;
}

function getCardsForSection(
  deck: Deck,
  section: BuilderSectionId,
  tab: BuilderTab,
): DeckCard[] {
  return getCardsForTab(deck, tab).filter(
    (card) => getCardBuilderSection(card) === section,
  );
}

function sumQuantities(cards: readonly DeckCard[]): number {
  return cards.reduce((total, card) => total + card.quantity, 0);
}

function getSectionHealth(deck: Deck, cards: readonly DeckCard[]): SectionHealth {
  if (
    cards.some((card) =>
      ["Outside color identity", "Singleton warning"].includes(
        getCardLegalityLabel(deck, card),
      ),
    )
  ) {
    return "serious";
  }

  if (cards.length > 0 && cards.every((card) => card.protected)) {
    return "protected";
  }

  if (cards.some((card) => card.missingQuantity > 0)) {
    return "attention";
  }

  return "normal";
}

function formatColorIdentity(colors: readonly CommanderColor[]): string {
  return colors.length > 0 ? colors.join(" ") : "Colorless";
}

function toGoalList(value: string): DeckGoal[] {
  return value
    .split(/\n|,/)
    .map((goal) => goal.trim())
    .filter(Boolean)
    .map((goal, index) => createGoalFromName(goal, index + 1));
}

function bracketValue(bracket: Bracket): number {
  if (bracket === "custom") {
    return 3;
  }

  return Number(bracket.replace("bracket_", ""));
}

export function DeckBuilderScreen() {
  const { deckId } = useParams();
  const navigate = useNavigate();
  const longPressTimer = useRef<number | undefined>(undefined);
  const [deck, setDeck] = useState<Deck | null>(null);
  const [loading, setLoading] = useState(Boolean(deckId));
  const [activeTab, setActiveTab] = useState<BuilderTab>("main");
  const [ruleMode, setRuleMode] =
    useState<RuleEnforcementMode>("guided");
  const [focusedCardId, setFocusedCardId] = useState<string>("");
  const [detailCardId, setDetailCardId] = useState<string>("");
  const [quickMenuCardId, setQuickMenuCardId] = useState<string>("");
  const [addModal, setAddModal] = useState<AddModalState | null>(null);
  const [cardForm, setCardForm] = useState<CardFormState>(
    createCardForm("creatures", "main"),
  );
  const [pendingWarning, setPendingWarning] =
    useState<PendingWarningState | null>(null);
  const [cutModal, setCutModal] = useState<CutModalState | null>(null);
  const [expandedSection, setExpandedSection] =
    useState<BuilderSectionId | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [metadataModal, setMetadataModal] = useState<MetadataModal | null>(
    null,
  );
  const [metadataDraft, setMetadataDraft] = useState("");
  const [bracketDraft, setBracketDraft] = useState<BracketLock | null>(null);
  const [detailDraft, setDetailDraft] = useState({
    roleTags: "",
    customTags: "",
    notes: "",
  });
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadDeck() {
      if (!deckId) {
        setLoading(false);
        return;
      }

      const nextDeck = await getDeck(deckId);
      if (mounted) {
        setDeck(nextDeck ?? null);
        setLoading(false);
      }
    }

    void loadDeck();

    return () => {
      mounted = false;
    };
  }, [deckId]);

  const focusedCard = useMemo(
    () => (deck && focusedCardId ? getDeckCardById(deck, focusedCardId) : null),
    [deck, focusedCardId],
  );
  const detailCard = useMemo(
    () => (deck && detailCardId ? getDeckCardById(deck, detailCardId) : null),
    [deck, detailCardId],
  );
  const quickMenuCard = useMemo(
    () =>
      deck && quickMenuCardId ? getDeckCardById(deck, quickMenuCardId) : null,
    [deck, quickMenuCardId],
  );
  const bracketAnalysis = useMemo(
    () => (deck ? analyzeLiveBracket(deck) : null),
    [deck],
  );
  const deckWarnings = useMemo(
    () => (deck ? evaluateDeckRules(deck) : []),
    [deck],
  );

  function rememberDeck(nextDeck: Deck, message?: string) {
    setDeck(nextDeck);
    if (message) {
      setStatusMessage(message);
    }
  }

  function openAddCardModal(
    section: BuilderSectionId,
    destination = destinationForTab(activeTab),
    replaceTarget?: DeckCard,
  ) {
    setAddModal({ section, destination, replaceTarget });
    setCardForm(createCardForm(section, destination));
    setStatusMessage("");
  }

  function openDetail(card: DeckCard) {
    setDetailCardId(card.id);
    setDetailDraft({
      roleTags: card.roleTags.join(", "),
      customTags: card.customTags.join(", "),
      notes: card.notes,
    });
  }

  function openMetadataModal(type: MetadataModal) {
    if (!deck) {
      return;
    }

    setMetadataModal(type);
    setMoreOpen(false);

    if (type === "rename") {
      setMetadataDraft(deck.name);
    } else if (type === "notes") {
      setMetadataDraft(deck.notes);
    } else if (type === "goals") {
      setMetadataDraft(deck.goals.map((goal) => goal.name).join("\n"));
    } else if (type === "bracket") {
      setBracketDraft({ ...deck.bracketLock });
    }
  }

  async function commitInput(
    input: ManualCardInput,
    replaceTarget?: DeckCard,
    replacementCardId?: string,
  ) {
    if (!deck) {
      return;
    }

    const nextDeck =
      replaceTarget && input.destination === "main"
        ? await replaceDeckCard(deck.id, replaceTarget.id, input)
        : replacementCardId && input.destination === "main"
          ? await replaceDeckCard(deck.id, replacementCardId, input)
          : await addDeckCard(deck.id, input, input.destination);

    rememberDeck(nextDeck, `${input.name} saved locally.`);
    setAddModal(null);
    setPendingWarning(null);
  }

  async function submitCardForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!deck || !addModal) {
      return;
    }

    const input = buildManualInput(cardForm);
    if (!input.name) {
      setStatusMessage("Card name is required.");
      return;
    }

    const ruleDeck =
      addModal.replaceTarget && addModal.replaceTarget.section !== "cuts"
        ? {
            ...deck,
            cards: deck.cards.filter(
              (card) => card.id !== addModal.replaceTarget?.id,
            ),
          }
        : deck;
    const result = evaluateAddCardRules({
      deck: ruleDeck,
      input,
      mode: ruleMode,
    });

    if (result.warnings.length > 0 && ruleMode !== "sandbox") {
      setPendingWarning({
        input,
        warnings: result.warnings,
        blocked: result.blocked,
        replaceTarget: addModal.replaceTarget,
        showReplacePicker: false,
        selectedReplacementId: "",
      });
      return;
    }

    await commitInput(input, addModal.replaceTarget);
    if (ruleMode === "sandbox" && result.warnings.length > 0) {
      setStatusMessage(
        `${input.name} saved locally. Sandbox Mode is flagging rule warnings.`,
      );
    }
  }

  async function handleMoveCard(
    card: DeckCard,
    destination: AddDestination,
    cutReason = "",
  ) {
    if (!deck || card.section === destination) {
      return;
    }

    if (destination === "cuts") {
      setCutModal({ card, reason: cutReason });
      setQuickMenuCardId("");
      return;
    }

    if (destination === "main") {
      const input = manualInputFromCard(card, "main");
      const result = evaluateAddCardRules({ deck, input, mode: ruleMode });

      if (result.warnings.length > 0 && ruleMode !== "sandbox") {
        setPendingWarning({
          input,
          warnings: result.warnings,
          blocked: result.blocked,
          moveCard: card,
          showReplacePicker: false,
          selectedReplacementId: "",
        });
        setQuickMenuCardId("");
        return;
      }
    }

    const nextDeck = await moveDeckCard(deck.id, card.id, destination, cutReason);
    rememberDeck(nextDeck, `${card.name} moved locally.`);
    setQuickMenuCardId("");
  }

  async function confirmCut() {
    if (!deck || !cutModal) {
      return;
    }

    const nextDeck = await moveDeckCard(
      deck.id,
      cutModal.card.id,
      "cuts",
      cutModal.reason,
    );
    rememberDeck(nextDeck, `${cutModal.card.name} moved to Cuts.`);
    setCutModal(null);
    setDetailCardId("");
  }

  async function handleRemoveCard(card: DeckCard) {
    if (!deck) {
      return;
    }

    const nextDeck = await removeDeckCard(deck.id, card.id);
    rememberDeck(nextDeck, `${card.name} removed locally.`);
    setQuickMenuCardId("");
    setDetailCardId("");
  }

  async function handleUpdateCard(card: DeckCard, patch: Partial<DeckCard>) {
    if (!deck) {
      return;
    }

    const nextDeck = await updateDeckCard(deck.id, card.id, patch);
    rememberDeck(nextDeck, `${card.name} updated locally.`);
    const updatedCard = getDeckCardById(nextDeck, card.id);
    if (updatedCard && detailCardId === card.id) {
      openDetail(updatedCard);
    }
  }

  async function handleSaveDetail() {
    if (!detailCard) {
      return;
    }

    await handleUpdateCard(detailCard, {
      roleTags: parseTagInput(detailDraft.roleTags),
      customTags: parseTagInput(detailDraft.customTags),
      notes: detailDraft.notes.trim(),
    });
  }

  async function handlePendingAddAnyway() {
    if (!pendingWarning || pendingWarning.blocked) {
      return;
    }

    if (pendingWarning.moveCard && deck) {
      const nextDeck = await moveDeckCard(
        deck.id,
        pendingWarning.moveCard.id,
        "main",
      );
      rememberDeck(nextDeck, `${pendingWarning.moveCard.name} moved locally.`);
      setPendingWarning(null);
      return;
    }

    await commitInput(pendingWarning.input, pendingWarning.replaceTarget);
  }

  async function handlePendingMaybeboard() {
    if (!deck || !pendingWarning) {
      return;
    }

    if (pendingWarning.moveCard) {
      const nextDeck = await moveDeckCard(
        deck.id,
        pendingWarning.moveCard.id,
        "maybeboard",
      );
      rememberDeck(
        nextDeck,
        `${pendingWarning.moveCard.name} moved to Maybeboard.`,
      );
      setPendingWarning(null);
      return;
    }

    await commitInput({
      ...pendingWarning.input,
      destination: "maybeboard",
    });
  }

  async function handlePendingReplacement() {
    if (!deck || !pendingWarning || !pendingWarning.selectedReplacementId) {
      return;
    }

    if (pendingWarning.moveCard) {
      const replacementCard = getDeckCardById(
        deck,
        pendingWarning.selectedReplacementId,
      );
      if (!replacementCard) {
        return;
      }
      await moveDeckCard(
        deck.id,
        replacementCard.id,
        "cuts",
        `Opened room for ${pendingWarning.moveCard.name}`,
      );
      const nextDeck = await moveDeckCard(deck.id, pendingWarning.moveCard.id, "main");
      rememberDeck(nextDeck, `${pendingWarning.moveCard.name} restored locally.`);
      setPendingWarning(null);
      return;
    }

    await commitInput(
      { ...pendingWarning.input, destination: "main" },
      pendingWarning.replaceTarget,
      pendingWarning.selectedReplacementId,
    );
  }

  function cancelPendingWarning() {
    if (!pendingWarning?.moveCard) {
      setAddModal(null);
    }
    setPendingWarning(null);
  }

  async function handleMetadataSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!deck || !metadataModal) {
      return;
    }

    if (metadataModal === "rename") {
      const nextName = metadataDraft.trim();
      if (!nextName) {
        setStatusMessage("Deck name is required.");
        return;
      }
      rememberDeck(await updateDeckMetadata(deck.id, { name: nextName }));
    } else if (metadataModal === "notes") {
      rememberDeck(await updateDeckMetadata(deck.id, { notes: metadataDraft }));
    } else if (metadataModal === "goals") {
      rememberDeck(
        await updateDeckMetadata(deck.id, { goals: toGoalList(metadataDraft) }),
      );
    } else if (metadataModal === "bracket" && bracketDraft) {
      rememberDeck(
        await updateDeckMetadata(deck.id, { bracketLock: bracketDraft }),
      );
    }

    setStatusMessage("Deck settings saved locally.");
    setMetadataModal(null);
  }

  async function handleDuplicateDeck() {
    if (!deck) {
      return;
    }

    const duplicate = await duplicateDeck(deck.id);
    navigate(`/deck-builder/${duplicate.id}`);
  }

  async function handleDeleteDeck() {
    if (!deck) {
      return;
    }

    await deleteDeck(deck.id);
    navigate("/library");
  }

  function beginCardPress(card: DeckCard) {
    window.clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => {
      setQuickMenuCardId(card.id);
    }, 520);
  }

  function endCardPress() {
    window.clearTimeout(longPressTimer.current);
  }

  function handleCardKeyDown(event: KeyboardEvent, card: DeckCard) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setFocusedCardId(card.id);
      openDetail(card);
    }
  }

  if (!deckId) {
    return (
      <div className="screen screen--narrow">
        <PageHeader title="Deck Builder">
          <StatusPill tone="violet">Local Deck Required</StatusPill>
        </PageHeader>
        <HolographicPanel>
          <div className="empty-panel">
            <h2>Choose a deck</h2>
            <p>Open a saved Commander deck from the local library.</p>
            <Link className="secondary-action" to="/library">
              Back to Library
            </Link>
          </div>
        </HolographicPanel>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="screen screen--narrow">
        <PageHeader title="Deck Builder" />
        <HolographicPanel>
          <p className="foundation-summary">Loading local deck.</p>
        </HolographicPanel>
      </div>
    );
  }

  if (!deck || !bracketAnalysis) {
    return (
      <div className="screen screen--narrow">
        <PageHeader title="Deck Builder" />
        <HolographicPanel>
          <div className="empty-panel">
            <h2>Deck not found</h2>
            <p>This local deck record is not available in IndexedDB.</p>
            <Link className="secondary-action" to="/library">
              Back to Library
            </Link>
          </div>
        </HolographicPanel>
      </div>
    );
  }

  const mainDeckCount = getMainDeckCount(deck.cards);
  const commanderCards = deck.cards.filter((card) => card.section === "commander");
  const replacementCandidates = deck.cards.filter(
    (card) => card.section === "main",
  );

  return (
    <div className="screen deck-builder-screen">
      <PageHeader title={deck.name}>
        <Link className="secondary-action builder-header-link" to="/library">
          <ArrowLeft aria-hidden="true" />
          Library
        </Link>
        <StatusPill tone={deckWarnings.some((warning) => warning.severity === "illegal") ? "violet" : "cyan"}>
          {formatBracketLock(deck.bracketLock)}
        </StatusPill>
      </PageHeader>

      <div className="builder-control-strip" aria-label="Deck Builder controls">
        <div className="builder-tabs" role="tablist" aria-label="Builder zones">
          {(["main", "maybeboard", "cuts"] as BuilderTab[]).map((tab) => (
            <button
              aria-selected={activeTab === tab}
              className={activeTab === tab ? "is-active" : ""}
              key={tab}
              onClick={() => setActiveTab(tab)}
              role="tab"
              type="button"
            >
              {tabLabels[tab]}
              <span>{sumQuantities(getCardsForTab(deck, tab))}</span>
            </button>
          ))}
        </div>
        <label className="rule-mode-control">
          Rule Mode
          <select
            aria-label="Rule enforcement mode"
            value={ruleMode}
            onChange={(event) =>
              setRuleMode(event.target.value as RuleEnforcementMode)
            }
          >
            <option value="guided">Guided Mode</option>
            <option value="strict">Strict Mode</option>
            <option value="sandbox">Sandbox Mode</option>
          </select>
        </label>
      </div>

      {statusMessage ? (
        <div className="builder-status" role="status">
          {statusMessage}
        </div>
      ) : null}

      <section
        className={`deck-builder-stage deck-builder-stage--${bracketAnalysis.meterTone}`}
        aria-label="Commander deck builder"
      >
        <div className="builder-rune builder-rune--top" aria-hidden="true" />
        <div className="builder-beam" aria-hidden="true" />

        <CommanderZone
          commanderCards={commanderCards}
          deck={deck}
          onAddCommander={() => openAddCardModal("commander", "main")}
          onFocusCard={(card) => setFocusedCardId(card.id)}
          onOpenDetail={openDetail}
          onQuickMenu={(card) => setQuickMenuCardId(card.id)}
        />

        <DeckSectionPanel
          cards={getCardsForSection(deck, "creatures", activeTab)}
          deck={deck}
          focusedCardId={focusedCardId}
          health={getSectionHealth(
            deck,
            getCardsForSection(deck, "creatures", activeTab),
          )}
          isLarge
          onAdd={() => openAddCardModal("creatures")}
          onBeginPress={beginCardPress}
          onEndPress={endCardPress}
          onExpand={() => setExpandedSection("creatures")}
          onFocusCard={(card) => setFocusedCardId(card.id)}
          onKeyDown={handleCardKeyDown}
          onOpenDetail={openDetail}
          onQuickMenu={(card) => setQuickMenuCardId(card.id)}
          sectionId="creatures"
        />

        <div className="builder-section-grid">
          {mainBuilderSectionIds
            .filter((sectionId) => sectionId !== "creatures")
            .map((sectionId) => {
              const cards = getCardsForSection(deck, sectionId, activeTab);
              return (
                <DeckSectionPanel
                  cards={cards}
                  deck={deck}
                  focusedCardId={focusedCardId}
                  health={getSectionHealth(deck, cards)}
                  key={sectionId}
                  onAdd={() => openAddCardModal(sectionId)}
                  onBeginPress={beginCardPress}
                  onEndPress={endCardPress}
                  onExpand={() => setExpandedSection(sectionId)}
                  onFocusCard={(card) => setFocusedCardId(card.id)}
                  onKeyDown={handleCardKeyDown}
                  onOpenDetail={openDetail}
                  onQuickMenu={(card) => setQuickMenuCardId(card.id)}
                  sectionId={sectionId}
                />
              );
            })}
        </div>

        <div className="builder-meter-row">
          <DeckCountRing count={mainDeckCount} />
          <BracketTracker
            analysis={bracketAnalysis}
            cardImpact={focusedCard ? bracketAnalysis.cardImpacts[focusedCard.id] : undefined}
          />
        </div>

        <div className="builder-command-glyphs" aria-label="Deck commands">
          <button
            type="button"
            onClick={() => openAddCardModal("creatures")}
            title="Search and add card"
          >
            <Search aria-hidden="true" />
            <span>Search</span>
          </button>
          <button
            type="button"
            onClick={() =>
              setStatusMessage(
                "Recommendations need local card intelligence in a later prompt. Automatic suggestions will stay inside commander color identity.",
              )
            }
            title="Recommend"
          >
            <Sparkles aria-hidden="true" />
            <span>Recommend</span>
          </button>
          <button type="button" onClick={() => navigate("/scan")} title="Scan">
            <ScanLine aria-hidden="true" />
            <span>Scan</span>
          </button>
          <button
            type="button"
            onClick={() =>
              setStatusMessage(
                "Smart Build is not placing cards yet. The rules foundation is active for future automatic builds.",
              )
            }
            title="Smart Build"
          >
            <Layers3 aria-hidden="true" />
            <span>Smart Build</span>
          </button>
          <button
            type="button"
            onClick={() => setMoreOpen((current) => !current)}
            title="More"
          >
            <MoreHorizontal aria-hidden="true" />
            <span>More</span>
          </button>
        </div>
      </section>

      {moreOpen ? (
        <MoreMenu
          onClose={() => setMoreOpen(false)}
          onDelete={() => openMetadataModal("delete")}
          onDuplicate={handleDuplicateDeck}
          onMetadata={openMetadataModal}
          onNavigate={navigate}
        />
      ) : null}

      {addModal ? (
        <CardFormModal
          form={cardForm}
          replaceTarget={addModal.replaceTarget}
          section={addModal.section}
          onChange={setCardForm}
          onClose={() => setAddModal(null)}
          onSubmit={submitCardForm}
        />
      ) : null}

      {pendingWarning ? (
        <RuleWarningModal
          candidates={replacementCandidates}
          pendingWarning={pendingWarning}
          ruleMode={ruleMode}
          onAddAnyway={handlePendingAddAnyway}
          onCancel={cancelPendingWarning}
          onMaybeboard={handlePendingMaybeboard}
          onReplacementChange={(selectedReplacementId) =>
            setPendingWarning((current) =>
              current ? { ...current, selectedReplacementId } : current,
            )
          }
          onReplace={() =>
            setPendingWarning((current) =>
              current ? { ...current, showReplacePicker: true } : current,
            )
          }
          onReplaceConfirm={handlePendingReplacement}
        />
      ) : null}

      {quickMenuCard ? (
        <QuickCardMenu
          card={quickMenuCard}
          onClose={() => setQuickMenuCardId("")}
          onCut={() => setCutModal({ card: quickMenuCard, reason: "" })}
          onDetail={() => {
            openDetail(quickMenuCard);
            setQuickMenuCardId("");
          }}
          onFindSimilar={() => {
            setStatusMessage(
              "Find Similar will use local-only recommendation data in a later prompt.",
            );
            setQuickMenuCardId("");
          }}
          onMove={handleMoveCard}
          onProtect={() =>
            handleUpdateCard(quickMenuCard, {
              protected: !quickMenuCard.protected,
            })
          }
          onRemove={() => handleRemoveCard(quickMenuCard)}
          onReplace={() => {
            openAddCardModal(
              getCardBuilderSection(quickMenuCard),
              "main",
              quickMenuCard,
            );
            setQuickMenuCardId("");
          }}
          onTag={() => {
            openDetail(quickMenuCard);
            setQuickMenuCardId("");
          }}
        />
      ) : null}

      {detailCard ? (
        <CardDetailModal
          analysisImpact={bracketAnalysis.cardImpacts[detailCard.id] ?? 0}
          card={detailCard}
          deck={deck}
          draft={detailDraft}
          onChangeDraft={setDetailDraft}
          onClose={() => setDetailCardId("")}
          onCut={() => setCutModal({ card: detailCard, reason: "" })}
          onMove={handleMoveCard}
          onProtect={() =>
            handleUpdateCard(detailCard, {
              protected: !detailCard.protected,
            })
          }
          onRemove={() => handleRemoveCard(detailCard)}
          onSave={handleSaveDetail}
        />
      ) : null}

      {cutModal ? (
        <CutReasonModal
          cutModal={cutModal}
          onChange={(reason) =>
            setCutModal((current) => (current ? { ...current, reason } : current))
          }
          onClose={() => setCutModal(null)}
          onConfirm={confirmCut}
        />
      ) : null}

      {expandedSection ? (
        <ExpandedSectionPanel
          cards={getCardsForSection(deck, expandedSection, activeTab)}
          deck={deck}
          sectionId={expandedSection}
          tab={activeTab}
          onAdd={() => openAddCardModal(expandedSection)}
          onBack={() => setExpandedSection(null)}
          onCut={(card) => setCutModal({ card, reason: "" })}
          onMove={handleMoveCard}
          onOpenDetail={openDetail}
          onProtect={(card) =>
            handleUpdateCard(card, { protected: !card.protected })
          }
          onRemove={handleRemoveCard}
          onTag={(card) => openDetail(card)}
        />
      ) : null}

      {metadataModal ? (
        <MetadataModalView
          bracketDraft={bracketDraft}
          deck={deck}
          draft={metadataDraft}
          modal={metadataModal}
          onBracketDraft={setBracketDraft}
          onClose={() => setMetadataModal(null)}
          onDelete={handleDeleteDeck}
          onDraft={setMetadataDraft}
          onSubmit={handleMetadataSubmit}
        />
      ) : null}
    </div>
  );
}

function CommanderZone({
  commanderCards,
  deck,
  onAddCommander,
  onFocusCard,
  onOpenDetail,
  onQuickMenu,
}: {
  commanderCards: DeckCard[];
  deck: Deck;
  onAddCommander: () => void;
  onFocusCard: (card: DeckCard) => void;
  onOpenDetail: (card: DeckCard) => void;
  onQuickMenu: (card: DeckCard) => void;
}) {
  return (
    <section
      className={`commander-zone commander-zone--${deck.colorIdentity.join("").toLowerCase() || "colorless"}`}
      aria-label="Commander zone"
    >
      <div className="commander-orbit" aria-hidden="true">
        {["W", "U", "B", "R", "G", "C"].map((color) => (
          <span
            className={
              color === "C"
                ? deck.colorIdentity.length === 0 && commanderCards.length > 0
                  ? "is-active"
                  : ""
                : deck.colorIdentity.includes(color as CommanderColor)
                  ? "is-active"
                  : ""
            }
            data-color={color}
            key={color}
          >
            {color}
          </span>
        ))}
      </div>
      <div className="commander-card-frame">
        <div className="commander-card-frame__inner">
          <p className="builder-kicker">Commander Zone</p>
          {commanderCards.length > 0 ? (
            commanderCards.map((card) => (
              <button
                className="commander-card-button"
                key={card.id}
                onClick={() => {
                  onFocusCard(card);
                  onOpenDetail(card);
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  onQuickMenu(card);
                }}
                type="button"
              >
                <strong>{card.name}</strong>
                <span>{card.typeLine || "Legendary Creature"}</span>
                <small>{formatColorIdentity(card.colorIdentity ?? [])}</small>
              </button>
            ))
          ) : (
            <div className="commander-empty">
              <strong>
                {deck.commanderNames.length > 0
                  ? formatCommanderNames(deck)
                  : "No commander set"}
              </strong>
              <span>Add a commander card to set color identity.</span>
            </div>
          )}
          <button className="secondary-action commander-add" onClick={onAddCommander} type="button">
            <Plus aria-hidden="true" />
            {commanderCards.length > 0 ? "Add Partner" : "Add Commander"}
          </button>
        </div>
      </div>
    </section>
  );
}

function DeckSectionPanel({
  cards,
  deck,
  focusedCardId,
  health,
  isLarge = false,
  onAdd,
  onBeginPress,
  onEndPress,
  onExpand,
  onFocusCard,
  onKeyDown,
  onOpenDetail,
  onQuickMenu,
  sectionId,
}: {
  cards: DeckCard[];
  deck: Deck;
  focusedCardId: string;
  health: SectionHealth;
  isLarge?: boolean;
  onAdd: () => void;
  onBeginPress: (card: DeckCard) => void;
  onEndPress: () => void;
  onExpand: () => void;
  onFocusCard: (card: DeckCard) => void;
  onKeyDown: (event: KeyboardEvent, card: DeckCard) => void;
  onOpenDetail: (card: DeckCard) => void;
  onQuickMenu: (card: DeckCard) => void;
  sectionId: BuilderSectionId;
}) {
  const section = builderSections.find((item) => item.id === sectionId);

  return (
    <section
      className={`builder-section builder-section--${sectionId} builder-section--${health}${isLarge ? " builder-section--large" : ""}`}
      aria-label={section?.label}
    >
      <header className="builder-section__header">
        <div>
          <span className="section-glyph">{section?.glyph}</span>
          <h2>{section?.label}</h2>
        </div>
        <span>{sumQuantities(cards)}</span>
      </header>
      {cards.length === 0 ? (
        <button className="builder-empty-card" onClick={onAdd} type="button">
          <Plus aria-hidden="true" />
          Add {section?.shortLabel}
        </button>
      ) : (
        <div className="builder-card-rail" aria-label={`${section?.label} cards`}>
          {cards.map((card) => (
            <CardTile
              card={card}
              deck={deck}
              focused={focusedCardId === card.id}
              key={card.id}
              onBeginPress={onBeginPress}
              onEndPress={onEndPress}
              onFocus={onFocusCard}
              onKeyDown={onKeyDown}
              onOpenDetail={onOpenDetail}
              onQuickMenu={onQuickMenu}
            />
          ))}
        </div>
      )}
      <footer className="builder-section__footer">
        <button className="secondary-action" onClick={onAdd} type="button">
          <Plus aria-hidden="true" />
          Add
        </button>
        <button className="secondary-action" onClick={onExpand} type="button">
          <Archive aria-hidden="true" />
          Expand
        </button>
      </footer>
    </section>
  );
}

function CardTile({
  card,
  deck,
  focused,
  onBeginPress,
  onEndPress,
  onFocus,
  onKeyDown,
  onOpenDetail,
  onQuickMenu,
}: {
  card: DeckCard;
  deck: Deck;
  focused: boolean;
  onBeginPress: (card: DeckCard) => void;
  onEndPress: () => void;
  onFocus: (card: DeckCard) => void;
  onKeyDown: (event: KeyboardEvent, card: DeckCard) => void;
  onOpenDetail: (card: DeckCard) => void;
  onQuickMenu: (card: DeckCard) => void;
}) {
  const badges = getCardBadges(card.typeLine ?? "");
  const legality = getCardLegalityLabel(deck, card);
  const serious = legality === "Outside color identity" || legality === "Singleton warning";

  return (
    <article
      className={`builder-card-tile${focused ? " is-focused" : ""}${serious ? " is-illegal" : ""}${card.missingQuantity > 0 ? " is-missing" : ""}`}
      onClick={() => onFocus(card)}
      onContextMenu={(event) => {
        event.preventDefault();
        onQuickMenu(card);
      }}
      onKeyDown={(event) => onKeyDown(event, card)}
      onPointerCancel={onEndPress}
      onPointerDown={() => onBeginPress(card)}
      onPointerLeave={onEndPress}
      onPointerUp={onEndPress}
      role="button"
      tabIndex={0}
    >
      <div className="builder-card-art" aria-hidden="true" />
      <strong>{card.name}</strong>
      <span>{card.typeLine || "Card"}</span>
      <div className="builder-card-badges">
        {badges.map((badge) => (
          <small key={badge}>{badge}</small>
        ))}
        {card.protected ? <small>Protected</small> : null}
        {card.missingQuantity > 0 ? <small>Missing</small> : null}
      </div>
      <button
        className="card-detail-button"
        onClick={(event) => {
          event.stopPropagation();
          onOpenDetail(card);
        }}
        type="button"
      >
        <Eye aria-hidden="true" />
        Details
      </button>
    </article>
  );
}

function DeckCountRing({ count }: { count: number }) {
  const percent = Math.min(100, count);

  return (
    <div
      className={`deck-count-ring${count > 100 ? " deck-count-ring--over" : ""}`}
      style={{ "--count-percent": `${percent}%` } as CSSProperties}
      aria-label={`Main deck count ${count} of 100`}
    >
      <div>
        <Layers3 aria-hidden="true" />
        <strong>{count}</strong>
        <span>/ 100</span>
      </div>
    </div>
  );
}

function BracketTracker({
  analysis,
  cardImpact,
}: {
  analysis: ReturnType<typeof analyzeLiveBracket>;
  cardImpact?: number;
}) {
  const selectedValue = bracketValue(analysis.selectedBracket);
  const estimatedValue = bracketValue(analysis.estimatedBracket);

  return (
    <section className={`bracket-tracker bracket-tracker--${analysis.meterTone}`}>
      <header>
        <div>
          <p className="builder-kicker">Live Bracket Tracker</p>
          <h2>{formatBracket(analysis.estimatedBracket)}</h2>
        </div>
        <StatusPill tone="cyan">{`${analysis.confidence} Confidence`}</StatusPill>
      </header>
      <div className="bracket-arc" aria-label="Bracket arc">
        {[1, 2, 3, 4, 5].map((node) => (
          <span
            className={[
              node === estimatedValue ? "is-current" : "",
              node === selectedValue ? "is-lock" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            key={node}
          >
            {node}
          </span>
        ))}
      </div>
      <dl className="bracket-stats">
        <div>
          <dt>Selected Lock</dt>
          <dd>{formatBracket(analysis.selectedBracket)}</dd>
        </div>
        <div>
          <dt>Bracket Drift</dt>
          <dd>{analysis.drift > 0 ? `+${analysis.drift}` : analysis.drift}</dd>
        </div>
        <div>
          <dt>Focused Impact</dt>
          <dd>{cardImpact === undefined ? "None" : cardImpact.toFixed(2)}</dd>
        </div>
      </dl>
      <div className="bracket-factors">
        {analysis.factors.map((factor) => (
          <span className={`factor-chip factor-chip--${factor.tone}`} key={factor.label}>
            {factor.label}: {factor.count}
          </span>
        ))}
      </div>
    </section>
  );
}

function CardFormModal({
  form,
  onChange,
  onClose,
  onSubmit,
  replaceTarget,
  section,
}: {
  form: CardFormState;
  onChange: (form: CardFormState) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  replaceTarget?: DeckCard;
  section: BuilderSectionId;
}) {
  function update(patch: Partial<CardFormState>) {
    onChange({ ...form, ...patch });
  }

  return (
    <ModalFrame
      title={replaceTarget ? `Replace ${replaceTarget.name}` : `Add ${builderSections.find((item) => item.id === section)?.shortLabel}`}
      onClose={onClose}
    >
      <form className="builder-modal-form" onSubmit={onSubmit}>
        <label>
          Card name
          <input
            autoFocus
            value={form.name}
            onChange={(event) => update({ name: event.target.value })}
          />
        </label>
        <div className="form-grid">
          <label>
            Card type line
            <input
              value={form.typeLine}
              onChange={(event) =>
                update({
                  typeLine: event.target.value,
                  requestedSection: classifyCardSection(event.target.value, section),
                })
              }
            />
          </label>
          <label>
            Mana cost
            <input
              placeholder="{2}{G}"
              value={form.manaCost}
              onChange={(event) => update({ manaCost: event.target.value })}
            />
          </label>
        </div>
        <fieldset className="color-picker">
          <legend>Color identity</legend>
          {colorOptions.map((color) => (
            <label className={`color-toggle color-toggle--${color.value.toLowerCase()}`} key={color.value}>
              <input
                checked={form.colorIdentity.includes(color.value)}
                disabled={form.colorless}
                type="checkbox"
                value={color.value}
                onChange={(event) => {
                  const colors = event.target.checked
                    ? [...form.colorIdentity, color.value]
                    : form.colorIdentity.filter((item) => item !== color.value);
                  update({
                    colorIdentity: parseColorIdentityInput(colors),
                    colorless: false,
                  });
                }}
              />
              {color.label}
            </label>
          ))}
          <label className="color-toggle color-toggle--c">
            <input
              checked={form.colorless}
              type="checkbox"
              onChange={(event) =>
                update({
                  colorIdentity: event.target.checked ? [] : form.colorIdentity,
                  colorless: event.target.checked,
                })
              }
            />
            C
          </label>
        </fieldset>
        <div className="form-grid">
          <label>
            Role tags
            <input
              placeholder="ramp, draw, synergy"
              value={form.roleTags}
              onChange={(event) => update({ roleTags: event.target.value })}
            />
          </label>
          <label>
            Custom tags
            <input
              placeholder="favorite, tokens"
              value={form.customTags}
              onChange={(event) => update({ customTags: event.target.value })}
            />
          </label>
        </div>
        <label>
          Oracle text or local rules note
          <textarea
            value={form.oracleText}
            onChange={(event) => update({ oracleText: event.target.value })}
          />
        </label>
        <label>
          Card notes
          <textarea
            value={form.notes}
            onChange={(event) => update({ notes: event.target.value })}
          />
        </label>
        <div className="form-grid">
          <label>
            Destination
            <select
              value={form.destination}
              onChange={(event) =>
                update({ destination: event.target.value as AddDestination })
              }
            >
              <option value="main">Main Deck</option>
              <option value="maybeboard">Maybeboard</option>
              <option value="cuts">Cuts</option>
            </select>
          </label>
          <label className="toggle-row">
            <input
              checked={form.owned}
              type="checkbox"
              onChange={(event) => update({ owned: event.target.checked })}
            />
            Confirmed owned
          </label>
        </div>
        <div className="form-actions">
          <button className="primary-action" type="submit">
            {replaceTarget ? "Replace Card" : "Save Card"}
          </button>
          <button className="secondary-action" onClick={onClose} type="button">
            Cancel
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}

function RuleWarningModal({
  candidates,
  onAddAnyway,
  onCancel,
  onMaybeboard,
  onReplace,
  onReplaceConfirm,
  onReplacementChange,
  pendingWarning,
  ruleMode,
}: {
  candidates: DeckCard[];
  onAddAnyway: () => void;
  onCancel: () => void;
  onMaybeboard: () => void;
  onReplace: () => void;
  onReplaceConfirm: () => void;
  onReplacementChange: (cardId: string) => void;
  pendingWarning: PendingWarningState;
  ruleMode: RuleEnforcementMode;
}) {
  const hasOver100 = pendingWarning.warnings.some(
    (warning) => warning.id === "over-100",
  );

  return (
    <ModalFrame title="Commander Rule Warning" onClose={onCancel}>
      <div className="warning-stack">
        {pendingWarning.warnings.map((warning) => (
          <p className={`rule-warning rule-warning--${warning.severity}`} key={warning.id}>
            {warning.message}
          </p>
        ))}
        {ruleMode === "strict" && pendingWarning.blocked ? (
          <p className="foundation-summary">
            Strict Mode blocks illegal Main Deck additions. Maybeboard and Cuts
            remain available.
          </p>
        ) : null}
        {pendingWarning.showReplacePicker ? (
          <label>
            Replace a card
            <select
              value={pendingWarning.selectedReplacementId}
              onChange={(event) => onReplacementChange(event.target.value)}
            >
              <option value="">Choose a main deck card</option>
              {candidates.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="form-actions">
          {hasOver100 && !pendingWarning.showReplacePicker ? (
            <button className="secondary-action" onClick={onReplace} type="button">
              Replace a Card
            </button>
          ) : null}
          {pendingWarning.showReplacePicker ? (
            <button
              className="primary-action"
              disabled={!pendingWarning.selectedReplacementId}
              onClick={onReplaceConfirm}
              type="button"
            >
              Confirm Replace
            </button>
          ) : null}
          {!pendingWarning.blocked ? (
            <button className="danger-action" onClick={onAddAnyway} type="button">
              Add Anyway
            </button>
          ) : null}
          <button className="secondary-action" onClick={onMaybeboard} type="button">
            Send to Maybeboard
          </button>
          <button className="secondary-action" onClick={onCancel} type="button">
            Cancel
          </button>
        </div>
      </div>
    </ModalFrame>
  );
}

function QuickCardMenu({
  card,
  onClose,
  onCut,
  onDetail,
  onFindSimilar,
  onMove,
  onProtect,
  onRemove,
  onReplace,
  onTag,
}: {
  card: DeckCard;
  onClose: () => void;
  onCut: () => void;
  onDetail: () => void;
  onFindSimilar: () => void;
  onMove: (card: DeckCard, destination: AddDestination) => void;
  onProtect: () => void;
  onRemove: () => void;
  onReplace: () => void;
  onTag: () => void;
}) {
  return (
    <ModalFrame title={card.name} onClose={onClose} compact>
      <div className="quick-menu-grid">
        <button onClick={onDetail} type="button">
          <Eye aria-hidden="true" />
          View Details
        </button>
        <button onClick={() => onMove(card, "maybeboard")} type="button">
          <RotateCcw aria-hidden="true" />
          Move
        </button>
        <button onClick={onReplace} type="button">
          <Copy aria-hidden="true" />
          Replace
        </button>
        <button onClick={onTag} type="button">
          <Tags aria-hidden="true" />
          Tag
        </button>
        <button onClick={onProtect} type="button">
          {card.protected ? <Unlock aria-hidden="true" /> : <Lock aria-hidden="true" />}
          Protect
        </button>
        <button onClick={onCut} type="button">
          <Scissors aria-hidden="true" />
          Cut
        </button>
        <button onClick={onRemove} type="button">
          <Trash2 aria-hidden="true" />
          Remove
        </button>
        <button onClick={onFindSimilar} type="button">
          <Sparkles aria-hidden="true" />
          Find Similar
        </button>
      </div>
    </ModalFrame>
  );
}

function CardDetailModal({
  analysisImpact,
  card,
  deck,
  draft,
  onChangeDraft,
  onClose,
  onCut,
  onMove,
  onProtect,
  onRemove,
  onSave,
}: {
  analysisImpact: number;
  card: DeckCard;
  deck: Deck;
  draft: { roleTags: string; customTags: string; notes: string };
  onChangeDraft: (draft: { roleTags: string; customTags: string; notes: string }) => void;
  onClose: () => void;
  onCut: () => void;
  onMove: (card: DeckCard, destination: AddDestination) => void;
  onProtect: () => void;
  onRemove: () => void;
  onSave: () => void;
}) {
  return (
    <ModalFrame title="Card Detail" onClose={onClose}>
      <div className="card-detail">
        <div className="card-detail__header">
          <div>
            <p className="builder-kicker">{card.manaCost || "No mana cost saved"}</p>
            <h2>{card.name}</h2>
            <p>{card.typeLine || "Type line unavailable"}</p>
          </div>
          <StatusPill tone={card.missingQuantity > 0 ? "violet" : "cyan"}>
            {card.missingQuantity > 0 ? "Missing" : "Owned"}
          </StatusPill>
        </div>
        <dl className="deck-stat-row">
          <div>
            <dt>Color Identity</dt>
            <dd>{formatColorIdentity(card.colorIdentity ?? [])}</dd>
          </div>
          <div>
            <dt>Soft Rule Status</dt>
            <dd>{getCardLegalityLabel(deck, card)}</dd>
          </div>
          <div>
            <dt>Commander Legal Data</dt>
            <dd>{getBannedStatusLabel()}</dd>
          </div>
          <div>
            <dt>Bracket Impact</dt>
            <dd>{analysisImpact.toFixed(2)}</dd>
          </div>
        </dl>
        <div className="oracle-box">
          {card.oracleText || "No oracle or rules text saved locally yet."}
        </div>
        <div className="form-grid">
          <label>
            Role tags
            <input
              value={draft.roleTags}
              onChange={(event) =>
                onChangeDraft({ ...draft, roleTags: event.target.value })
              }
            />
          </label>
          <label>
            Custom tags
            <input
              value={draft.customTags}
              onChange={(event) =>
                onChangeDraft({ ...draft, customTags: event.target.value })
              }
            />
          </label>
        </div>
        <label>
          Notes
          <textarea
            value={draft.notes}
            onChange={(event) =>
              onChangeDraft({ ...draft, notes: event.target.value })
            }
          />
        </label>
        <div className="form-actions">
          <button className="primary-action" onClick={onSave} type="button">
            Save Tags and Notes
          </button>
          <button
            className="secondary-action"
            onClick={() => onMove(card, "main")}
            type="button"
          >
            Add to Main
          </button>
          <button
            className="secondary-action"
            onClick={() => onMove(card, "maybeboard")}
            type="button"
          >
            Add to Maybeboard
          </button>
          <button className="secondary-action" onClick={onCut} type="button">
            Move to Cuts
          </button>
          <button className="secondary-action" onClick={onProtect} type="button">
            {card.protected ? "Unprotect" : "Mark Protected"}
          </button>
          <button className="danger-action" onClick={onRemove} type="button">
            Remove
          </button>
        </div>
      </div>
    </ModalFrame>
  );
}

function CutReasonModal({
  cutModal,
  onChange,
  onClose,
  onConfirm,
}: {
  cutModal: CutModalState;
  onChange: (reason: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalFrame title={`Cut ${cutModal.card.name}`} onClose={onClose}>
      <label>
        Optional cut reason
        <textarea
          value={cutModal.reason}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
      <div className="form-actions">
        <button className="primary-action" onClick={onConfirm} type="button">
          Move to Cuts
        </button>
        <button className="secondary-action" onClick={onClose} type="button">
          Cancel
        </button>
      </div>
    </ModalFrame>
  );
}

function ExpandedSectionPanel({
  cards,
  deck,
  onAdd,
  onBack,
  onCut,
  onMove,
  onOpenDetail,
  onProtect,
  onRemove,
  onTag,
  sectionId,
  tab,
}: {
  cards: DeckCard[];
  deck: Deck;
  onAdd: () => void;
  onBack: () => void;
  onCut: (card: DeckCard) => void;
  onMove: (card: DeckCard, destination: AddDestination) => void;
  onOpenDetail: (card: DeckCard) => void;
  onProtect: (card: DeckCard) => void;
  onRemove: (card: DeckCard) => void;
  onTag: (card: DeckCard) => void;
  sectionId: BuilderSectionId;
  tab: BuilderTab;
}) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("name");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const section = builderSections.find((item) => item.id === sectionId);
  const visibleCards = [...cards]
    .filter((card) =>
      card.name.toLowerCase().includes(search.trim().toLowerCase()),
    )
    .filter((card) => {
      if (filter === "missing") {
        return card.missingQuantity > 0;
      }
      if (filter === "protected") {
        return card.protected;
      }
      if (filter === "warnings") {
        return getCardLegalityLabel(deck, card) !== "No rule warnings";
      }
      return true;
    })
    .sort((left, right) => {
      if (sort === "added") {
        return right.addedAt.localeCompare(left.addedAt);
      }
      if (sort === "missing") {
        return right.missingQuantity - left.missingQuantity;
      }
      return left.name.localeCompare(right.name);
    });

  function selectedCards() {
    return visibleCards.filter((card) => selected.has(card.id));
  }

  return (
    <ModalFrame title={`${section?.label ?? "Section"} - ${tabLabels[tab]}`} onClose={onBack}>
      <div className="expanded-section">
        <header className="expanded-section__header">
          <button className="secondary-action" onClick={onBack} type="button">
            <ArrowLeft aria-hidden="true" />
            Back
          </button>
          <span>{sumQuantities(cards)} cards</span>
        </header>
        <div className="form-grid">
          <label>
            Search Section
            <input value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <label>
            Sort
            <select value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="name">Name</option>
              <option value="added">Recently Added</option>
              <option value="missing">Missing Marker</option>
            </select>
          </label>
          <label>
            Filter
            <select value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="all">All</option>
              <option value="missing">Missing</option>
              <option value="protected">Protected</option>
              <option value="warnings">Rule Warnings</option>
            </select>
          </label>
          <button className="primary-action expanded-add" onClick={onAdd} type="button">
            <Plus aria-hidden="true" />
            Add
          </button>
        </div>
        <div className="expanded-actions">
          <button
            className="secondary-action"
            disabled={selected.size === 0}
            onClick={() => selectedCards().forEach((card) => onMove(card, "maybeboard"))}
            type="button"
          >
            Move
          </button>
          <button
            className="secondary-action"
            disabled={selected.size === 0}
            onClick={() => selectedCards().forEach(onTag)}
            type="button"
          >
            Tag
          </button>
          <button
            className="secondary-action"
            disabled={selected.size === 0}
            onClick={() => selectedCards().forEach(onProtect)}
            type="button"
          >
            Protect
          </button>
          <button
            className="secondary-action"
            disabled={selected.size === 0}
            onClick={() => selectedCards().forEach(onCut)}
            type="button"
          >
            Cut
          </button>
          <button
            className="danger-action"
            disabled={selected.size === 0}
            onClick={() => selectedCards().forEach(onRemove)}
            type="button"
          >
            Remove
          </button>
        </div>
        <div className="expanded-card-grid">
          {visibleCards.length === 0 ? (
            <div className="builder-empty-card">No cards match this section view.</div>
          ) : (
            visibleCards.map((card) => (
              <article className="expanded-card-row" key={card.id}>
                <label className="select-row">
                  <input
                    checked={selected.has(card.id)}
                    type="checkbox"
                    onChange={(event) => {
                      const next = new Set(selected);
                      if (event.target.checked) {
                        next.add(card.id);
                      } else {
                        next.delete(card.id);
                      }
                      setSelected(next);
                    }}
                  />
                  <span>
                    <strong>{card.name}</strong>
                    <small>{card.typeLine || "Card"}</small>
                  </span>
                </label>
                <button className="secondary-action" onClick={() => onOpenDetail(card)} type="button">
                  Details
                </button>
              </article>
            ))
          )}
        </div>
      </div>
    </ModalFrame>
  );
}

function MoreMenu({
  onClose,
  onDelete,
  onDuplicate,
  onMetadata,
  onNavigate,
}: {
  onClose: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMetadata: (type: MetadataModal) => void;
  onNavigate: (to: string) => void;
}) {
  const actions: { label: string; icon: ReactNode; onClick: () => void }[] = [
    { label: "Analyze / Stats", icon: <BarChart3 aria-hidden="true" />, onClick: () => onNavigate("/analyzer") },
    { label: "Deck Goals", icon: <Sparkles aria-hidden="true" />, onClick: () => onMetadata("goals") },
    { label: "Bracket Lock", icon: <Shield aria-hidden="true" />, onClick: () => onMetadata("bracket") },
    { label: "Tags", icon: <Tags aria-hidden="true" />, onClick: () => onNavigate("/tags") },
    {
      label: "Categories",
      icon: <Archive aria-hidden="true" />,
      onClick: () => onNavigate("/tags"),
    },
    { label: "Import Into Deck", icon: <FileInput aria-hidden="true" />, onClick: () => onNavigate("/import") },
    { label: "Export Deck", icon: <Download aria-hidden="true" />, onClick: () => onNavigate("/export") },
    { label: "Duplicate Deck", icon: <Copy aria-hidden="true" />, onClick: onDuplicate },
    { label: "Rename Deck", icon: <NotebookPen aria-hidden="true" />, onClick: () => onMetadata("rename") },
    { label: "Deck Notes", icon: <NotebookPen aria-hidden="true" />, onClick: () => onMetadata("notes") },
    { label: "Settings", icon: <Settings aria-hidden="true" />, onClick: () => onNavigate("/settings") },
    { label: "Delete Deck", icon: <Trash2 aria-hidden="true" />, onClick: onDelete },
  ];

  return (
    <ModalFrame title="More" onClose={onClose} compact>
      <div className="quick-menu-grid">
        {actions.map((action) => (
          <button key={action.label} onClick={action.onClick} type="button">
            {action.icon}
            {action.label}
          </button>
        ))}
      </div>
    </ModalFrame>
  );
}

function MetadataModalView({
  bracketDraft,
  deck,
  draft,
  modal,
  onBracketDraft,
  onClose,
  onDelete,
  onDraft,
  onSubmit,
}: {
  bracketDraft: BracketLock | null;
  deck: Deck;
  draft: string;
  modal: MetadataModal;
  onBracketDraft: (draft: BracketLock) => void;
  onClose: () => void;
  onDelete: () => void;
  onDraft: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (modal === "delete") {
    return (
      <ModalFrame title="Delete Deck" onClose={onClose}>
        <p className="foundation-summary">
          Delete {deck.name} from this local device?
        </p>
        <div className="form-actions">
          <button className="danger-action" onClick={onDelete} type="button">
            Delete Deck
          </button>
          <button className="secondary-action" onClick={onClose} type="button">
            Cancel
          </button>
        </div>
      </ModalFrame>
    );
  }

  return (
    <ModalFrame
      title={
        modal === "rename"
          ? "Rename Deck"
          : modal === "notes"
            ? "Deck Notes"
            : modal === "goals"
              ? "Deck Goals"
              : "Bracket Lock"
      }
      onClose={onClose}
    >
      <form className="builder-modal-form" onSubmit={onSubmit}>
        {modal === "bracket" && bracketDraft ? (
          <>
            <label className="toggle-row">
              <input
                checked={bracketDraft.enabled}
                type="checkbox"
                onChange={(event) =>
                  onBracketDraft({ ...bracketDraft, enabled: event.target.checked })
                }
              />
              Enable bracket lock
            </label>
            <label>
              Selected bracket
              <select
                value={bracketDraft.bracket}
                onChange={(event) =>
                  onBracketDraft({
                    ...bracketDraft,
                    bracket: event.target.value as Bracket,
                  })
                }
              >
                {bracketOptions.map((bracket) => (
                  <option key={bracket} value={bracket}>
                    {formatBracket(bracket)}
                  </option>
                ))}
              </select>
            </label>
            <div className="permission-grid">
              {[
                ["allowCombos", "Allow combos"],
                ["allowTutors", "Allow tutors"],
                ["allowFastMana", "Allow fast mana"],
                ["allowStax", "Allow stax"],
                ["allowMassLandDestruction", "Allow mass land destruction"],
                ["allowExtraTurns", "Allow extra turns"],
              ].map(([key, label]) => (
                <label className="toggle-row" key={key}>
                  <input
                    checked={Boolean(bracketDraft[key as keyof BracketLock])}
                    type="checkbox"
                    onChange={(event) =>
                      onBracketDraft({
                        ...bracketDraft,
                        [key]: event.target.checked,
                      })
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          </>
        ) : (
          <label>
            {modal === "rename"
              ? "Deck name"
              : modal === "goals"
                ? "Goals"
                : "Notes"}
            {modal === "rename" ? (
              <input value={draft} onChange={(event) => onDraft(event.target.value)} />
            ) : (
              <textarea value={draft} onChange={(event) => onDraft(event.target.value)} />
            )}
          </label>
        )}
        <div className="form-actions">
          <button className="primary-action" type="submit">
            Save Locally
          </button>
          <button className="secondary-action" onClick={onClose} type="button">
            Cancel
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}

function ModalFrame({
  children,
  compact = false,
  onClose,
  title,
}: {
  children: ReactNode;
  compact?: boolean;
  onClose: () => void;
  title: string;
}) {
  return (
    <div className="builder-modal-backdrop" role="presentation">
      <section
        aria-labelledby="builder-modal-title"
        className={`builder-modal${compact ? " builder-modal--compact" : ""}`}
        role="dialog"
      >
        <header className="builder-modal__header">
          <h2 id="builder-modal-title">{title}</h2>
          <button aria-label="Close" onClick={onClose} type="button">
            <X aria-hidden="true" />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
