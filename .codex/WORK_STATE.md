# Deck Nexus Work State

## CURRENT TASK
HOME UI ZERO-LAG RELEASE BLOCKER

## CURRENT OBJECTIVE
Eliminate the remaining application-controlled Home interaction catch-up under aggressive input. The Master Product Completion task is paused until this release gate passes.

## LAST VERIFIED MILESTONE
UI residency repair committed as `839bcff`, pushed to `origin/main`, deployed successfully, and live-verified at 390x844. The current blocker repair is locally validated: semantic selection commits no longer run on every visual orbit frame, transforms reuse a stable buffer, parallax/particles pause during active orbit motion, active orbit work keeps background jobs deferred through settling, and the production-build 500-interaction stress gate passed on Chromium and mobile Chromium.

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
None for the Home release gate. The Master Product Completion task remains paused and must resume from its existing checkpoint only as a separate future task.

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
None for the Home release gate.

## KNOWN ISSUES
Existing `npm audit` reports two moderate transitive advisories in Vitest's test-only dependency tree. Physical iPhone Safari was not available; mobile Chromium/iPhone-sized production validation was completed.

## EXTERNAL BLOCKERS
None known.

## GIT STATE
Remote `main` contains `36ba3d279beb0e0c88b4bbe92e8751aff54b07e5` for the Home release-blocker repair. The final checkpoint update is pending commit/push. No unrelated changes are present.

## DEPLOYMENT STATE
Home release-blocker commit `36ba3d279beb0e0c88b4bbe92e8751aff54b07e5` deployed successfully:
- https://github.com/haroldh1995/Deck-Nexus/actions/runs/35291700452
- https://github.com/haroldh1995/Deck-Nexus/actions/runs/35291699894

The checkpoint-only workflow for `e8d148c25fd8c2bc3d84b5256f57e44d8e1d9b3d` had a transient failure in the pre-existing BoardState validation timing test; its independent Pages build/deployment completed successfully. A retry is triggered by the checkpoint below.

Previous residency deployment workflows completed successfully:
- https://github.com/haroldh1995/Deck-Nexus/actions/runs/35183398098
- https://github.com/haroldh1995/Deck-Nexus/actions/runs/35183398687

Previous GitHub Actions deployment workflows completed successfully:
- https://github.com/haroldh1995/Deck-Nexus/actions/runs/35162772500
- https://github.com/haroldh1995/Deck-Nexus/actions/runs/35162771524
- https://github.com/haroldh1995/Deck-Nexus/actions/runs/35163291394
- https://github.com/haroldh1995/Deck-Nexus/actions/runs/35163290953

## LIVE VERIFICATION STATE
Verified live at `https://haroldh1995.github.io/Deck-Nexus/?home-zero-lag=36ba3d2` in an iPhone-sized 390x844 browser session after deployment. A 60-second rapid swipe/reverse/interrupt torture test retained all 12 card identities, complete artwork, stable image source, zero child-list mutations, zero image-source mutations, no overflow, and no page errors. Live route-return checks covered Library, Search, Owned, Scanner, and Import; a further offline Home torture test retained all 12 complete cards and the decoded artwork.

## NEXT ACTION
Commit and push this final checkpoint. Await the next task; keep Master Product Completion paused until explicitly resumed.

## IMPORTANT PRESERVATION NOTES
Do not reset IndexedDB, delete user data, discard legitimate working-tree changes, weaken ownership or pricing behavior, or move BoardState responsibilities across boundaries. Do not bundle `.codex` files into production.
