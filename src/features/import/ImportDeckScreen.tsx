import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  PackageOpen,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { HolographicPanel } from "../../components/HolographicPanel";
import { PageHeader } from "../../components/PageHeader";
import { StatusPill } from "../../components/StatusPill";
import { useSettings } from "../../app/useSettings";
import { useDecks, useOwnedCards } from "../../db/hooks";
import {
  addDeckCard,
  createBlankCommanderDeck,
  createDeckCardFromInput,
  saveImportResult,
  updateDeckCard,
  updateDeckMetadata,
} from "../../db/repositories";
import { formatCurrency, summarizeDeckValue } from "../../collector";
import type { Deck, DeckGoal } from "../../types/domain";
import { createId, nowIso } from "../../utils/ids";
import { catalogCardToManualInput } from "../cards/cardSearch";
import { isCommanderEligible } from "../cards/searchDestinations";
import { analyzeLiveBracket, formatBracket } from "../decks/bracketAnalysis";
import type { AddDestination, BuilderSectionId, ManualCardInput } from "../decks/builderTypes";
import {
  importTextFileName,
  parseCsvDecklist,
  parseDecklistText,
  parseStructuredDeckImport,
  parseZipDeckImport,
  sanitizeImportedText,
  textToBytes,
  type ParsedDeckImport,
  type ParsedImportSection,
} from "./importParser";
import {
  classifyImportOwnership,
  resolveDeckImportEntries,
  resolveImportEntry,
  type ImportResolvedEntry,
} from "./importResolution";

const maxTextImportBytes = 2_000_000;
const maxZipImportBytes = 8_000_000;
const decklistPlaceholder = `Commander
1 Anim Pakal, Thousandth Moon

Deck
1 Sol Ring
1 Arcane Signet
1 Command Tower
1 Lightning Bolt

Maybeboard
1 Swords to Plowshares`;

type ImportMethod = "paste" | "file" | "json" | "csv";

const importMethods: { id: ImportMethod; label: string; detail: string }[] = [
  {
    id: "paste",
    label: "Paste decklist",
    detail: "Plain text and MTG Arena Commander or 60-card lists.",
  },
  {
    id: "file",
    label: "File import",
    detail: ".txt, .json, .csv, and Deck Nexus ZIP packages.",
  },
  {
    id: "json",
    label: "Structured JSON",
    detail: "Deck Nexus exports, backups, snapshots, and shared-contract packages.",
  },
  {
    id: "csv",
    label: "CSV",
    detail: "Rows with quantity, name, set, collector number, and section.",
  },
];

function sectionToDestination(section: ParsedImportSection): AddDestination {
  if (section === "maybeboard") return "maybeboard";
  if (section === "cuts") return "cuts";
  return "main";
}

function sectionToRequestedSection(
  section: ParsedImportSection,
  isCommander: boolean,
  input?: Pick<ManualCardInput, "typeLine">,
): BuilderSectionId | undefined {
  if (isCommander || section === "commander") return "commander";
  if (input?.typeLine?.toLowerCase().includes("land")) return "lands";
  return undefined;
}

function ownershipQuantity(entry: ImportResolvedEntry): number {
  if (entry.ownershipStatus === "not_owned") return 0;
  if (entry.ownershipStatus === "partially_owned") return Math.max(1, entry.quantity - 1);
  return entry.quantity;
}

