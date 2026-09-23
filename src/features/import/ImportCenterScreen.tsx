import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  History,
  LibraryBig,
  RefreshCw,
  Undo2,
  Upload,
} from "lucide-react";
import { HolographicPanel } from "../../components/HolographicPanel";
import { PageHeader } from "../../components/PageHeader";
import { StatusPill } from "../../components/StatusPill";
import { listCollectionImports, listOwnedCards } from "../../db/repositories";
import type { CollectionImport } from "../../types/domain";
import {
  detectCollectionImportFormat,
  parseCollectionSource,
  type ParsedDeckImport,
} from "./importParser";
import { resolveDeckImportEntries, type ImportResolvedEntry } from "./importResolution";
import { applyCollectionImport, undoCollectionImport } from "./collectionImportService";

type ImportStrategy = CollectionImport["strategy"];

const sourceOptions = [
  ["auto", "Auto-detect", "CSV, text, JSON, Arena, or a Deck Nexus package"],
  ["csv", "Collection CSV", "Moxfield, Archidekt, ManaBox, Dragon Shield, TCGplayer, Deckbox, Deckstats"],
  ["text", "Plain text", "Scryfall, MTGGoldfish, Arena, and decklist exports"],
  ["json", "JSON", "Structured collection or deck exports"],
  ["zip", "Deck Nexus package", "Restore a local JSON or ZIP export"],
] as const;

function formatLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusLabel(entry: ImportResolvedEntry) {
  if (entry.status === "resolved") return entry.exactPrinting ? "Resolved · printing matched" : "Resolved · printing unknown";
  if (entry.status === "ambiguous") return "Needs review";
  return "Unmatched";
}

