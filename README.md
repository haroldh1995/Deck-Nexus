# Deck Nexus

Deck Nexus is a mobile-first, local-first Commander deck builder for Magic: The Gathering players who want deck planning without commerce data or required accounts.

The current build establishes the Commander-focused app foundation:

- Arcane Holographic Command Hub visual identity.
- Dynamic 3D holographic Home Screen with a coded card orbit, upper rune ring, central beam, floating crystal, lower floor projection, particles, smoke, and gear-based menu customization.
- Holographic Deck Workspace for saved Commander decks, with a top commander projection, color-identity orbs, fixed card-type archive sections, independent horizontal section scrolling, deck count diagnostics, and Live Bracket Tracker integration.
- Local IndexedDB persistence through Dexie.
- Commander-only deck model and deck creation flow.
- Deck Library with local saved decks and deletion.
- Deck Builder editing with Commander color identity warnings, maybeboard/cuts, bracket tracker foundation, and local persistence.
- Local Card Search with Commander-aware badges, owned/deck scopes, deck-aware add actions, and manual outside-identity warnings.
- Owned Cards registry with quantities, exact printing fields, tags, notes, favorites, storage location, and duplicate/share status.
- Scanner UI with persistent batches, batch review, simulated scan engine, Automatic Feeder Mode, Stacking Feeder Mode, tray-full prompts, and local recovery.
- Analyzer, Recommendation Panel, Smart Build review foundations, Maybeboard/Cuts history controls, decision timeline, and local version-result storage.
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
- Use the small top-right gear icon to customize the floating menu order. Permanent destinations can be reordered but not removed; dynamic favorite cards can be hidden from Home.
- Screen-reader users get a visually hidden logical destination list without a second visible dashboard.

Accessibility and performance:

- Reduced Motion disables continuous orbit motion, complex intro animation, projection fragmentation, and parallax.
- Static Home Screen keeps the arcane visual system and presents the same floating cards without idle orbit movement.
- Performance modes are Full Arcane, Balanced Arcane, and Performance Mode. Balanced is the default and limits the heaviest continuous animation loops while preserving the holographic composition.
- High Contrast and Large Text settings are respected by the Home scene and app shell.

Home layout:

- The floating holographic orbit is the only visible Home navigation surface.
- The old shortcut strip, permanent Orbit Order panel, and bottom Home navigation bar have been removed.
- Home is sized to the usable viewport with `100dvh`, safe-area padding, and no app-controlled vertical scroll.
- Menu order, dynamic favorite visibility, and Home motion preferences persist in local IndexedDB settings.

## Deployment

The app is deployed to GitHub Pages at `https://haroldh1995.github.io/Deck-Nexus/`.

The active workflow `.github/workflows/deploy-pages.yml` runs `npm ci`, lint, unit tests, and `npm run build -- --mode github-pages`, uploads `dist`, and deploys it through GitHub Pages. Source changes are not considered complete until the branch is pushed and the live Pages URL is verified against the new build.

## Local-First Rules

Deck Nexus stores app data in the browser's IndexedDB and does not require login or cloud sync. The app intentionally contains no commerce data, collection valuation, or external acquisition flows.

Automatic deck-building architecture must respect Commander color identity. Manual search can eventually show broader results, but automated suggestions and placements must stay inside the commander's color identity.

## Holographic Deck Workspace

Saved decks open into a coded arcane workspace inspired by `public/assets/deck-workspace-reference.jpg`. The reference image is used as a low-opacity atmospheric alignment layer; commander data, color orbs, card archives, counts, tools, and actions are real React elements.

Layout:

- Commander projection stays at the top center with a cyan/violet frame.
- Five custom color-identity orbs surround the commander area. Active commander colors glow, inactive colors remain dim, and colorless commanders activate a neutral diamond rune.
- Total Commander count remains visible at the upper-right of the workspace and counts commander-zone plus main deck cards only.
- Creatures are full-width below the commander.
- Instants/Sorceries, Artifacts/Enchantments, and Other Permanents/Lands are paired in the required left/right rows.
- Maybeboard and Cuts remain accessible through local tabs and do not count toward the 100-card Commander total.

Card organization:

- Creature cards, including Artifact Creatures and Enchantment Creatures, appear in Creatures with secondary badges.
- Instants, Sorceries, noncreature Artifacts, noncreature Enchantments, Lands, Artifact Lands, Planeswalkers, Battles, and unusual future permanent types are classified into their Commander workspace sections.
- Section counts include card quantity, exclude Maybeboard and Cuts in Main Deck view, and update immediately after local edits.

Controls and accessibility:

- Every section is an independent horizontal scroll archive with previous/next controls, touch or trackpad scrolling, keyboard Left/Right/Home/End support, and screen-reader range text.
- Section Add opens the local manual add flow with Commander rule warnings. Scan Into Section routes to the scanner surface with the deck and target section in the URL.
- Expanded section panels include section search, sort, filter, scan, recommendations entry, multi-select foundations, move, tag, protect, cut, and remove actions.
- Reduced Motion stops nonessential workspace animation while preserving glow, section scrolling, and all deck-editing functions. High Contrast increases border clarity through the app setting.