function ownershipLabel(status: ImportResolvedEntry["ownershipStatus"]): string {
  return status
    .replaceAll("_", " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function formatDetectedFormat(format: ParsedDeckImport["format"]): string {
  return format.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function createManualInputFromEntry(
  entry: ImportResolvedEntry,
  selectedCommanderIds: ReadonlySet<string>,
): ManualCardInput {
  const destination = sectionToDestination(entry.section);
  const isCommander = selectedCommanderIds.has(entry.id) || entry.section === "commander";
  const ownedQuantity = ownershipQuantity(entry);

  if (entry.card) {
    return {
      ...catalogCardToManualInput({
        card: {
          id: entry.card.id,
          scryfallId: entry.card.id,
          oracleId: entry.card.oracleId,
          name: entry.card.name,
          manaCost: entry.card.manaCost,
          manaValue: entry.card.manaValue,
          typeLine: entry.card.typeLine,
          oracleText: entry.card.oracleText ?? "",
          colorIdentity: entry.card.colorIdentity,
          roles: ["import"],
          commanderLegal: entry.card.legalities?.commander === "legal",
          banned: entry.card.legalities?.commander === "banned",
          bracketImpact: 0,
          isCommanderCandidate: isCommanderEligible(entry.card),
          keywords: entry.card.keywords ?? [],
        },
        ownedQuantity,
        destination,
        requestedSection: sectionToRequestedSection(entry.section, isCommander, entry.card),
      }),
      scryfallId: entry.card.id,
      oracleId: entry.card.oracleId,
      imageUri: entry.card.imageUris?.normal ?? entry.card.imageUris?.large ?? entry.card.imageUris?.small,
      setCode: entry.card.setCode,
      setName: entry.card.setName,
      collectorNumber: entry.card.collectorNumber,
      legalities: entry.card.legalities,
      prices: entry.card.prices,
      priceUpdatedAt: entry.card.prices?.fetchedAt,
      finish: entry.card.foil && !entry.card.nonfoil ? "foil" : "nonfoil",
      language: entry.card.lang,
      condition: "unknown",
      rarity: entry.card.rarity,
      releasedAt: entry.card.releasedAt,
      roleTags: ["import", ...(entry.section === "companion" ? ["companion"] : [])],
      notes: entry.exactPrinting
        ? "Imported with exact set and collector number."
        : "Imported by card identity; printing can be selected later.",
    };
  }

  if (entry.catalogCard) {
    return {
      ...catalogCardToManualInput({
        card: entry.catalogCard,
        ownedQuantity,
        destination,
        requestedSection: sectionToRequestedSection(entry.section, isCommander, entry.catalogCard),
      }),
      roleTags: ["import", ...entry.catalogCard.roles],
      notes: "Imported from local cached card data.",
    };
  }

  return {
    name: entry.name,
    typeLine: isCommander ? "Commander" : "Imported unresolved card",
    oracleText: "Unresolved import entry preserved from decklist.",
    colorIdentity: [],
    setCode: entry.setCode,
    collectorNumber: entry.collectorNumber,
    roleTags: ["import", "unresolved", ...(entry.section === "companion" ? ["companion"] : [])],
    customTags: [],
    notes: `Original import line: ${entry.originalLine}`,
    owned: false,
    destination,
    requestedSection: sectionToRequestedSection(entry.section, isCommander),
  };
}

function buildPreviewDeck({
  deckName,
  entries,
  selectedCommanderIds,
  goals,
}: {
  deckName: string;
  entries: readonly ImportResolvedEntry[];
  selectedCommanderIds: ReadonlySet<string>;
  goals: readonly DeckGoal[];
}): Deck {
  const now = nowIso();
  const cards = entries
    .filter((entry) => !entry.removed)
    .map((entry) => {
      const input = createManualInputFromEntry(entry, selectedCommanderIds);
      const card = createDeckCardFromInput("import-preview", input, sectionToDestination(entry.section));
      return {
        ...card,
        id: entry.id,
        quantity: entry.quantity,
        missingQuantity: Math.max(0, entry.quantity - ownershipQuantity(entry)),
      };
    });
  const commanderCards = cards.filter((card) => card.section === "commander");

  return {
    id: "import-preview",
    name: deckName,
    format: "commander",
    commanderIds: commanderCards.map((card) => card.id),
    commanderNames: commanderCards.map((card) => card.name),
    colorIdentity: commanderCards
      .flatMap((card) => card.colorIdentity ?? [])
      .filter((color, index, colors) => colors.indexOf(color) === index),
    cards: cards.filter((card) => card.section === "main" || card.section === "commander"),
    maybeboard: cards.filter((card) => card.section === "maybeboard"),
    cuts: cards.filter((card) => card.section === "cuts"),
    goals: [...goals],
    tags: [],
    style: "unspecified",
    powerTarget: 5,
    bracketLock: {
      enabled: false,
      bracket: "bracket_3",
      allowCombos: true,
      allowTutors: true,
      allowFastMana: true,
      allowStax: true,
      allowMassLandDestruction: false,
      allowExtraTurns: true,
    },
    ownershipPreference: "allow_missing",
    categoryStyle: "commander_roles",
    notes: "",
    status: "draft",
    originalImportText: "",
    unresolvedImports: entries.filter((entry) => entry.status === "unresolved" && !entry.removed).map((entry) => entry.originalLine),
    createdFrom: "deck_import",
    createdAt: now,
    updatedAt: now,
  };
}

function goalsFromText(value: string): DeckGoal[] {
  return value
    .split(/\r?\n|,/)
    .map((goal) => sanitizeImportedText(goal, ""))
    .filter(Boolean)
    .map((goal, index) => ({
      id: createId("goal"),
      name: goal,
      priority: index + 1,
      type: "custom",
      settings: {},
    }));
}

function parseSourceByMethod(method: ImportMethod, source: string, deckName: string): ParsedDeckImport {
  if (method === "json" || source.trim().startsWith("{")) {
    return parseStructuredDeckImport(source, { deckName });
  }
  if (method === "csv") {
    return parseCsvDecklist(source, { deckName });
  }
  return parseDecklistText(source, { deckName });
}

export function ImportDeckScreen() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { decks } = useDecks();
  const { ownedCards } = useOwnedCards();
  const [method, setMethod] = useState<ImportMethod>("paste");
  const [sourceText, setSourceText] = useState("");
  const [sourceName, setSourceName] = useState("Pasted decklist");
  const [deckName, setDeckName] = useState("Imported Deck");
  const [goalsText, setGoalsText] = useState("");
  const [parsed, setParsed] = useState<ParsedDeckImport | null>(null);
  const [resolvedEntries, setResolvedEntries] = useState<ImportResolvedEntry[]>([]);
  const [selectedCommanderIds, setSelectedCommanderIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [resolving, setResolving] = useState(false);
  const [committing, setCommitting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const reviewAnchorRef = useRef<HTMLDivElement | null>(null);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    if (!parsed || resolving) {
      return;
    }

    if (navigator.userAgent.toLowerCase().includes("jsdom")) {
      return;
    }

    window.requestAnimationFrame(() => {
      const anchor = reviewAnchorRef.current;
      if (!anchor) {
        return;
      }

      try {
        window.scrollTo({
          top: Math.max(anchor.getBoundingClientRect().top + window.scrollY - 88, 0),
          behavior: "auto",
        });
      } catch {
        if (typeof anchor.scrollIntoView === "function") {
          anchor.scrollIntoView({ block: "start", behavior: "auto" });
        }
      }
    });
  }, [parsed, resolving]);

  const goals = useMemo(() => goalsFromText(goalsText), [goalsText]);
  const previewDeck = useMemo(
    () =>
      resolvedEntries.length > 0
        ? buildPreviewDeck({
            deckName,
            entries: resolvedEntries,
            selectedCommanderIds,
            goals,
          })
        : null,
    [deckName, goals, resolvedEntries, selectedCommanderIds],
  );
  const bracket = useMemo(() => (previewDeck ? analyzeLiveBracket(previewDeck) : null), [previewDeck]);
  const valueSummary = useMemo(
    () => (previewDeck ? summarizeDeckValue(previewDeck, ownedCards, settings.collectorCurrency) : null),
    [ownedCards, previewDeck, settings.collectorCurrency],
  );
  const activeEntries = resolvedEntries.filter((entry) => !entry.removed);
  const unresolvedCount = activeEntries.filter((entry) => entry.status === "unresolved").length;
  const ambiguousCount = activeEntries.filter((entry) => entry.status === "ambiguous").length;
  const duplicateCount = activeEntries.filter((entry) => entry.duplicateCount > 1).length;
  const totalQuantity = activeEntries.reduce((total, entry) => total + entry.quantity, 0);
  const similarDeck = decks.find(
    (deck) =>
      deck.name.trim().toLowerCase() === deckName.trim().toLowerCase() &&
      deck.cards.length + deck.maybeboard.length + deck.cuts.length === activeEntries.length,
  );

  async function parseAndResolve(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setError("");
    setMessage("");
    abortRef.current?.abort();
    const source = sourceText.trim();

    if (!source) {
      setError("Paste a decklist or choose an import file first.");
      return;
    }

    if (textToBytes(source).byteLength > maxTextImportBytes) {
      setError("Import file is too large for safe text parsing.");
      return;
    }

    const nextParsed = parseSourceByMethod(method, source, deckName);
    setParsed(nextParsed);
    setDeckName(nextParsed.deckName);

    if (nextParsed.errors.length > 0) {
      setResolvedEntries([]);
      setError(nextParsed.errors.join(" "));
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setResolving(true);

    try {
      const resolved = await resolveDeckImportEntries(nextParsed.entries, ownedCards, controller.signal);
      const explicitCommanders = resolved.filter((entry) => entry.section === "commander");
      setResolvedEntries(resolved);
      setSelectedCommanderIds(new Set(explicitCommanders.map((entry) => entry.id)));
      setMessage(
        resolved.some((entry) => entry.status === "unresolved" || entry.status === "ambiguous")
          ? "Import review is ready with entries requiring review."
          : "Import review is ready.",
      );
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Card resolution failed.");
    } finally {
      setResolving(false);
    }
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");
    setMessage("");
    setSourceName(file.name);
    setDeckName(importTextFileName(file.name));

    const isZip = /\.zip$/i.test(file.name) || file.type === "application/zip";
    const limit = isZip ? maxZipImportBytes : maxTextImportBytes;
    if (file.size > limit) {
      setError("Import file is too large.");
      return;
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (isZip) {
      const nextParsed = parseZipDeckImport(bytes);
      setMethod("file");
      setSourceText(nextParsed.sourceText);
      setParsed(nextParsed);
      setDeckName(nextParsed.deckName);
      if (nextParsed.errors.length > 0) {
        setError(nextParsed.errors.join(" "));
        return;
      }
      const resolved = await resolveDeckImportEntries(nextParsed.entries, ownedCards);
      setResolvedEntries(resolved);
      setSelectedCommanderIds(new Set(resolved.filter((entry) => entry.section === "commander").map((entry) => entry.id)));
      setMessage("ZIP package parsed for import review.");
      return;
    }

    const text = new TextDecoder().decode(bytes);
    setSourceText(text);
    if (/\.json$/i.test(file.name) || file.type === "application/json") setMethod("json");
    else if (/\.csv$/i.test(file.name) || file.type === "text/csv") setMethod("csv");
    else setMethod("paste");
  }

  function updateEntry(entryId: string, patch: Partial<ImportResolvedEntry>) {
    setResolvedEntries((current) =>
      current.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              ...patch,
              ownershipStatus: classifyImportOwnership({ ...entry, ...patch }, ownedCards, patch.card ?? entry.card, patch.catalogCard ?? entry.catalogCard),
            }
          : entry,
      ),
    );
  }

  async function retryResolution(entry: ImportResolvedEntry) {
    setError("");
    setMessage("");
    const nextEntry = await resolveImportEntry(entry, ownedCards);
    updateEntry(entry.id, {
      ...nextEntry,
      id: entry.id,
      name: nextEntry.name,
      removed: false,
      keepUnresolved: nextEntry.status === "unresolved",
    });
    setMessage(`${entry.name} resolution retried.`);
  }

  function toggleCommander(entryId: string) {
    setSelectedCommanderIds((current) => {
      const next = new Set(current);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  }

  async function commitImport() {
    if (committing || !previewDeck) {
      return;
    }

    setCommitting(true);
    setError("");
    setMessage("");

    try {
      const deck = await createBlankCommanderDeck({
        name: sanitizeImportedText(deckName, "Imported Deck"),
        commanderName: activeEntries
          .filter((entry) => selectedCommanderIds.has(entry.id) || entry.section === "commander")
          .map((entry) => entry.card?.name ?? entry.catalogCard?.name ?? entry.name)
          .join(" / "),
        goals: goals.map((goal) => goal.name),
        ownershipPreference: "allow_missing",
      });
      let latestDeck = deck;

      for (const entry of activeEntries) {
        const input = createManualInputFromEntry(entry, selectedCommanderIds);
        const beforeIds = new Set([...latestDeck.cards, ...latestDeck.maybeboard, ...latestDeck.cuts].map((card) => card.id));
        latestDeck = await addDeckCard(latestDeck.id, input, sectionToDestination(entry.section));
        const added = [...latestDeck.cards, ...latestDeck.maybeboard, ...latestDeck.cuts].find((card) => !beforeIds.has(card.id));
        if (added && entry.quantity !== 1) {
          latestDeck = await updateDeckCard(latestDeck.id, added.id, {
            quantity: entry.quantity,
            missingQuantity: Math.max(0, entry.quantity - ownershipQuantity(entry)),
          });
        }
      }

      const unresolvedImports = activeEntries
        .filter((entry) => entry.status === "unresolved" || entry.keepUnresolved)
        .map((entry) => entry.originalLine);
      latestDeck = await updateDeckMetadata(latestDeck.id, {
        createdFrom: "deck_import",
        originalImportText: sourceText,
        unresolvedImports,
      });
      await saveImportResult({
        id: createId("import"),
        deckId: latestDeck.id,
        sourceName,
        status: unresolvedImports.length > 0 || ambiguousCount > 0 ? "needs_review" : "resolved",
        originalText: sourceText,
        resolvedCards: [...latestDeck.cards, ...latestDeck.maybeboard, ...latestDeck.cuts],
        unresolvedImports,
        createdAt: nowIso(),
      });

      navigate(`/deck-builder/${latestDeck.id}`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Imported deck could not be saved.");
    } finally {
      setCommitting(false);
    }
  }

  return (
    <section className="screen feature-screen import-screen">
      <PageHeader title="Import Deck">
        <StatusPill tone="cyan">Review before save</StatusPill>
      </PageHeader>

      <div className="import-layout">
        <HolographicPanel className="import-source-panel">
          <form className="feature-form" onSubmit={(event) => void parseAndResolve(event)}>
            <div className="import-method-grid" role="tablist" aria-label="Import method">
              {importMethods.map((candidate) => (
                <button
                  type="button"
                  className={method === candidate.id ? "is-active" : ""}
                  key={candidate.id}
                  onClick={() => setMethod(candidate.id)}
                >
                  <strong>{candidate.label}</strong>
                  <span>{candidate.detail}</span>
                </button>
              ))}
            </div>

            <div className="feature-controls import-controls">
              <label>
                Deck name
                <input value={deckName} onChange={(event) => setDeckName(event.target.value)} />
              </label>
              <label>
                Import file
                <span className="file-action">
                  <Upload aria-hidden="true" /> Choose File
                  <input
                    aria-label="Choose import file"
                    accept=".txt,.json,.csv,.zip,text/plain,application/json,text/csv,application/zip"
                    onChange={(event) => void handleFile(event)}
                    type="file"
                  />
                </span>
              </label>
            </div>

            <label>
              Decklist source
              <textarea
                className="import-textarea"
                onChange={(event) => setSourceText(event.target.value)}
                placeholder={decklistPlaceholder}
                spellCheck={false}
                value={sourceText}
              />
            </label>

            <label>
              Deck goals after import
              <textarea
                className="import-goals"
                onChange={(event) => setGoalsText(event.target.value)}
                placeholder="Optional. One goal per line."
                value={goalsText}
              />
            </label>

            {error ? (
              <p className="form-error" role="alert">
                <AlertCircle aria-hidden="true" /> {error}
              </p>
            ) : null}
            {message ? (
              <p className="feature-status" role="status">
                <CheckCircle2 aria-hidden="true" /> {message}
              </p>
            ) : null}

            <div className="form-actions">
              <button className="primary-action" disabled={resolving} type="submit">
                <FileText aria-hidden="true" /> {resolving ? "Resolving Cards" : "Parse and Review"}
              </button>
              <Link className="secondary-action" to="/">
                Return Home
              </Link>
            </div>
          </form>
        </HolographicPanel>

        <div className="import-review-anchor" ref={reviewAnchorRef}>
        <HolographicPanel className="import-review-panel" data-testid="import-review">
          <div className="import-panel-heading">
            <PackageOpen aria-hidden="true" />
            <div>
              <h2>Import Review</h2>
              <p>No deck is saved until Import Deck is confirmed.</p>
            </div>
          </div>

          {parsed ? (
            <>
              <dl className="import-summary-grid">
                <div>
                  <dt>Detected format</dt>
                  <dd>{formatDetectedFormat(parsed.format)}</dd>
                </div>
                <div>
                  <dt>Total cards</dt>
                  <dd>{totalQuantity}</dd>
                </div>
                <div>
                  <dt>Unique entries</dt>
                  <dd>{activeEntries.length}</dd>
                </div>
                <div>
                  <dt>Resolved</dt>
                  <dd>{activeEntries.filter((entry) => entry.status === "resolved").length}</dd>
                </div>
                <div>
                  <dt>Needs review</dt>
                  <dd>{unresolvedCount + ambiguousCount}</dd>
                </div>
                <div>
                  <dt>Duplicates merged</dt>
                  <dd>{duplicateCount}</dd>
                </div>
                <div>
                  <dt>Estimated value</dt>
                  <dd>{formatCurrency(valueSummary?.totalEstimatedValue, valueSummary?.currency)}</dd>
                </div>
                <div>
                  <dt>Cards without price</dt>
                  <dd>{valueSummary?.missingPriceCount ?? 0}</dd>
                </div>
                <div>
                  <dt>Local bracket estimate</dt>
                  <dd>{bracket ? formatBracket(bracket.estimatedBracket) : "Pending"}</dd>
                </div>
              </dl>

              {parsed.warnings.length > 0 || similarDeck ? (
                <div className="import-warning-list">
                  {similarDeck ? <span>A similar deck already exists; importing again will create a new deck ID.</span> : null}
                  {parsed.warnings.map((warning) => (
                    <span key={warning}>{warning}</span>
                  ))}
                </div>
              ) : null}

              <div className="import-entry-list" aria-label="Imported cards requiring review">
                {activeEntries.length === 0 ? (
                  <p className="foundation-summary">Parse a decklist to review cards before saving.</p>
                ) : (
                  activeEntries.map((entry) => {
                    const displayName = entry.card?.name ?? entry.catalogCard?.name ?? entry.name;
                    const commanderEligible = entry.card ? isCommanderEligible(entry.card) : entry.catalogCard?.isCommanderCandidate;
                    return (
                      <article
                        className={`import-entry import-entry--${entry.status}`}
                        key={entry.id}
                      >
                        <div className="import-entry__main">
                          <strong>{displayName}</strong>
                          <span>
                            {entry.quantity}x {entry.section}
                            {entry.setCode ? ` - ${entry.setCode.toUpperCase()}${entry.collectorNumber ? ` ${entry.collectorNumber}` : ""}` : ""}
                          </span>
                          <small>
                            {entry.status === "resolved"
                              ? entry.exactPrinting
                                ? "Exact printing resolved"
                                : "Card identity resolved; printing can be selected later"
                              : entry.status === "ambiguous"
                                ? "Possible fuzzy match; review before import"
                                : "Unresolved entry will be preserved if imported"}
                          </small>
                          <small>{ownershipLabel(entry.ownershipStatus)}</small>
                        </div>

                        <div className="import-entry__controls">
                          <label>
                            Edit name
                            <input
                              aria-label={`Edit ${entry.name}`}
                              value={entry.name}
                              onChange={(event) =>
                                updateEntry(entry.id, {
                                  name: sanitizeImportedText(event.target.value, entry.name),
                                  status: "unresolved",
                                  card: undefined,
                                  catalogCard: undefined,
                                })
                              }
                            />
                          </label>
                          <label className="toggle-row import-entry__toggle">
                            <input
                              checked={selectedCommanderIds.has(entry.id)}
                              disabled={!commanderEligible && entry.status !== "unresolved"}
                              onChange={() => toggleCommander(entry.id)}
                              type="checkbox"
                            />
                            <span>Commander</span>
                          </label>
                          <label className="toggle-row import-entry__toggle">
                            <input
                              checked={entry.keepUnresolved}
                              disabled={entry.status !== "unresolved"}
                              onChange={(event) => updateEntry(entry.id, { keepUnresolved: event.target.checked })}
                              type="checkbox"
                            />
                            <span>Keep unresolved</span>
                          </label>
                        </div>

                        <div className="import-entry__actions">
                          <button type="button" onClick={() => void retryResolution(entry)}>
                            <RefreshCw aria-hidden="true" /> Retry Resolution
                          </button>
                          <Link
                            to={`/search?context=import&importLine=${encodeURIComponent(entry.originalLine)}&q=${encodeURIComponent(entry.name)}`}
                          >
                            <Search aria-hidden="true" /> Search Replacement
                          </Link>
                          <button type="button" onClick={() => updateEntry(entry.id, { removed: true })}>
                            <Trash2 aria-hidden="true" /> Remove
                          </button>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>

              <div className="form-actions import-commit-actions">
                <button
                  className="primary-action"
                  disabled={committing || activeEntries.length === 0}
                  onClick={() => void commitImport()}
                  type="button"
                >
                  <CheckCircle2 aria-hidden="true" /> {committing ? "Importing Deck" : "Import Deck"}
                </button>
              </div>
            </>
          ) : (
            <p className="foundation-summary">
              Paste or choose a file, then parse it to review commanders, unresolved cards,
              ownership, local bracket guidance, and collector values before saving.
            </p>
          )}
        </HolographicPanel>
        </div>
      </div>
    </section>
  );
}