export function ImportCenterScreen() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [sourceMode, setSourceMode] = useState<(typeof sourceOptions)[number][0]>("auto");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileBytes, setFileBytes] = useState<Uint8Array>();
  const [parsed, setParsed] = useState<ParsedDeckImport>();
  const [entries, setEntries] = useState<ImportResolvedEntry[]>([]);
  const [strategy, setStrategy] = useState<ImportStrategy>("merge");
  const [folderName, setFolderName] = useState("Imported Collection");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<CollectionImport[]>([]);
  const [lastResult, setLastResult] = useState<{ imported: number; unresolved: number }>();
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);

  async function refreshHistory() {
    setHistory(await listCollectionImports());
  }

  useEffect(() => {
    void Promise.resolve().then(refreshHistory);
  }, []);

  const summary = useMemo(() => {
    const resolved = entries.filter((entry) => entry.status === "resolved" && !entry.removed);
    const unresolved = entries.filter((entry) => entry.status !== "resolved" || entry.removed);
    const quantity = entries.reduce((total, entry) => total + (entry.removed ? 0 : entry.quantity), 0);
    return { resolved, unresolved, quantity };
  }, [entries]);

  async function readFile(file: File) {
    setFileName(file.name);
    const bytes = new Uint8Array(await file.arrayBuffer());
    setFileBytes(bytes);
    setText(file.name.toLowerCase().endsWith(".zip") ? "" : new TextDecoder().decode(bytes));
    setParsed(undefined);
    setEntries([]);
    setMessage(`${file.name} is ready to preview.`);
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void readFile(file);
  }

  async function previewImport() {
    if (!text.trim() && !fileBytes) {
      setMessage("Choose a file or paste a collection before previewing.");
      return;
    }
    setBusy(true);
    setMessage("Parsing collection...");
    try {
      const detected = sourceMode === "csv" ? "csv" : sourceMode === "json" ? "json" : sourceMode === "zip" ? "zip_package" : undefined;
      const nextParsed = detected === "csv"
        ? parseCollectionSource(text, { fileName: `${fileName || "collection"}.csv` })
        : detected === "json"
          ? parseCollectionSource(text, { fileName: `${fileName || "collection"}.json` })
          : detected === "zip_package"
            ? parseCollectionSource(text, { fileName: fileName || "collection.zip", bytes: fileBytes })
            : parseCollectionSource(text, { fileName });
      setParsed(nextParsed);
      if (nextParsed.errors.length > 0) {
        setEntries([]);
        setMessage(nextParsed.errors.join(" "));
        return;
      }
      const currentOwned = await listOwnedCards();
      const resolved = await resolveDeckImportEntries(nextParsed.entries, currentOwned);
      setEntries(resolved);
      setMessage(`${resolved.length} unique entries are ready for review.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The import could not be previewed.");
    } finally {
      setBusy(false);
    }
  }

  async function commitImport() {
    if (!parsed || summary.resolved.length === 0 || (strategy === "replace" && !replaceConfirmed)) return;
    setBusy(true);
    setMessage("Importing recognized cards...");
    try {
      const result = await applyCollectionImport({
        entries,
        sourceName: fileName || "Pasted collection",
        detectedFormat: detectCollectionImportFormat(text, fileName),
        strategy,
        folderName: strategy === "folder" ? folderName : undefined,
        originalText: text,
      });
      setLastResult({ imported: result.imported, unresolved: result.unresolved });
      setMessage(`${result.imported} cards imported. ${result.unresolved} entries remain for review.`);
      setParsed(undefined);
      setEntries([]);
      setText("");
      setFileName("");
      setFileBytes(undefined);
      setReplaceConfirmed(false);
      await refreshHistory();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The collection could not be imported.");
    } finally {
      setBusy(false);
    }
  }

  async function undoImport(record: CollectionImport) {
    setBusy(true);
    try {
      await undoCollectionImport(record);
      setMessage(`Undid ${record.sourceName}.`);
      await refreshHistory();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "This import could not be undone.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="screen feature-screen import-screen">
      <PageHeader title="Import Center">
        <StatusPill tone="cyan"><LibraryBig aria-hidden="true" /> Collection first</StatusPill>
      </PageHeader>

      <div className="import-layout">
        <HolographicPanel className="import-source-panel">
          <div className="import-panel-heading">
            <Upload aria-hidden="true" />
            <div>
              <h2>Bring your collection into Deck Nexus</h2>
              <p>Import from the tools and marketplaces you already use. Your cards are matched to canonical Scryfall records before they enter your collection.</p>
            </div>
          </div>
          <div className="import-method-grid" role="tablist" aria-label="Import source">
            {sourceOptions.map(([id, label, detail]) => (
              <button className={sourceMode === id ? "is-active" : ""} key={id} onClick={() => setSourceMode(id)} role="tab" type="button">
                <strong>{label}</strong><span>{detail}</span>
              </button>
            ))}
          </div>
          <input accept=".csv,.txt,.json,.zip,text/csv,text/plain,application/json,application/zip" className="visually-hidden" onChange={handleFile} ref={fileRef} type="file" />
          <div className="import-controls feature-controls">
            <button className="primary-action" onClick={() => fileRef.current?.click()} type="button"><Upload aria-hidden="true" /> Choose file</button>
            <label>Import strategy<select onChange={(event) => setStrategy(event.target.value as ImportStrategy)} value={strategy}><option value="merge">Merge with my collection</option><option value="replace">Replace my collection</option><option value="folder">Import as a new folder</option></select></label>
            {strategy === "folder" ? <label>Folder name<input onChange={(event) => setFolderName(event.target.value)} value={folderName} /></label> : null}
          </div>
          {strategy === "replace" ? <label className="toggle-row import-replace-warning"><input checked={replaceConfirmed} onChange={(event) => setReplaceConfirmed(event.target.checked)} type="checkbox" /><span>Replace requires confirmation. Existing owned cards will be backed up for Undo.</span></label> : null}
          <label>Paste a collection or decklist<textarea className="import-textarea" onChange={(event) => setText(event.target.value)} placeholder="4 Sol Ring\n2 Arcane Signet\n1 Command Tower" value={text} /></label>
          {fileName ? <p className="import-file-note">File selected: {fileName}</p> : null}
          <div className="import-commit-actions">
            <button className="primary-action" disabled={busy || (!text.trim() && !fileBytes)} onClick={() => void previewImport()} type="button"><RefreshCw aria-hidden="true" /> {busy ? "Working..." : "Preview import"}</button>
            <Link className="secondary-action" to="/import/deck">Import a deck into Deck Builder</Link>
          </div>
          {message ? <p className="import-status" role="status">{message}</p> : null}
          {lastResult ? <p className="import-success" role="status"><CheckCircle2 aria-hidden="true" /> Last import added {lastResult.imported} cards; {lastResult.unresolved} entries need review.</p> : null}
        </HolographicPanel>

        {parsed ? <HolographicPanel className="import-review-panel import-review-anchor">
          <div className="import-panel-heading"><FileSpreadsheet aria-hidden="true" /><div><h2>Review before importing</h2><p>{formatLabel(parsed.format)} · {parsed.deckName}</p></div></div>
          <dl className="import-summary-grid"><div><dt>Entries</dt><dd>{entries.length}</dd></div><div><dt>Quantity</dt><dd>{summary.quantity}</dd></div><div><dt>Matched</dt><dd>{summary.resolved.length}</dd></div><div><dt>Needs review</dt><dd>{summary.unresolved.length}</dd></div></dl>
          {parsed.warnings.length > 0 ? <div className="import-warning-list">{parsed.warnings.slice(0, 4).map((warning) => <span key={warning}><AlertCircle aria-hidden="true" /> {warning}</span>)}</div> : null}
          <div className="import-entry-list">{entries.map((entry) => <article className={`import-entry import-entry--${entry.status}`} key={entry.id}>
            <div className="import-entry__main"><strong>{entry.card?.name ?? entry.catalogCard?.name ?? entry.name}</strong><small>{entry.quantity} {entry.quantity === 1 ? "copy" : "copies"} · {statusLabel(entry)}</small>{entry.card ? <span>{entry.card.setCode.toUpperCase()} · {entry.card.collectorNumber}{entry.card.imageUris?.normal ? " · Scryfall image ready" : ""}</span> : null}</div>
            <div className="import-entry__controls">{entry.status !== "resolved" ? <Link to={`/search?context=import&q=${encodeURIComponent(entry.name)}`}>Search to resolve</Link> : <span className="import-entry__verified"><CheckCircle2 aria-hidden="true" /> Canonical match</span>}</div>
          </article>)}</div>
          <button className="primary-action import-commit-button" disabled={busy || summary.resolved.length === 0 || (strategy === "replace" && !replaceConfirmed)} onClick={() => void commitImport()} type="button"><CheckCircle2 aria-hidden="true" /> Import recognized cards</button>
          {summary.unresolved.length > 0 ? <p className="import-note"><AlertCircle aria-hidden="true" /> Unmatched entries are preserved in import history and can be resolved later. They are not silently discarded.</p> : null}
        </HolographicPanel> : null}

        <HolographicPanel className="import-history-panel">
          <div className="import-panel-heading"><History aria-hidden="true" /><div><h2>Import history</h2><p>Every import stays local and recoverable.</p></div></div>
          {history.length === 0 ? <p>No collection imports yet.</p> : <div className="import-history-list">{history.slice(0, 12).map((record) => <article className="import-history-item" key={record.id}><div><strong>{record.sourceName}</strong><span>{formatLabel(record.detectedFormat)} · {record.importedQuantity} cards · {record.status}</span></div>{record.status !== "undone" ? <button className="secondary-action" disabled={busy} onClick={() => void undoImport(record)} type="button"><Undo2 aria-hidden="true" /> Undo</button> : <span className="import-history-undone">Undone</span>}</article>)}</div>}
        </HolographicPanel>
      </div>
      <p className="import-footnote">Supported workflows include Moxfield, Archidekt, ManaBox, Dragon Shield, TCGplayer, Card Kingdom, Deckbox, Deckstats, Scryfall, MTG Arena, MTGGoldfish, generic CSV, plain text, JSON, and Deck Nexus exports.</p>
    </section>
  );
}
