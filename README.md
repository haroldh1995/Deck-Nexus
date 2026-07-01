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
- Live Scryfall Card Search with universal Add To workflows, multi-select, deck-aware warnings, owned registration, Wishlist, Upgrade Lists, Custom Collections, and undo.
- Owned Cards registry with quantities, exact printing fields, tags, notes, favorites, storage location, and duplicate/share status.
- Scanner UI with persistent batches, batch review, simulated scan engine, Automatic Feeder Mode, Stacking Feeder Mode, tray-full prompts, and local recovery.
- Analyzer, Recommendation Panel, Smart Build setup/review/apply flows, Maybeboard/Cuts history controls, decision timeline, recommendation feedback, replacement records, and restorable local deck versions.
- Settings saved locally, including reduced motion, static home controls, glow intensity, text size, high contrast, device tilt parallax opt-in, and Home performance modes.
- Strong TypeScript domain models for decks, owned cards, tags, scanner data, imports, analysis, exports, backups, and future smart-build results.
- Route shell for the full initial surface area.
- A small top-right Home button on every non-Home route returns directly to the Home Screen while protecting unfinished scanner batches.

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

## Global Navigation

Every non-Home screen includes a small unlabeled top-right Home button with the accessible label `Return to Home`. It uses the app router rather than a browser reload, is hidden on the Home route, and keeps the previous route in normal browser history. Scanner routes are protected: if a recoverable batch exists, Home shows an unfinished-batch prompt with Save Batch and Go Home, Review Batch, and Continue Scanning options so scan data is not lost.

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

The Card Search route is now a live Scryfall-backed, local-first search surface. Live Scryfall API data is authoritative when the browser is online; IndexedDB cache makes previously viewed cards, autocomplete names, and cached search results available offline. The seeded local catalog remains only as a final fallback for tests and first-run offline use.

- Uses Scryfall `/cards/autocomplete` for predictive card-name suggestions after a short debounce.
- Uses `/cards/search` for full search, advanced Scryfall syntax, filters, commander legality, pagination, and structured result pages.
- Uses `/cards/named` with `exact` and `fuzzy` for selected suggestions, misspellings, import correction, scanner correction, and exact typed names.
- Uses `/cards/:id` for known-card hydration and `/cards/collection` for batched identifier resolution.
- Uses `/bulk-data` metadata for optional offline card database setup. Large offline downloads remain explicit user actions.
- Supports partial names, single-word and multi-word queries, exact phrase matching, type/subtype search, oracle text search, keyword ability search, and Scryfall advanced syntax such as `t:creature`, `o:"draw a card"`, `id:wu`, `legal:commander`, `mv<=2`, and `set:mh3`.
- Search scopes include All Cards, Owned Cards, Current Deck, Maybeboard, Cuts, Commander Candidates, and Cached Cards Only.
- Result views include Compact, Image/Card Tile, and Grid.
- Badges distinguish Owned, Missing, In Deck, Legal, Outside Identity, Commander Legal, Not Commander Legal, Duplicate, and Manual Search Result.
- Manual search can show cards outside the active commander's identity, but adding one to Main Deck uses the soft Commander warning flow with Add Anyway, Send to Maybeboard, and Cancel.
- The Deck Builder Search glyph opens this route with the active `deckId`; scanner correction preserves the active batch and returns to review, and import correction preserves unresolved import context.
- Selecting an autocomplete suggestion fills the field and resolves the card inside Search. It does not open Card Detail, add a card, change routes, open Scanner, or alter decks automatically.
- Result actions are explicit and context-aware. Global Search defaults to View Card, deck Search defaults to Add to Current Deck, owned Search defaults to Register Owned, commander Search defaults to Start New Deck, scanner correction defaults to Use This Match, and import correction defaults to Resolve Entry.
- Every Scryfall result exposes `Add To...` as a secondary action. One card or multiple selected cards can be deliberately added to Current Deck, Another Existing Deck, New Deck, Owned Cards, Wishlist, a deck Maybeboard, a deck Cuts directory, an Upgrade List, Favorites, a Custom Collection, or a New Custom Collection.
- `Add To...` opens an in-route overlay. It does not navigate automatically, reset the query, clear filters, clear selected cards, reset result position, open Card Detail, or add anything before confirmation.
- Multi-select mode supports selecting visible results, clearing selection, and batch Add To with a selected-card count.
- New Deck from Search asks how selected cards should be used, validates commander eligibility, and can create the deck while staying in Search by default.
- Existing deck destinations rank compatible decks first but keep incompatible decks selectable with explicit Commander rule review.
- Owned Cards registration uses exact Scryfall printing data already available in the result, updates owned badges through local persistence, and stays in Search.
- Wishlist is a first-class planning list, not a marketplace. It stores desired quantity, priority, intended deck data, notes, tags, source query, and ownership state without prices or vendor links.
- Upgrade Lists and Custom Collections are local directories that can be created from Search, favorited, and revisited from the Library organization links.
- Successful destination actions show a confirmation with Undo and View Destination. Undo restores persisted data such as deck additions, owned-card changes, wishlist quantity merges, favorites, list entries, collections, and new decks where safe.
- Search-state preservation includes raw input, committed query, filters, scope, result page, loaded results, result scroll position, selected cards, active deck context, scanner correction context, and import correction context.

