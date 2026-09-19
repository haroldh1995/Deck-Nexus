# Deck Nexus Work State

## CURRENT TASK
MASTER STARTUP EXPERIENCE — REAL STARTUP COORDINATOR + MAGICAL LOADING UI

## CURRENT OBJECTIVE
Implement a truthful event-driven startup coordinator and magical loading experience above the completed atomic Home readiness barrier. The Master Product Completion task remains paused and must not resume automatically.

## LAST VERIFIED MILESTONE
Home zero-lag release gate committed as `36ba3d2`, pushed, deployed, and live-verified. The repair removes per-frame semantic React commits, reuses the orbit transform buffer, pauses parallax/particles during active orbit motion, keeps background jobs deferred through settling, and passed the production-build 500-interaction stress gate on Chromium and mobile Chromium.

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
Startup coordinator, status adapter, and complete-before-reveal loading UI.

## REMAINING
Implement and validate the startup architecture, then commit, push, deploy, and live-verify. Do not resume Master Product Completion after this task.

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
- Focused Home/orbit/background tests after the repair: 3 files, 25 tests passed.
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
- Deterministic Home zero-lag E2E stress: 500 mixed interactions passed on production output in Chromium and mobile Chromium with stable card elements, zero child-list mutations, zero image-source mutations, stable decoded artwork, bounded single-flight RAFs, no page errors, and no overflow.
- Full E2E regression after the repair: 38 tests passed on Chromium and mobile Chromium with serialized workers.
- Final typecheck, lint, unit suite (31 files, 161 tests), and production build passed.
- Live production verification after deployment: 60-second rapid swipe/reverse/interrupt torture test passed with all 12 cards stable and complete; Library, Search, Owned, Scanner, and Import route returns passed; offline Home torture retained all 12 cards and decoded artwork.
- UI residency repair: stable Home card identities and resident data resources for settings, decks, owned cards, and favorites; static asset manifest and image readiness registry; cached Home/workspace artwork; route consumers moved off repeated deck/collection/settings reads.
- Live residency verification: Home remained complete after 5 seconds, 50 rapid direction-reversing drags, Library/Search/Owned/Import revisits, and offline mode. Live screenshot: `output/playwright/live-residency-839bcff.png`.

## TESTS STILL REQUIRED
- None for this release gate.

## DEPLOYMENT RETRY
- The custom Pages artifact workflow for `b3b69d6` and checkpoint `1ab9024` hit the known intermittent IndexedDB timing-test failure before the build step, while the parallel default Pages workflow served the repository source fallback.
- Final retry commit `2166b75ca395e87cfc9e397454f7c5689ddfa802` completed both custom validation/build/deploy and the parallel Pages workflow successfully: runs `35306054762` and `35306054169`.
- Workflow retry commit `0cc990bce5173f7b7905d305503aa90e44db1d9a` completed both workflows successfully: runs `35306802500` and `35306799748`.

## LOCAL VALIDATION MILESTONE
- Focused Home/unit checks: 3 files, 29 tests passed.
- Full unit suite: 31 files, 161 tests passed.
- Typecheck, lint, and production build passed.
- Production-preview E2E: 38 tests passed on Chromium and mobile Chromium.
- The deterministic Home gate now performs 1,000 mixed interactions on each browser project and passed with zero incomplete DOM/visual samples, zero child-list mutations, zero static asset requests caused by orbit movement, stable card identities, stable image source, bounded RAFs, and no page errors.
- Production preview screenshot spot-check showed every card retaining frame, icon, title, description, and action at initial and moved positions.

## KNOWN ISSUES
Existing `npm audit` reports two moderate transitive advisories in Vitest's test-only dependency tree. Physical iPhone Safari was not available; mobile Chromium/iPhone-sized production validation was completed.

## ATOMIC HOME ROOT CAUSE AND CORRECTION
- Root cause: Home orbit depth styling intentionally set `.home-orbit-card__copy` opacity from frontness and set copy/action opacity to `0` for `.is-rear`; the initial/return intro also animated individual cards from hidden to visible. This made the DOM retain a card while its title, description, and action visually disappeared as the orbit moved, matching the supplied frame/icon-only screenshots.
- Correction: Home cards now expose one complete static subtree with stable destination identity, no detail-level content hiding, no card summon animation, and a monotonic scene-level `PREPARING` to `READY` barrier. Static artwork is preloaded and decoded with fonts before reveal; every required card element is verified before the scene becomes interactive.
- Regression coverage: production E2E now runs 1,000 mixed orbit interactions and asserts complete DOM/visual card content, stable card identity, no static asset requests/source mutations, no child-list mutations, bounded RAFs, and no page errors.

## EXTERNAL BLOCKERS
None known.

## GIT STATE
Remote `main` contains the Home atomic readiness implementation at `b3b69d645b5870f9adef4e306a2d0258b03ab161` and the verified deployment checkpoint `0cc990bce5173f7b7905d305503aa90e44db1d9a`. This final state checkpoint is being recorded now. No unrelated changes are present.

## DEPLOYMENT STATE
Home release-blocker commit `36ba3d279beb0e0c88b4bbe92e8751aff54b07e5` deployed successfully:
- https://github.com/haroldh1995/Deck-Nexus/actions/runs/35291700452
- https://github.com/haroldh1995/Deck-Nexus/actions/runs/35291699894

