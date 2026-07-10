# Deck Nexus Current State

This audit describes the current Deck Nexus web app as found in this repository. It does not claim live BoardState or Hub integration.

## Current Architecture

- App shell: React, Vite, React Router, lazy-loaded feature screens, `BrowserRouter` with GitHub Pages base-path support.
- Deployment: GitHub Pages workflow in `.github/workflows/deploy-pages.yml`; it runs install, lint, unit tests, and `npm run build -- --mode github-pages`.
- Storage: Dexie/IndexedDB database named `deck-nexus-local`; settings are loaded through `SettingsProvider`.
- Data source: Scryfall live/cache services plus a small local catalog for test and fallback flows. Prices and marketplace behavior are intentionally absent.
- Home: mobile-first holographic orbit scene with local Home ordering and hidden IDs in settings.

## Feature Inventory

- Home Screen: orbit cards for Create Deck, Deck Library, Card Search, Scan Cards, Owned Cards, Import Deck, Analyzer, Deck Groups, Tags, Test Deck, Export, and Settings. Dynamic favorites can appear in the orbit.
- Deck creation: creates local Commander decks from blank input.
- Deck library: lists local decks and opens Deck Builder.
- Deck Builder: manages commander/main/maybeboard/cuts cards, metadata, notes, tags, protection, moves, cuts, replacements, duplication, deletion, and version restore.
- Commander/color identity: local guidance in `commanderRules`, `colorIdentity`, and deck analysis. This is planning guidance, not BoardState rules authority.
- Card Search: Scryfall-backed search, autocomplete, cached results, Add To flows, wishlist, upgrade lists, custom collections, favorites, and undo transactions.
- Scanner: real camera permission/opening flow where supported, live preview, local recognition pipeline, scanner modes, batch persistence, sound/haptic settings, correction/review flows, and manual simulation/test harness support.
- Owned Cards: local owned-card registry and printings.
- Analyzer/Smart Build/Recommend: local analysis snapshots, recommendations, Smart Build proposals, maybeboard/cuts, version history, replacement records, and feedback.
- Directories: wishlist, upgrade lists, and custom collections.
- Settings: interface/accessibility, local data, scanner, Scryfall cache, bracket defaults, and ecosystem readiness status.
- Export: canonical Deck Snapshot, Collection Snapshot, Profile Snapshot, JSON, compressed JSON, ZIP package, and Arena text exports generated from local data.
- Foundation routes: Import, Groups, Tags, and Test Deck currently show local schema/status placeholders where full UI is not implemented.

## Route Inventory

| Route | Purpose | Primary reads | Primary writes | Local-only now | Future BoardState export | Future Hub |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | Home orbit | settings, favorites, decks | Home order/hidden IDs | Yes | No direct export | App launch surface later |
| `/create` | Create deck | settings | decks, decision events | Yes | Source deck data later | No |
| `/library` | Deck library | decks | deck deletion/duplication via linked actions | Yes | Deck selection source later | No |
| `/deck-builder/:deckId?` | Deck editing | decks, deck cards, owned cards | deck cards, versions, events | Yes | Snapshot source later | No |
| `/search` | Card search | Scryfall cache/live, decks, owned cards | decks, owned cards, directories, undo | Yes plus Scryfall lookup | Card identity source later | No |
| `/scan` | Scanner | settings, scanner batches, records | scanner batches, records, owned/deck cards | Yes plus camera/Scryfall | Collection/deck source later | No |
| `/owned` | Owned cards | owned cards, printings | owned cards, printings | Yes | Collection export later | No |
| `/import` | Import placeholder | import schema | none in route currently | Yes | Import source later | No |
| `/analyzer` | Analysis, Smart Build, Recommend | decks, analysis, owned cards | analysis, smart builds, versions | Yes | Planning signals later | No |
| `/groups` | Groups placeholder | group schema | none in route currently | Yes | No direct export | Hub organization later |
| `/tags` | Tags placeholder | tag schema | none in route currently | Yes | Optional metadata later | Hub metadata later |
| `/test` | Test Deck placeholder | deck schema | none in route currently | Yes | BoardState owns gameplay/dry run | No |
| `/export` | Export local snapshots and Arena text | decks, owned cards, settings | download/copy files only | Yes | Snapshot source later | Future package handoff later |
| `/settings` | Settings | settings, Scryfall cache metadata, ecosystem status | settings, Scryfall cache controls | Yes | Capability status only | Capability status only |
| `/wishlist` | Wishlist directory | wishlist | wishlist, favorites | Yes | No direct gameplay export | Future profile surface |
| `/upgrade-lists` | Upgrade lists | upgrade lists | upgrade lists, entries | Yes | Planning data later | Future profile surface |
| `/collections` | Custom collections | collections | collections, entries | Yes | Collection export later | Future profile surface |

