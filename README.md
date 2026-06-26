# Deck Nexus

Deck Nexus is a mobile-first, local-first Commander deck builder for Magic: The Gathering players who want deck planning without commerce data or required accounts.

The current build establishes the Commander-focused app foundation:

- Arcane Holographic Command Hub visual identity.
- Dynamic 3D holographic Home Screen with a coded card orbit, upper rune ring, central beam, floating crystal, lower floor projection, particles, smoke, and accessible fallback navigation.
- Local IndexedDB persistence through Dexie.
- Commander-only deck model and deck creation flow.
- Deck Library with local saved decks and deletion.
- Deck Builder editing with Commander color identity warnings, maybeboard/cuts, bracket tracker foundation, and local persistence.
- Settings saved locally, including reduced motion, static home controls, glow intensity, text size, high contrast, device tilt parallax opt-in, and Home performance modes.
- Strong TypeScript domain models for decks, owned cards, tags, scanner data, imports, analysis, exports, backups, and future smart-build results.
- Route shell for the full initial surface area.

## Dynamic Hologram Home

The Home route is a living coded projection chamber, not a static menu image. It uses `public/assets/deck-nexus-home-reference.jpg` as an atmospheric alignment layer while rendering the command cards, crystal, rings, beam, particles, and navigation controls as real HTML/CSS/SVG/Canvas/React elements.

Controls:

- Drag or swipe horizontally on the scene to rotate the command-card orbit.
- Use Left and Right arrow keys to change the focused command.
- Press Enter on the scene to open the focused command.
- Click a focused card to open it, or click an unfocused card to bring it forward.
- Long press a card for quick actions such as Open, Focus, and order changes.
- Use the bottom command bar or fallback command rail if the 3D scene is not the preferred navigation path.

Accessibility and performance:

- Reduced Motion disables continuous orbit motion, complex intro animation, projection fragmentation, and parallax.
- Static Home Screen keeps the arcane visual system but exposes commands as a stable projection grid/rail.
- Performance modes are Full Arcane, Balanced Arcane, and Performance Mode. Balanced is the default and limits the heaviest continuous animation loops while preserving the holographic composition.
- High Contrast and Large Text settings are respected by the Home scene and app shell.

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

Card search, scanning, analysis, export, groups, tags, and test deck routes are present as honest coming-later screens with database architecture already prepared. Future prompts can deepen those features without adding commerce, prices, marketplace links, or required login.
