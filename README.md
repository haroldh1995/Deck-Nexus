# Deck Nexus

Deck Nexus is a mobile-first, local-first Commander deck builder for Magic: The Gathering players who want deck planning without commerce data or required accounts.

The first build establishes the Commander-focused app foundation:

- Arcane Holographic Command Hub visual identity.
- Local IndexedDB persistence through Dexie.
- Commander-only deck model and deck creation flow.
- Deck Library with local saved decks and deletion.
- Settings saved locally, including reduced motion and static home controls.
- Strong TypeScript domain models for decks, owned cards, tags, scanner data, imports, analysis, exports, backups, and future smart-build results.
- Route shell for the full initial surface area.

## Local-First Rules

Deck Nexus stores app data in the browser's IndexedDB and does not require login or cloud sync. The app intentionally contains no commerce data, collection valuation, or external acquisition flows.

Automatic deck-building architecture must respect Commander color identity. Manual search can eventually show broader results, but automated suggestions and placements must stay inside the commander's color identity.

## Scripts

```bash
npm install
npm run dev
npm run lint
npm run test
npm run build
npm run e2e
```

## Project Structure

```text
src/app        App shell, routing, settings context
src/components Shared UI primitives
src/features   Feature screens and feature-specific helpers
src/data       Static app data and defaults
src/db         IndexedDB schema and repositories
src/types      Strong domain model types
src/utils      Pure helpers
src/styles     Global visual system
src/tests      Unit, integration, and e2e tests
public/assets  App assets
```

## Current Deferred Work

The Deck Builder route exists as a foundation route for the next implementation prompt. Card search, scanning, analysis, export, groups, tags, and test deck routes are present as honest coming-later screens with database architecture already prepared.
