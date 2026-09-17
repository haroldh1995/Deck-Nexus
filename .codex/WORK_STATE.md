# Deck Nexus Work State

## CURRENT TASK
MASTER PRODUCT COMPLETION & INTELLIGENCE OVERHAUL

## CURRENT OBJECTIVE
Master Product Completion remains complete. The intervening UI residency, static asset, and persisted-data repair is complete and deployed; preserve it for future Deck Nexus work.

## LAST VERIFIED MILESTONE
UI residency repair committed as `839bcff`, pushed to `origin/main`, deployed successfully, and live-verified at 390x844. Home retained 12 complete cards through a 50-cycle rapid drag torture test, route revisits, and offline mode with zero horizontal overflow and no console errors.

## COMPLETED
- Master Product Completion remains preserved and deployed; its checkpoint is paused only for this targeted repair.
- Home visible-building repair: simultaneous short intro reveal, StrictMode-safe intro state, critical reference-image preload, deduplicated route preloading, idle/background scheduling, interaction deferral, and optimized particle drawing.
- Added deterministic scheduler tests covering interaction deferral and job deduplication.
- Prior Home orbit, Scanner, Import Deck, collection/ownership, pricing, BoardState boundary, snapshots, backup/restore, offline/PWA, and ecosystem foundation work remains preserved on `origin/main`.
- Deck Change Intelligence calculates additions/removals/replacements, role, curve, ownership, price, goal, and estimated bracket deltas using existing canonical models.
- Deck Builder shows nonintrusive change summaries with expandable detail and provides persistent targeted undo/redo through the existing deck stores.
- Card detail in Search now connects owned quantity, collection navigation, current deck/Maybeboard actions, and Want List fallback.
- Analyzer no-op staging actions were removed or replaced with working explanations and navigation.
- Focused Home/orbit tests: 21 passed; background scheduler tests: 2 passed.
- Full unit suite: 29 files, 156 tests passed.
- Full E2E suite: 36 tests passed on Chromium and mobile Chromium.
- Typecheck, lint, production build, mobile visual QA, route smoke checks, Deck Builder change/undo interaction, and no-overflow checks passed locally.

## STATUS
COMPLETE

## IN PROGRESS
None.

## REMAINING
None for the completed Master Product Completion checkpoint.

## FILES CURRENTLY INVOLVED
- `.codex/WORK_STATE.md`
- `src/app/AppShell.tsx`
- `src/app/SettingsContext.tsx`
- `src/app/imageReadiness.ts`
- `src/app/staticAssets.ts`
- `src/components/ResidentImage.tsx`
- `src/features/home/HomeScreen.tsx`
- `src/features/home/scene/HomeHologramScene.tsx`
- `src/features/home/scene/OrbitCard.tsx`
- `src/features/home/scene/homeSceneContent.ts`
- `src/features/home/scene/HologramParticlesCanvas.tsx`
- `src/app/routePreloaders.ts`
- `src/app/backgroundWork.ts`
- `src/features/home/scene/useHomeIntro.ts`
- `src/features/decks/deckChangeIntelligence.ts`
- `src/features/decks/DeckBuilderScreen.tsx`
- `src/db/repositories.ts`
- `src/features/cards/CardSearchScreen.tsx`
- `src/styles/deckWorkspace.css`
- `src/tests/deckChangeIntelligence.test.ts`
- `src/tests/backgroundWork.test.ts`
- `index.html`
- `.codex/RESUME.md`
- `src/db/residentData.ts`
- `src/tests/imageReadiness.test.ts`
- `src/tests/residentData.test.ts`

## TESTS ALREADY RUN
- Focused Home/orbit tests: 2 files, 21 tests passed.
- Background scheduler tests: 1 file, 2 tests passed.
- Full unit suite: 29 files, 156 tests passed.
- Full E2E suite: 36 tests passed on Chromium and mobile Chromium.
- GitHub Pages production-mode build passed.
- Typecheck, lint, production build, cold/warm Home profiling, 30-second interaction profiling, and route-prefetch timing checks passed locally.
- `npx tsc -b --pretty false`
- `npm run lint -- --quiet`
- `npm test -- --reporter=dot --maxWorkers=1` (27 files, 151 tests)
- Focused Home/orbit Vitest tests
- Desktop and mobile Playwright interaction suites
- Mobile Playwright Deck Nexus suite (10 tests)
- `npm run build`
- `npm run build -- --mode github-pages`
- `npm audit --audit-level=high` (reports two moderate Vitest transitive advisories)
- Residency focused tests: 5 files, 26 tests passed.
- Full unit suite after the residency changes: 31 files, 160 tests passed.
- Full E2E suite after the residency changes: 36 tests passed on Chromium and mobile Chromium.
- Production build after the residency changes passed.
- UI residency repair: stable Home card identities and resident data resources for settings, decks, owned cards, and favorites; static asset manifest and image readiness registry; cached Home/workspace artwork; route consumers moved off repeated deck/collection/settings reads.
- Live residency verification: Home remained complete after 5 seconds, 50 rapid direction-reversing drags, Library/Search/Owned/Import revisits, and offline mode. Live screenshot: `output/playwright/live-residency-839bcff.png`.

## TESTS STILL REQUIRED
None for the completed repair/checkpoint.

## KNOWN ISSUES
No new issue established yet. Existing `npm audit` reports two moderate transitive advisories in Vitest's test-only dependency tree.

## EXTERNAL BLOCKERS
None known.

## GIT STATE
Remote `main` contains `839bcffb554543f66b1d4308f1fbd0407d6e74d2` for the residency repair. The final checkpoint update is pending commit/push. No unrelated changes are present.

## DEPLOYMENT STATE
The residency repair deployment workflows completed successfully:
- https://github.com/haroldh1995/Deck-Nexus/actions/runs/35183398098
- https://github.com/haroldh1995/Deck-Nexus/actions/runs/35183398687

Previous GitHub Actions deployment workflows completed successfully:
- https://github.com/haroldh1995/Deck-Nexus/actions/runs/35162772500
- https://github.com/haroldh1995/Deck-Nexus/actions/runs/35162771524
- https://github.com/haroldh1995/Deck-Nexus/actions/runs/35163291394
- https://github.com/haroldh1995/Deck-Nexus/actions/runs/35163290953

## LIVE VERIFICATION STATE
Verified live at `https://haroldh1995.github.io/Deck-Nexus/?verify=839bcffb` in an iPhone-sized 390x844 browser session after deployment. Home had 12 complete resident cards and a complete decoded reference image; route revisits for Library, Search, Owned, and Import returned to complete Home; offline mode retained all 12 cards; rapid interaction recorded no DOM child-list or image-source mutations; console errors were zero.

## NEXT ACTION
Await next Deck Nexus task.

## IMPORTANT PRESERVATION NOTES
Do not reset IndexedDB, delete user data, discard legitimate working-tree changes, weaken ownership or pricing behavior, or move BoardState responsibilities across boundaries. Do not bundle `.codex` files into production.