Search stability:

- The search input remains mounted while typing so mobile keyboards are not repeatedly dismissed.
- Autocomplete renders as an overlay below the input and does not push the page, move the header, or snap the viewport.
- Previous results remain visible while a new live request is in flight.
- Card image slots reserve a fixed aspect ratio before images load.
- The result region scrolls independently while the search header and status row remain stable.

Scryfall request management:

- All Scryfall traffic goes through `src/services/scryfall`, not direct component fetches.
- The request queue deduplicates identical in-flight requests, cancels stale autocomplete work, and spaces card API requests at Scryfall's documented 500ms pacing for search/name/autocomplete calls.
- 429 and temporary server errors use controlled retry/backoff and respect `Retry-After` when provided.
- Background cache refresh never has priority over the active typed search.

Cache and offline behavior:

- IndexedDB stores normalized Scryfall cards, Oracle-card cache entries, autocomplete results, search result pages, bulk-data metadata, and cache metadata.
- Cached results can render immediately while live results refresh.
- Offline mode displays an offline/cached data status and does not pretend results are live.
- Reconnecting restores live search without requiring a full app reload.

No-price policy:

- Deck Nexus maps Scryfall Card objects into a normalized domain model and intentionally drops `prices` and `purchase_uris`.
- The UI never displays USD, EUR, TIX, TCGplayer, Cardmarket, Cardhoarder, vendor links, marketplace values, or collection values.
- Card data and images are attributed to Scryfall without implying endorsement.

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

## Search Directories

Search-created directories are stored in IndexedDB and are separate relationships. A card can simultaneously be owned, wishlisted, favorited, in a custom collection, in an upgrade list, in a deck, in a Maybeboard, or in Cuts.

- Wishlist entries track desired quantity, priority, intended deck IDs, intended role, tags, notes, source query, acquired quantity, and ownership state.
- Upgrade Lists track name, description, related deck, goal/bracket metadata, tags, favorite state, Home visibility, archive state, and card entries with role, priority, suggested replacement, notes, and completion state.
- Custom Collections track name, description, tags, favorite state, Home visibility, icon, associated decks, sort mode, archive state, and card entries with quantity, notes, tags, custom status, ownership state, and source query.
- Favorites can store card favorites created from Search without duplicating existing favorite records.
- The Deck Library header links to Wishlist, Upgrade Lists, and Custom Collections. These screens read the same IndexedDB stores populated by Search and include no commerce information.

## Analyzer, Recommendations, And Smart Build

Analyzer, Recommendations, and Smart Build are local-first Commander planning tools. They never show prices, never use marketplace links, and automatic suggestions stay inside commander color identity.

Analyzer:

