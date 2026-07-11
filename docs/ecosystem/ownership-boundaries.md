# Ownership Boundaries

## Deck Nexus Owns

- Deck creation and editing.
- Commander deck preparation and local legality guidance.
- Local collection and owned-card tracking.
- Scanner flows, scanner batches, correction, and recovery.
- Card search and Scryfall caching.
- Import/export preparation.
- Canonical local deck, collection, and profile snapshot exports.
- Immutable local deck snapshot creation, history, verification, comparison, archival state, and future BoardState envelope export preparation.
- Analyzer, recommendations, Smart Build planning, maybeboard, cuts, versions, and replacement records.
- Deck groups, tags, favorites, wishlist, upgrade lists, custom collections, backup/restore, settings, and local-first storage.
- Future source data for immutable deck snapshots and BoardState/Hub contracts.

## BoardState Owns

- Authoritative MTG rules validation.
- Advanced Gameplay UI and game state.
- Dry Run/simulation engine.
- Tutorial gameplay rules logic.
- Shared-session authority.
- Multiplayer turn/phase/stack enforcement.
- Any claim that a deck is validated by the authoritative rules engine.

## Future Hub Owns

- Ecosystem identity/profile routing.
- Friends/social layer.
- Notifications.
- App launching and app-link registry.
- Cross-app presence.
- Centralized sync/backup surfaces where built later.

## Shared Contracts

Deck Nexus may prepare type-safe local contracts for:

- Deck, card, owned-card, collection, and profile snapshot exports.
- Future immutable deck snapshot exports.
- Advanced Gameplay and Dry Run data envelopes that are explicit exports only, not launches.
- BoardState validation requests, responses, transport status, and result storage.
- Hub adapter status.
- Versioning and readiness reporting.

These contracts must remain honest. A configured bridge may submit snapshots to BoardState, but Deck Nexus must still label unavailable, failed, test-only, or stale validation correctly.

## Forbidden False Claims

Deck Nexus must not display or imply:

- Connected to BoardState.
- Live BoardState sync.
- Validated by BoardState.
- BoardState rules authority inside Deck Nexus.
- Advanced Gameplay ready.
- Dry Run synced.
- Shared session active.
- Hub connected.
- Friends synced.
- Notifications active.
- Cloud profile sync.

Acceptable current wording includes:

- BoardState bridge not connected yet.
- BoardState validation requires a configured bridge.
- Prepared for BoardState export.
- Snapshot export support available locally.
- Immutable snapshot created locally.
- Prepared for Advanced Gameplay export.
- Prepared for Dry Run export.
- Hub adapter planned.
- Local profile only.
- Local backup available.
- Rules guidance is local planning only.

## Current Linked-App Status

- Deck Nexus: local-ready web/PWA-style app.
- BoardState: validation bridge architecture is present; no production endpoint is configured by default.
- Hub: planned future ecosystem surface; not connected.
