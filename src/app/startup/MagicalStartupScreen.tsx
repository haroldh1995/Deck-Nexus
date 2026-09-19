import type { StartupPresentation } from "./startupStatusAdapter";

const segments = [
  { id: "core", label: "CORE", copy: "Initializing systems" },
  { id: "archive", label: "ARCHIVE", copy: "Loading your decks" },
  { id: "collection", label: "COLLECTION", copy: "Preparing your cards" },
  { id: "visuals", label: "VISUALS", copy: "Channeling assets" },
  { id: "nexus", label: "NEXUS", copy: "Building interface" },
  { id: "orbit", label: "ORBIT", copy: "Aligning navigation" },
  { id: "ready", label: "READY", copy: "Almost there" },
] as const;

export function MagicalStartupScreen({
  presentation,
  onRetry,
}: {
  presentation: StartupPresentation;
  onRetry: () => void;
}) {
  const completed = new Set(presentation.completedVisualSegments);
  const reducedMotion = typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  return (
    <div
      aria-label="Deck Nexus startup"
      className={`magical-startup${presentation.ready ? " magical-startup--ready" : ""}${presentation.error ? " magical-startup--error" : ""}`}
      data-reduced-motion={reducedMotion}
      data-testid="magical-startup"
      role="status"
    >
      <div className="magical-startup__stars" aria-hidden="true" />
      <div className="magical-startup__beam" aria-hidden="true" />
      <div className="magical-startup__chamber" aria-hidden="true">
        <div className="magical-startup__ring magical-startup__ring--outer" />
        <div className="magical-startup__ring magical-startup__ring--middle" />
        <div className="magical-startup__ring magical-startup__ring--inner" />
        <div className="magical-startup__runes magical-startup__runes--top">ᚫ ᛟ ᚱ ᛏ ᚾ ᛉ</div>
        <div className="magical-startup__runes magical-startup__runes--bottom">◇ ◇ ◇ ◇ ◇ ◇</div>
        <div className="magical-startup__platform" />
        <div className="magical-startup__crystal">
          <span className="magical-startup__crystal-core" />
        </div>
        {segments.slice(0, 6).map((segment, index) => (
          <span
            aria-hidden="true"
            className={`magical-startup__projection magical-startup__projection--${index + 1}${completed.has(segment.id) ? " is-ready" : ""}`}
            key={segment.id}
          />
        ))}
      </div>

      <header className="magical-startup__brand">
        <span className="magical-startup__brand-mark" aria-hidden="true" />
        <div>
          <strong>DECK NEXUS</strong>
          <small>COMMANDER HUB</small>
        </div>
      </header>

      <div className="magical-startup__status" aria-live="polite">
        <div className="magical-startup__status-copy" key={`${presentation.visualStage}-${presentation.magicalTitle}`}>
          <strong>{presentation.magicalTitle}</strong>
          <span>{presentation.plainDescription}</span>
          {presentation.detail ? <small>{presentation.detail}</small> : null}
        </div>
        {presentation.error ? (
          <button className="magical-startup__retry" onClick={onRetry} type="button">
            Retry preparation
          </button>
        ) : null}
      </div>

      <div className="magical-startup__segments" aria-hidden="true">
        {segments.map((segment) => (
          <div
            className={`magical-startup__segment${completed.has(segment.id) ? " is-complete" : ""}${presentation.visualStage === segment.id ? " is-active" : ""}`}
            key={segment.id}
          >
            <span className="magical-startup__segment-rune" />
            <strong>{segment.label}</strong>
            <small>{segment.copy}</small>
          </div>
        ))}
      </div>

      <p className="magical-startup__motto">Every collection has a higher command.</p>
      <footer className="magical-startup__footer">
        <span>DECK NEXUS</span>
        <i aria-hidden="true" />
        <span>COMMANDER HUB</span>
      </footer>
    </div>
  );
}