## Card Search

The Card Search route is a real local-first search surface backed by `src/data/cardCatalog.ts` and `src/features/cards/cardSearch.ts`.

- Supports partial names, single-word and multi-word queries, exact phrase matching, type/subtype search, oracle text search, keyword/role search, and fuzzy-helper scoring.
- Search scopes include All Cards, Owned Cards, Current Deck, Maybeboard, Cuts, Commander Candidates, and Cached Cards Only.
- Result views include Compact, Image/Card Tile, and Grid.
- Badges distinguish Owned, Missing, In Deck, Legal, Outside Identity, Commander Legal, Not Commander Legal, Duplicate, Banned, Synergy Pick, High Power, cEDH Relevant, and Manual Search Result.
- Manual search can show cards outside the active commander's identity, but adding one to Main Deck uses the soft Commander warning flow with Add Anyway, Send to Maybeboard, and Cancel.
- The Deck Builder Search glyph opens this route with the active `deckId`; scanner/import correction and Find Similar can build on the same module.

The current search provider uses a seeded local card cache so tests and offline usage work without network access. The service shape is prepared for a future public Scryfall provider without introducing prices or marketplace data.

## Owned Cards

Owned Cards is a planning-only local registry. Users can build with cards they do not own; missing markers mean missing/not confirmed owned only.

- Add owned cards manually with quantity, mana cost, type line, color identity, tags, notes, favorite state, storage location, duplicate/share flag, and exact-printing fields.
- Quantity can be increased, decreased, or removed locally.
- Duplicate/share flags are `none`, `needs_review`, `multiple_owned`, and `sharing_between_decks`; duplicates are flagged, never blocked.
- Views are prepared for All Owned Cards, Recently Scanned, Favorites, By Color Identity, By Card Type, By Tag, By Deck Usage, Unused Owned Cards, Missing From Decks, Exact Printings, and Extras/Tokens.

## Scanner And Batch Persistence

The Scan Cards route implements the scanner workflow UI and a testable simulated scan engine while leaving browser camera/OCR/image matching behind service boundaries for later.

Modes:

- Scan to Owned Cards
- Scan Directly Into Deck
- Scan Into Section
- Batch Scan
- Correction Mode
- Automatic Feeder Mode
- Stacking Feeder Mode

Batch behavior:

- Scanner batches persist in IndexedDB through pause, route changes, refresh, tray-full prompts, and review interruptions.
- Batch lifecycle states include scanning, paused, needs review, reviewing, partially applied, applied, saved for later, and discarded.
- Batch Review supports confirming high-confidence records, reviewing assumed records, correcting/removing selected records, applying confirmed records, saving unresolved records for later, and undoing/discarding a batch.
- Destinations include Owned Cards, Current Deck, Main Deck, Maybeboard, Cuts, Extras/Tokens, New Deck, New List, Existing List, and Custom Collection.

Feeder behavior:

- Automatic Feeder Mode follows idle, card entering, stable, capture, resolve, queue, wait for removal, and ready states.
- Stacking Feeder Mode never relies on card removal detection. Too-close distortion is treated as the normal new-card-arrival cue.
- If too-close/unreadable state exceeds the timeout, the scanner pauses with: “Tray may be full. Empty the catch tray, then resume scanning.” The batch queue remains preserved.
- Tokens/extras can be marked separately and do not count toward Commander totals.

## Analyzer, Recommendations, And Smart Build

Analyzer and Smart Build are local-first foundations with Commander safeguards.

- Analyzer checks Commander count, commander-zone presence, singleton basics exceptions, color identity, bracket pressure, role balance, mana curve, ownership summary, and missing-card status.
- Health labels include Excellent, Healthy, Needs Work, Incomplete, Illegal, Above Bracket, Below Bracket, and Needs Review where applicable.
- Recommendation tabs include Best Fits, Owned First, Role Fixes, Goal Support, Commander Voltron / Goal-Specific, Mana Curve Fixes, Staples, Replacements, and Wild Within-Color.
- Recommendations are filtered to Commander color identity and bracket constraints, show owned quantity and role tags, and explain why each card is suggested.
- Smart Build modes include Owned Cards Only, Owned First + Missing Upgrades, Ideal Goal-Based Build, Bracket-Locked Build, and Rebuild Existing Deck.
- Smart Build creates a review-only result before applying. It can apply to Main after review, save as a new deck, or send suggestions to Maybeboard. It records local Smart Build results and decision events.
- Maybeboard and Cuts stay separate from the seven main workspace sections, do not count toward 100, and include restore/move controls and cut-reason history fields.

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

Live camera capture, OCR, image fingerprinting, remote Scryfall querying, EDHREC-compatible external datasets, full import/export tooling, groups/tags management depth, backup/restore flows, and goldfish/test-play simulation remain future work. The current implementations are local-first, no-price, no-marketplace foundations designed to deepen without required login or commerce links.
