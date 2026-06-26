import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HolographicPanel } from "../../components/HolographicPanel";
import { PageHeader } from "../../components/PageHeader";
import { StatusPill } from "../../components/StatusPill";
import { useSettings } from "../../app/useSettings";
import {
  createBlankCommanderDeck,
  createBracketLockFromDefault,
} from "../../db/repositories";
import type { Bracket, OwnershipPreference } from "../../types/domain";

const deckStartOptions = [
  {
    title: "Blank Deck",
    status: "Ready",
    summary: "Create a local Commander deck shell and open the builder.",
  },
  {
    title: "Choose Commander",
    status: "Coming later",
    summary: "Commander search will be connected after card search is built.",
  },
  {
    title: "Import Decklist",
    status: "Coming later",
    summary: "Import parsing is routed through the Import Deck foundation.",
  },
  {
    title: "Build From Owned Cards",
    status: "Coming later",
    summary: "Owned-card deck starts will use the local collection store.",
  },
] as const;

export function CreateDeckScreen() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [deckName, setDeckName] = useState("");
  const [commanderName, setCommanderName] = useState("");
  const [bracketEnabled, setBracketEnabled] = useState(
    settings.defaultBracketLock.enabled,
  );
  const [bracket, setBracket] = useState<Bracket>(
    settings.defaultBracketLock.bracket,
  );
  const [ownershipPreference, setOwnershipPreference] =
    useState<OwnershipPreference>(settings.defaultOwnershipPreference);
  const [goalsText, setGoalsText] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!deckName.trim()) {
      setError("Deck name is required.");
      return;
    }

    setSaving(true);

    try {
      const deck = await createBlankCommanderDeck({
        name: deckName,
        commanderName,
        bracketLock: createBracketLockFromDefault(bracket, bracketEnabled),
        goals: goalsText.split(/\r?\n/),
        ownershipPreference,
      });

      navigate(`/deck-builder/${deck.id}`);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Deck could not be created.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="screen">
      <PageHeader title="Create Deck">
        <StatusPill tone="cyan">Commander</StatusPill>
      </PageHeader>

      <div className="mode-grid" aria-label="Deck creation modes">
        {deckStartOptions.map((option) => (
          <HolographicPanel
            as="article"
            className={option.status === "Ready" ? "mode-card is-ready" : ""}
            key={option.title}
            variant="card"
          >
            <div>
              <h2>{option.title}</h2>
              <StatusPill
                tone={option.status === "Ready" ? "cyan" : "violet"}
              >
                {option.status}
              </StatusPill>
            </div>
            <p>{option.summary}</p>
          </HolographicPanel>
        ))}
      </div>

      <HolographicPanel>
        <form className="deck-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            <label>
              Deck name
              <input
                autoComplete="off"
                name="deckName"
                onChange={(event) => setDeckName(event.target.value)}
                placeholder="E.g. Azure Starfall"
                required
                value={deckName}
              />
            </label>

            <label>
              Commander name
              <input
                autoComplete="off"
                name="commanderName"
                onChange={(event) => setCommanderName(event.target.value)}
                placeholder="Optional until card search is connected"
                value={commanderName}
              />
            </label>

            <label>
              Ownership preference
              <select
                onChange={(event) =>
                  setOwnershipPreference(
                    event.target.value as OwnershipPreference,
                  )
                }
                value={ownershipPreference}
              >
                <option value="owned_first">Owned first</option>
                <option value="owned_only">Owned only</option>
                <option value="allow_missing">Allow missing cards</option>
              </select>
            </label>

            <label>
              Bracket
              <select
                onChange={(event) => setBracket(event.target.value as Bracket)}
                value={bracket}
              >
                <option value="bracket_1">Bracket 1</option>
                <option value="bracket_2">Bracket 2</option>
                <option value="bracket_3">Bracket 3</option>
                <option value="bracket_4">Bracket 4</option>
                <option value="bracket_5">Bracket 5</option>
                <option value="custom">Custom</option>
              </select>
            </label>
          </div>

          <label className="toggle-row">
            <input
              checked={bracketEnabled}
              onChange={(event) => setBracketEnabled(event.target.checked)}
              type="checkbox"
            />
            <span>Enable bracket lock</span>
          </label>

          <label>
            Goals
            <textarea
              name="goals"
              onChange={(event) => setGoalsText(event.target.value)}
              placeholder="One goal per line"
              rows={4}
              value={goalsText}
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}

          <div className="form-actions">
            <button className="primary-action" disabled={saving} type="submit">
              {saving ? "Saving" : "Save Blank Commander Deck"}
            </button>
          </div>
        </form>
      </HolographicPanel>
    </div>
  );
}