The final checkpoint commit `d77aa99a884ee1b60524fd6b9938a4d16536996a` also deployed successfully after a retry of a transient pre-existing BoardState validation timing test:
- https://github.com/haroldh1995/Deck-Nexus/actions/runs/35292424694
- https://github.com/haroldh1995/Deck-Nexus/actions/runs/35292423557

The final checkpoint commit `f74d9829d306529bebb0ce3819fb811ab5759a0c` had a Pages build/deployment success, while the separate repository validation workflow again hit the same pre-existing BoardState timing-test failure; the application artifact and live code were unchanged from the successful Home deployment.
- https://github.com/haroldh1995/Deck-Nexus/actions/runs/35292896029
- https://github.com/haroldh1995/Deck-Nexus/actions/runs/35292895195

The final checkpoint commit `c5386885cd5dfa8db0c6560fcc6172842cd7451b` completed both repository validation and Pages deployment successfully:
- https://github.com/haroldh1995/Deck-Nexus/actions/runs/35293071450
- https://github.com/haroldh1995/Deck-Nexus/actions/runs/35293070481

The final checkpoint commit `e1f1c01d7c7ba9bbb4a1dfc71e97c5b49658beb9` completed both repository validation and Pages deployment successfully:
- https://github.com/haroldh1995/Deck-Nexus/actions/runs/35293237611
- https://github.com/haroldh1995/Deck-Nexus/actions/runs/35293237114

The latest state-only checkpoint `da47d6ca334bb3fc6de8fa4e76c3d50d479c9403` produced a successful Pages build/deployment; its separate repository validation workflow repeated the pre-existing BoardState timing-test failure, while the Home artifact remained unchanged.
- https://github.com/haroldh1995/Deck-Nexus/actions/runs/35293374933
- https://github.com/haroldh1995/Deck-Nexus/actions/runs/35293373718

The final checkpoint `2cd40f0a5d2cd9fe2eedc6545a8dc2c82161b00a` completed both repository validation and Pages deployment successfully:
- https://github.com/haroldh1995/Deck-Nexus/actions/runs/35293684864
- https://github.com/haroldh1995/Deck-Nexus/actions/runs/35293684028

Previous residency deployment workflows completed successfully:
- https://github.com/haroldh1995/Deck-Nexus/actions/runs/35183398098
- https://github.com/haroldh1995/Deck-Nexus/actions/runs/35183398687

Previous GitHub Actions deployment workflows completed successfully:
- https://github.com/haroldh1995/Deck-Nexus/actions/runs/35162772500
- https://github.com/haroldh1995/Deck-Nexus/actions/runs/35162771524
- https://github.com/haroldh1995/Deck-Nexus/actions/runs/35163291394
- https://github.com/haroldh1995/Deck-Nexus/actions/runs/35163290953

## LIVE VERIFICATION STATE
Verified live at `https://haroldh1995.github.io/Deck-Nexus/?live-motion=2166b75` in a production iPhone-sized 390x844 Chromium session after deployment. A 60-second rapid swipe/reverse/interrupt torture test completed 164 mixed gestures with all 12 cards complete before and after, zero static asset requests during motion, and no page errors. Screenshot `output/playwright/live-atomic-motion-2166b75.png` shows complete frame, icon, title, description, and action content. Live route-return checks covered Library, Search, Owned, Scanner, and Import; offline reload retained all 12 complete cards.
Final deployed build recheck at `https://haroldh1995.github.io/Deck-Nexus/?live-final=0cc990b` confirmed 12 complete cards before and after 250 mixed gestures, zero static image requests during motion, and zero page errors. Screenshot: `output/playwright/live-final-0cc990b.png`.

## NEXT ACTION
Await explicit instruction; keep Master Product Completion paused and do not start other Deck Nexus work automatically.

## IMPORTANT PRESERVATION NOTES
Do not reset IndexedDB, delete user data, discard legitimate working-tree changes, weaken ownership or pricing behavior, or move BoardState responsibilities across boundaries. Do not bundle `.codex` files into production.

## STARTUP IMPLEMENTATION CHECKPOINT
- Added a singleton `StartupCoordinator` with typed task definitions, dependency checks, immutable snapshots, critical/noncritical state, real unit progress, cache-hit metadata, generation protection, retry, and in-flight request deduplication.
- Startup tasks are mapped to the actual current pipeline: application core, settings hydration, resident workspace data, fonts, Home assets, Home structure, geometry, interaction, and optional owned-card hydration.
- `HOME_READY` is derived once from the coordinator's critical Home dependency set. Home remains mounted behind an inert startup overlay and is not revealed until its complete card DOM is verified.
- Added `StartupStatusAdapter` with deterministic task priority and magical/plain-language copy. Progress is coalesced at the presentation boundary and never synthesized by timers.
- Added a compositor-driven magical startup screen with crystal, energy beam, rings, projections, real stage segments, accessible live status, failure retry, responsive mobile/landscape layouts, and reduced-motion behavior.
- Added development-only `startup-sim=slow|failure|parallel` simulation facilities. Production has no artificial startup timing or fake progress.
- Documented the permanent complete-before-reveal and startup truth laws in `docs/architecture/startup-truth.md`.
- Focused startup/coordinator/status/loader tests: 3 files, 9 tests passed. Slow-startup E2E simulation passed on Chromium and mobile Chromium. Existing Home unit coverage passed.