No current route should claim live BoardState validation, Hub connection, friends, notifications, cloud sync, shared sessions, Advanced Gameplay, or Dry Run integration.

## Data Structure Inventory

### Deck

`Deck` includes `id`, `name`, `format`, `commanderIds`, `commanderNames`, `colorIdentity`, `cards`, `maybeboard`, `cuts`, `goals`, `tags`, `style`, `powerTarget`, `bracketLock`, `ownershipPreference`, `categoryStyle`, `notes`, `status`, optional `thumbnailCardId`, `originalImportText`, `unresolvedImports`, `createdFrom`, `createdAt`, and `updatedAt`.

Current snapshot/version support includes canonical local ecosystem exports and mutable local `DeckVersion` restore records. These are not BoardState gameplay snapshots and do not include gameplay state.

### Deck Card

`DeckCard` includes local `id`, `deckId`, `scryfallId`, `oracleId`, `name`, optional mana/type/text/color/image/printing/legalities fields, `quantity`, `section`, `categories`, `roleTags`, `customTags`, `notes`, `protected`, ownership counts, optional bracket/import/maybeboard/cut metadata, and timestamps.

Sections are `main`, `commander`, `maybeboard`, and `cuts`.

### Owned Card and Printing

`OwnedCard` tracks `id`, `oracleId`, `scryfallId`, `name`, card details, `quantityOwned`, `printings`, `tags`, `notes`, `favorite`, optional storage, duplicate flag, `deckUsage`, `lastScannedAt`, and timestamps.

`OwnedPrinting` tracks `id`, `scryfallId`, `oracleId`, `name`, set code/name, collector number, language, foil, condition, quantity, image URI, and last scanned timestamp.

### Profile

There is no Hub identity profile, friend graph, notification routing, or profile sync. Current profile-like data is local settings only.

### Scanner

`ScanBatch` tracks batch ID/name/status/mode/destination/deck/section, records created, persistence, camera device, feeder metadata, last accepted fingerprint, and timestamps.

`ScanRecord` tracks batch ID, raw text, Scryfall/oracle identifiers, name, quantity, status, confidence, possible matches, printing details, captured thumbnail, frame fingerprint, match source, warnings, and timestamps.

### Import, Export, Backup

`ImportResult` stores original text, resolved cards, unresolved entries, source, status, and created timestamp.

`ExportHistory` stores format, file name, deck ID, and created timestamp.

`BackupPackage` stores schema version, deck/owned counts, created timestamp, and opaque contents.

### Settings

`AppSettings` stores motion, Home performance/static/high-contrast/text settings, export and bracket defaults, scanner behavior, Scryfall cache/offline settings, and Home orbit customization.

## Persistence Map

Dexie versions:

- Version 1: decks, deck cards, owned cards, scanner, searches, favorites, tags, categories, groups, Smart Build, analysis, bracket analysis, import/export, decisions, settings, backups, migrations.
- Version 2: Scryfall card, oracle, autocomplete, search, bulk data, and cache metadata.
- Version 3: wishlist, upgrade lists, custom collections, search sessions, destination history, undo transactions.
- Version 4: recommendation feedback, replacement records, deck versions.

Additional browser storage:

- `localStorage`: Home focused card, Home customization behavior, search history, and feature-specific UI state where used.
- `sessionStorage`: Home intro playback state.
- Service worker: none found in source; GitHub Pages serves the Vite build and public assets.

## Preparation Status

- Canonical deck/collection/profile snapshot exports: implemented locally.
- BoardState bridge: not implemented.
- Immutable gameplay snapshots for BoardState gameplay sessions: not implemented.
- Hub adapter: not implemented.
- Cross-app launch actions: not implemented.
- Honest status surface: implemented in Settings as local readiness only.