- Checks commander-zone validity, paired commander color identity, singleton/basic-land exceptions, 100-card count including the commander zone, color-identity conflicts, bracket pressure, role balance, mana curve, ownership summary, duplicate/share warnings, and missing-card status.
- Excludes Maybeboard, Cuts, tokens, and extras from Commander count.
- Uses health states such as Excellent, Healthy, Needs Work, Incomplete, Illegal, Above Bracket, Below Bracket, and Needs Review.
- Saves analysis snapshots locally and links analysis issues to Recommendations, Maybeboard, and Cuts workflows.

Recommend Panel:

- Tabs include Best Fits, Owned First, Role Fixes, Goal Support, Commander Voltron / Goal-Specific, Mana Curve Fixes, Staples, Replacements, and Wild Within-Color.
- Filters include Owned only, Not owned, Legal only, In bracket, Role, Mana value, Card type, Goal match, Commander synergy, Not already in deck, Not in maybeboard, and Favorites.
- Recommendation cards show name, mana cost, type line, role badges, owned quantity, bracket fit, goal matches, and an explanation.
- Actions include Add to Main, Send to Maybeboard, Replace Existing, View Details, Find Similar, Compare, Favorite, Not Interested, Never Suggest This Card, and Never Suggest This Strategy.
- Feedback is persisted locally in IndexedDB and is fed back into future recommendation filtering.

Smart Build:

- Modes include Owned Cards Only, Owned First + Missing Upgrades, Ideal Goal-Based Build, Bracket-Locked Build, and Rebuild Existing Deck.
- Setup controls include commander zone, ordered goals, goal priority, mana curve goal, bracket lock, ownership preference, do-not-suggest rules, use-current-deck-as-core, protected cards, output preference, and existing-deck behavior.
- Existing-deck behavior options are Keep everything and fill missing slots, Keep protected cards only, Keep commander and goals only, Suggest changes without applying, and Create new deck version.
- Commander Voltron goals prioritize equipment, auras, protection, evasion, power boosts, double strike, trample, flying, menace, hexproof, indestructible, ward, haste, combat-damage triggers, attack triggers, commander recast support, and cards that amplify the commander plan.
- Smart Build always creates a review screen before applying. The review shows proposed decklist, cards added, review-only cuts, kept cards, missing cards, owned cards used, unowned cards, role breakdown, mana curve, legality status, bracket fit, goal alignment, and why each card was chosen.
- Review actions include Apply Build, Save as New Deck, Send Suggestions to Maybeboard, Create Upgrade List Only, Review Card by Card, Export Preview, and Cancel.
- Applying a Smart Build creates before/after `DeckVersion` snapshots, saves the `SmartBuildResult`, and records decision events. Restoring, comparing, and duplicating versions are available from Version History.

Maybeboard, Cuts, Timeline, and Versions:

- Maybeboard entries track source, notes/reason, role tags, goal matches, ownership state, and remain excluded from Commander count.
- Maybeboard actions include Move to Main Deck, Move to Cuts, View Details, Find Similar, Compare, Mark Protected, Edit Tags/Notes, Confirm Ownership, Scan Copy, and Remove from Maybeboard.
- Cuts store rejected or removed cards with cut reason, notes, possible replacement links, previous section/version metadata, and local history.
- Cut reasons include Too high mana value, Low synergy, Off-theme, Role overlap, Above Bracket Lock, Not owned, Better replacement found, Too many of this role, Mana curve issue, Commander color issue, Testing cut, Manual cut, and Other.
- Cuts actions include Restore to Main Deck, Move to Maybeboard, View Details, Edit Cut Reason, Find Similar, Compare with Replacement, and Delete From Cuts.
- Decision Timeline records adds, maybeboard moves, cuts, restores, replacements, Smart Build applies, imports, scanner batches, ownership confirmations, bracket changes, and goal changes, with filters for each event family.

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

Live camera capture, OCR, image fingerprinting, EDHREC-compatible external datasets, full import/export tooling, groups/tags management depth, backup/restore flows, and goldfish/test-play simulation remain future work. The current implementations are local-first, no-price, no-marketplace foundations designed to deepen without required login or commerce links.
