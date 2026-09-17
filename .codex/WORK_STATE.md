# Deck Nexus Work State

## CURRENT TASK
UI RESIDENCY / STATIC ASSET / PERSISTED DATA REPAIR

## CURRENT OBJECTIVE
Pause the completed Master Product Completion checkpoint while eliminating reload/reconstruction of already-loaded Home UI, static assets, persisted user data, and derived screen state. Restore the master checkpoint only after this repair is implemented, validated, deployed, and live-verified.

## LAST VERIFIED MILESTONE
Prior targeted background-work repair is deployed through `0f5e702`. UI residency implementation is now complete in the working tree: resident caches cover settings, decks, owned cards, and Home favorites; unchanged Home orbit/card arrays reuse stable identities; critical static assets have a manifest, preload/readiness registry, and service-worker shell coverage; shared card images retain session readiness.

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
IN PROGRESS

## IN PROGRESS
Commit/push the validated residency repair, verify the deployment, then perform live residency torture checks before restoring the Master Product Completion checkpoint.

## REMAINING
Commit/push, deployment, live verification, and restoration of the master checkpoint.

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

## TESTS STILL REQUIRED
None for the completed repair/checkpoint.

## KNOWN ISSUES
No new issue established yet. Existing `npm audit` reports two moderate transitive advisories in Vitest's test-only dependency tree.

## EXTERNAL BLOCKERS
None known.

## GIT STATE
Residency implementation is present in the working tree and has not been committed yet. No unrelated changes are present.

## DEPLOYMENT STATE
Previous GitHub Actions deployment workflows completed successfully:
- https://github.com/haroldh1995/Deck-Nexus/actions/runs/35162772500
- https://github.com/haroldh1995/Deck-Nexus/actions/runs/35162771524
- https://github.com/haroldh1995/Deck-Nexus/actions/runs/35163291394
- https://github.com/haroldh1995/Deck-Nexus/actions/runs/35163290953

## LIVE VERIFICATION STATE
Previous live verification passed at 390x844 for the background-work repair. Residency live verification is pending commit/deployment.

## NEXT ACTION
Commit the intended residency changes, push `main`, verify Actions deployment, then live-test Home residency and offline/revisit behavior before restoring the master checkpoint.

## IMPORTANT PRESERVATION NOTES
Do not reset IndexedDB, delete user data, discard legitimate working-tree changes, weaken ownership or pricing behavior, or move BoardState responsibilities across boundaries. Do not bundle `.codex` files into production.
