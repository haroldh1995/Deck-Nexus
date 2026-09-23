# Deck Nexus Work State

## CURRENT TASK
DECK NEXUS MASTER SCANNER PRODUCTION REBUILD

## CURRENT OBJECTIVE
Production zero-touch handheld and feeder scanning, continuous new-physical-card detection, precision-first canonical/printing resolution, exactly-once capture feedback, durable collection/deck intake, and mobile review repair. The larger unrelated Deck Nexus completion effort remains paused.

## LAST VERIFIED MILESTONE
The Fodder Cannon canonical-image and older-printing matching fix is committed as `058c5cb7ff5f4aed125dc4636d4db44895a38a2b`, pushed, deployed, and live-smoke-verified. Physical card hardware and iPhone Safari remain unavailable.

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
RELEASE BLOCKER

## IN PROGRESS
The definitive scanner rebuild and the non-completing handheld repair are complete for the available environment. Master Product Completion remains paused.

## REMAINING
None for the available environment. Physical Fodder Cannon hardware and iPhone Safari remain unavailable. Do not resume Master Product Completion automatically.

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
- None for the available environment.
- Physical Fodder Cannon/iPhone Safari verification remains unavailable in this environment and must not be claimed.

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

## SCANNER REBUILD CHECKPOINT
- Current task remains the release blocker: scanner correctness/completion, Scryfall printing matching, and mobile review repair. Master Product Completion remains paused.
- First static divergence established in the old pipeline: camera frames were stretched from the full video into a fixed canvas even though the visible guide is an inset `object-fit: cover` region. OCR then read one title-like rectangle from the wrong coordinate space. The recognition pipeline discarded region provenance and all non-title evidence before candidate resolution.
- Old false-result mechanism established from code: the first OCR line was treated as a likely card name, then sent to a single exact/fuzzy Scryfall name lookup. The result was accepted with `Math.max(baseConfidence, 0.86)` for exact names or `0.68` for fuzzy names; `confidenceStatus` converted scores at or above `0.88` to `matched`. The displayed approximately 90% was therefore an uncalibrated composite/OCR/name-match heuristic, not calibrated card-identity confidence. The supplied production video was not reproducible with physical camera hardware in this environment, so stale-result/cache/UI contribution to that exact event is not claimed as proven.
- Added visible-guide/object-fit source mapping and guide-aligned capture. Added region OCR for title, type line, rules/printed text, stats, set/collector, and artist. Added conservative evidence quality, garbage OCR rejection, positive-vs-contradiction scoring, candidate uniqueness, temporal target ownership, separate card identity and printing identity statuses, and exact-printing verification from reliable set plus collector evidence.
- Scryfall mapper/domain models now preserve printed name/type/text fields where available. Cached-first candidate lookup avoids unnecessary network waits; prices remain downstream. Historical printed text is accepted as distinct evidence from current Oracle text. Unknown printing does not copy a candidate's set, collector, finish, or price into the scan record.
- Added generation-owned recognition jobs and target exit/re-entry handling. Stale results are discarded after target change or exit; one target cannot duplicate while held. Manual scanner corrections mark identity and selected printing as user-confirmed/verified. Collection application no longer auto-commits unconfirmed assumed/low-confidence scans.
- Added development-gated structured scanner traces for ownership, frame dimensions, frame analysis, final card/printing IDs, and confidence values. No production raw OCR logging or camera dump was added.
- Added `docs/architecture/scanner-correctness.md` documenting the permanent scanner and mobile overlay laws.
- Batch Review is now a deliberate mobile full-screen workflow: safe-area-aware dynamic viewport, inert covered scanner, compact header/count summary, one scrolling list owner, responsive action layout, focus restoration, distinct card-vs-printing states, unresolved-card protection, and a printing-only canonical search correction path. Desktop remains a contained modal.
- The original generic Fodder Cannon tests retain an Eighth Edition comparison printing, while the supplied physical photograph is now represented by canonical Scryfall Urza's Destiny set `uds`, collector `131`, artist `DiTerlizzi`, Scryfall ID `229ba320-69c9-4400-a0d7-f0f79e8d9856`. The new regression proves the photographed `131/143` footer can resolve the correct printing from title, collector number, and artist, and the review UI uses the canonical Scryfall image instead of the physical thumbnail whenever a match exists.

## SCANNER VALIDATION
- Focused scanner matching, camera geometry, and target lifecycle tests: 10 passed.
- Full unit suite after the final scanner/mobile changes: 37 files, 180 tests passed. Final focused scanner tests: 10 passed.
- Typecheck, lint, and production build passed after the scanner and mobile overlay changes.
- Scanner/Batch Review E2E flow passed on Chromium and mobile Chromium after the final printing-correction and mobile geometry changes: 2 passed. The flow validates camera harness acquisition, persisted batch records, duplicate suppression, feeder recovery, Batch Review, and mobile modal geometry with no body overflow and one list scroll owner.
- Full production-preview E2E regression passed on Chromium and mobile Chromium: 40 tests passed. Physical-camera video and physical-device Safari were unavailable; deterministic media harness validation was used and no physical Fodder Cannon live scan is claimed.

## SCANNER GIT / DEPLOYMENT
- Scanner implementation commit `ead0ff9520dc0d11347f655f50558e002d650e1f` was pushed to `origin/main`.
- GitHub Actions completed successfully for the scanner build/deployment: deploy run `35564401044`; Pages build/deployment run `35564400222`.
- The working tree contains only the scanner correctness, Scryfall model, target lifecycle, mobile review, focused tests, architecture documentation, and this checkpoint. No unrelated product work was resumed.

## SCANNER LIVE VERIFICATION
- Live production smoke verification completed at `https://haroldh1995.github.io/Deck-Nexus/?scanner-live=ead0ff9` and `/Deck-Nexus/scan?scanner-live=ead0ff9` using Chromium at a 390x844 mobile viewport.
- Home reached `data-home-readiness="ready"`; Scanner loaded with the current production bundle, no page errors, no body overflow, and the camera-permission surface was present. Screenshot: `output/playwright/live-scanner-ead0ff9.png`.
- Physical Fodder Cannon scanning and physical-device Safari were unavailable. No physical scan, exact live printing verification, or physical-device result is claimed.
- Deterministic camera-harness E2E covered scan completion, duplicate suppression, feeder recovery, Batch Review, correction paths, and mobile geometry. Live production Batch Review was not claimed without a physical or deterministic media session on the deployed bundle.
- Master Product Completion remains paused. Await explicit instruction; do not resume unrelated Deck Nexus work automatically.

## MASTER SCANNER PRODUCTION REBUILD CHECKPOINT
- Physical target identity is now explicitly capture-committed and separate from canonical card and printing identity. After a durable capture, two coherent changed frames can create a new target without requiring an empty frame; fingerprint, geometry, and too-close replacement evidence are used while ordinary movement remains suppressed.
- Recognition acquisition is locked before asynchronous preparation, stale generations are rejected, and review/pause/visibility/camera refresh abort active work and invalidate ownership. Development harness cards are gated behind `import.meta.env.DEV`.
- Scanner auto-starts when the browser reports camera permission already granted. Camera startup no longer creates an empty batch; the durable batch is created at first physical capture. Ordinary handheld scanning remains automatic after the initial permission gesture.
- `CARD_CAPTURE_SUCCEEDED` is represented by a capture-id keyed semantic feedback path. One durable capture produces one success event and at most one confirmation beep/haptic attempt; sound failure does not fail capture and muted captures are still marked emitted.
- Capture insertion is idempotent by stable record id. Owned collection commit skips applied/removed records, accumulates quantities by canonical name and stable printing key, and leaves unresolved/review records in `partially_applied` state instead of silently losing them.
- Added direct-replacement lifecycle tests, exactly-once feedback tests, and repository quantity/idempotency tests. Focused validation currently passes: 3 files, 10 tests; scanner feeder/review E2E completed for Chromium and mobile Chromium after the extension. Typecheck and lint pass.

## MASTER SCANNER FINAL LOCAL VALIDATION
- Root cause remains the old coordinate-space divergence: the full video was stretched into a fixed canvas while the visible guide used an inset `object-fit: cover` region. The old name-only path then discarded region provenance and non-title evidence, and the displayed approximately 90% was an uncalibrated OCR/name-match heuristic rather than card-identity confidence.
- Final local validation after the zero-touch/feeder extension: 38 Vitest files, 187 tests passed; full production-preview E2E 40 tests passed on Chromium and mobile Chromium with serialized workers; `npx tsc -b --pretty false`, `npm run lint -- --quiet`, and `npm run build` passed.
- The full E2E run covers scanner auto acquisition through the deterministic development camera harness, durable batch persistence, feeder recovery, Batch Review, correction paths, mobile geometry, and repository regression. Physical camera/card and iPhone Safari testing remain unavailable.
- Deployment and live production-bundle verification for the stuck-state repair passed; Master Product Completion remains paused.

## STUCK HANDHELD AUTO-SCAN REPAIR CHECKPOINT
- First divergence for the new failure was target acquisition: before the first terminal capture, every sufficiently different handheld frame caused `acquireTarget` to create a new generation. `ScanCardsScreen` interpreted that as `possible_new_target`, cleared frame memory, and returned before recognition. Repeated handheld motion therefore prevented stability and left the batch at zero.
- A second blocking gate was frame quality: `frameStable` required `!tooClose`, so a large but still usable handheld card could never become stable. `tooClose` is now advisory for handheld scanning; only unusable quality prevents recognition.
- Uncommitted targets now retain one generation while motion/autofocus changes fingerprints. Replacement generations remain guarded after a committed capture. A bounded evidence budget allows an acceptable frame to start recognition when ideal stability is not reached, and an 8-second recognition budget converts a non-returning recognition attempt into an unresolved durable capture.
- Added development-only transition diagnostics for target rejection, stabilization, capture, recognition budget exhaustion, durable insertion, target age, geometry, quality, coverage, and recognition state. Moved `Start Batch` into advanced/manual controls so it is not a visible prerequisite for ordinary zero-touch scanning.
- Added a deterministic handheld regression with large pre-capture motion and no capture-button interaction. It reaches a batch entry and exactly one capture event; the full 40-test E2E suite passes.

## MASTER SCANNER DEPLOYMENT AND LIVE VALIDATION
- Commit `955d89f5ac865d547da3436cb6a06479bad15e05` was pushed to `origin/main`.
- GitHub Actions passed for the scanner extension: custom deploy run `35656348746`; Pages build/deployment run `35656347480`.
- Live scanner smoke at `https://haroldh1995.github.io/Deck-Nexus/scan?scanner-live=955d89f` loaded the current production bundle at an iPhone-sized Chromium viewport (`393x659` in the CLI device profile), with body width equal to viewport width and no visible development harness/simulation controls. The camera permission surface was present. Screenshot: `output/playwright/live-scanner-955d89f.png`.
- No physical Fodder Cannon card scan, physical iPhone Safari scan, exact live printing verification, or hardware feeder verification is claimed. Deterministic media-harness tests remain the available scanner verification.

## STUCK HANDHELD DEPLOYMENT AND LIVE VALIDATION
- Repair commit `fa9126544c86021354106deb54aedf73f291e460` was pushed to `origin/main`.
- GitHub Actions passed: custom deploy run `35676529758`; Pages build/deployment run `35676529208`.
- Live scanner smoke at `https://haroldh1995.github.io/Deck-Nexus/scan?scanner-stuck=fa91265` loaded the current production bundle at iPhone-sized Chromium viewport `393x659`, with body width equal to viewport width, no development simulation text, and no visible `Start Batch` in the primary scanner actions. The camera permission surface was present. Screenshot: `output/playwright/live-scanner-fa91265.png`.
- No physical handheld video/card scan, physical iPhone Safari scan, exact live printing verification, or hardware feeder verification is claimed.

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

## STARTUP FINAL VALIDATION
- Typecheck, lint, and production build passed.
- Full unit suite passed: 34 files, 170 tests.
- Production-preview E2E regression passed: 38 tests on Chromium and mobile Chromium with serialized workers. The final run included Home atomic readiness, 1,000-interaction Home stress coverage, route workflows, and interaction performance.
- Development slow-startup simulation passed on Chromium and mobile Chromium; critical failure simulation surfaced `NEXUS DISRUPTED` without revealing Home.
- Production visual checks passed at mobile and desktop viewports. Live loader/ready screenshot: `output/playwright/live-startup-41dc8d5.png`.

## STARTUP GIT / DEPLOYMENT
- Commit `41dc8d52d36c18404c1e8b68714e80ebd9ed1af0` pushed to `origin/main`.
- GitHub Pages deployment succeeded: build/deploy run `35408582723`; repository validation/deploy run `35408583409`.
- Final state checkpoint `8f2773bac579be7c7acd85b2578a74ba0cd82b36` pushed after verification; its Pages deployment/build runs `35408863255` and `35408863961` also completed successfully.
- Service-worker cache version advanced to `deck-nexus-shell-2026-09-18-startup`.

## STARTUP LIVE VERIFICATION
- Live URL verified: `https://haroldh1995.github.io/Deck-Nexus/?startup-live=41dc8d5`.
- Live production Home reached `data-home-readiness="ready"` with all 12 cards complete and decoded artwork.
- Live torture ran 300 mixed touch interactions over approximately 54 seconds; zero static asset requests during motion, zero page errors, stable complete cards, and the versioned service-worker cache was present.
- Live offline follow-up ran 60 mixed interactions after network was disabled; all 12 cards remained complete with zero page errors.
- Physical iPhone Safari was not available; verification used production Chromium at an iPhone-sized 390x844 viewport.

## COMPLETE SCANNER ARCHITECTURE REBUILD CHECKPOINT
- Current task: DECK NEXUS MASTER SCANNER PRODUCTION REBUILD. Master Product Completion remains paused.
- Root causes carried forward: the original false positive came from guide/full-video coordinate divergence followed by a name-only fuzzy acceptance path; the stuck handheld state came from pre-capture target-generation churn plus a hard `tooClose` stability gate. The old approximately 90% was an uncalibrated OCR/name heuristic, not card identity probability.
- Pipeline changes: added explicit detection, source-space quadrilateral, perspective normalization, bounded enhancement, quality fallback, structured recognition, matching, confidence, duplicate, batch and review stages. The live guide is now the analysis crop, and recognition receives normalized original/enhanced card canvases rather than an unnormalized camera frame.
- Recognition changes: added mana-region OCR, enhanced retry/field merging, source-owned diagnostics, and degraded-frame evidence budgets. A detected target that cannot identify is durably captured as unresolved/review instead of hanging indefinitely. Timeout captures retain correction thumbnails when that setting is enabled.
- Scryfall/matching: existing canonical multi-field matcher remains authoritative; title, mana, type, rules, set, collector, artist, stats and layout-aware canonical fields are preserved with contradiction penalties and separate card/printing decisions. Prices remain downstream.
- Target/async changes: every recognition job remains generation-owned; stale results are discarded. Uncommitted handheld motion does not churn target generations; committed replacement requires coherent change. Normal movement remains duplicate-suppressed, while legitimate identical copies remain scannable.
- Zero-touch/audio/batch: scanner auto-queues after detection without Start Batch; terminal durable insertion remains the sole capture-feedback trigger. Exactly-once feedback and idempotent records/quantity semantics remain preserved.
- Mobile review: prior full-screen mobile Batch Review and shared overlay repair remain intact; no unrelated UI work was resumed.
- Added `docs/architecture/scanner-pipeline.md`, modular scanner stage files, pipeline-stage diagnostics, source-space detection regression coverage, and permanent completion/correctness laws.
- Tests: `npx vitest run src/tests/scannerCamera.test.ts src/tests/scannerLifecycle.test.ts src/tests/scannerMatching.test.ts --reporter=dot --maxWorkers=1` passed (3 files, 19 tests); full `npm test -- --reporter=dot --maxWorkers=1` passed (38 files, 188 tests); focused scanner/feeder E2E passed (2 tests, Chromium/mobile Chromium); full E2E passed (40 tests, Chromium/mobile Chromium); `npx tsc -b --pretty false`, `npm run lint -- --quiet`, `npm run build`, and `git diff --check` passed.
- Known issues/external blockers: no physical Fodder Cannon/video/iPhone Safari/hardware feeder test was available; no physical accuracy percentage is claimed. Live deployment verification remains pending this checkpoint commit.
- Git state: implementation changes are uncommitted and limited to scanner modules, scanner tests, architecture documentation, and this checkpoint.
- Deployment/live state: prior deployment was live-verified for the stuck-state repair; this new modular pipeline has not yet been pushed or live-verified.
- Next action: commit, push, wait for GitHub Pages, then verify the deployed scanner route and mobile review surface without claiming physical-camera results.

## COMPLETE SCANNER DEPLOYMENT AND LIVE VERIFICATION
- Commit `c2551863abb261586d392d88c7cbc142008e9660` was pushed to `origin/main`.
- GitHub Actions succeeded for the implementation commit: repository deploy run `35785146986`; Pages build/deployment run `35785145021`.
- Live production smoke at `https://haroldh1995.github.io/Deck-Nexus/scan?scanner-rebuild=c255186` used Chromium at `393x844`. The scanner route loaded the current production bundle with no page errors, body width and document width both `393px`, the camera permission surface present, and no `Start Batch` button in primary scanner actions.
- The deployed permission surface stated that video stays on-device and offered camera permission/manual entry. Physical Fodder Cannon, physical iPhone Safari, exact live printing, and hardware-feeder verification were not available and are not claimed.
- Final git state is clean and Master Product Completion remains paused. Stop after this scanner task; do not resume unrelated work automatically.

## FODDER CANNON CANONICAL IMAGE / PRINTING FIX CHECKPOINT
- New ground truth from the supplied photographs: the physical card is Fodder Cannon, Urza's Destiny (`uds`) collector `131` of `143`, artist DiTerlizzi. Canonical Scryfall printing ID is `229ba320-69c9-4400-a0d7-f0f79e8d9856`.
- First matching gap found: the footer OCR only expected a `set + collector` pair and could not preserve an older `131/143` collector format. Added full-footer OCR, standalone collector-number parsing, and artist extraction for older cards.
- Printing resolution now accepts a unique reliable collector match within the already verified canonical card when artist evidence corroborates it, while retaining set+collector as the strongest path. The photographed UDS printing regression is covered without special-casing Fodder Cannon.
- Review UI now prefers the matched Scryfall `imageUri` and canonical metadata for resolved cards. The physical capture thumbnail remains available only as fallback evidence for unresolved/review captures; it is no longer the primary image for a resolved Scryfall record.
- Added Scryfall canonical-image E2E coverage and collector/footer parsing tests. Focused scanner tests passed: 3 files, 17 tests. Full unit suite passed: 39 files, 191 tests. Typecheck, lint, build, and diff check passed. Scanner E2E passed on Chromium and mobile Chromium with canonical Scryfall image assertion.
- Physical camera/video testing remains unavailable. The supplied images establish the expected UDS printing; they do not constitute a live camera scan. Deployment for this follow-up fix is pending.

## FODDER CANNON FIX DEPLOYMENT AND LIVE VERIFICATION
- Commit `058c5cb7ff5f4aed125dc4636d4db44895a38a2b` was pushed to `origin/main`.
- GitHub Actions succeeded: deploy run `35806800326`; Pages build/deployment run `35806799585`.
- Live production smoke at `https://haroldh1995.github.io/Deck-Nexus/scan?fodder-cannon=058c5cb` used Chromium at `393x844`. The scanner route loaded the new production bundle with no page errors, body/document width remained `393px`, the camera permission surface was present, and `Start Batch` was absent from primary actions.
- No physical camera scan was performed. The supplied physical and Scryfall screenshots were used as regression ground truth; exact live OCR and physical-device verification remain unavailable.

## COLLECTION SCANNER RESEARCH AND HANDHELD COMPLETION FOLLOW-UP
- Current task: DECK NEXUS COLLECTION SCANNER RESEARCH AND HANDHELD AUTO-SCAN COMPLETION. Home Screen remains unchanged; unrelated master-product work remains paused.
- Research baseline: official ManaBox documentation confirms continuous art-based scanning, set lock, foil priority, session overview, bulk edits, and Quick Mode versus stricter manual confirmation. Official TCGplayer documentation confirms scan sessions, batch persistence, pre-scan condition/printing choices, confidence buckets, side-by-side match review, unidentified-card recovery, and manual find-match correction. Delver Lens documents fast scanning, collection management, exports, and price enrichment. These patterns informed optional session filters and the existing review-first safety model; no proprietary implementation was copied.
- Root cause repaired in this follow-up: a newly detected replacement target was marked `possible_new_target` and returned before the same frame could enter the normal quality/evidence path. The replacement now establishes ownership and continues through acquisition instead of becoming a dead-end state. In stacking-feeder mode, close-card coverage is now a warning unless clipping or unusable quality makes it a genuine blocker.
- Scanner session matching: optional set-lock and language controls narrow Scryfall candidate queries without being treated as physical evidence or exact-printing proof. Name-only fallback is suppressed when a session constraint is active so a different set/language cannot silently win.
- Diagnostics/documentation: added a development transition record for new-target acquisition and documented the completion path and session constraints in `docs/architecture/scanner-pipeline.md`.
- Tests: focused scanner recognition/lifecycle/camera tests passed (3 files, 16 tests); scanner persistence/feeder E2E passed on Chromium and mobile Chromium (2 tests); typecheck and production build passed; lint passed with the repository's pre-existing React hook warnings (Home plus scanner dependency warnings).
- Known issues/external blockers: physical iPhone/card video, physical Fodder Cannon live scan, hardware feeder, and live Scryfall OCR verification remain unavailable in this environment. No physical accuracy percentage is claimed. The previous invalid `--runInBand` Vitest flag was rejected before tests ran; the repository's actual Vitest command passed afterward.
- Git state: follow-up implementation is currently uncommitted and limited to scanner screen, scanner recognition, scanner tests, scanner pipeline documentation, and this checkpoint.
- Deployment state: previous `9a62f05` scanner deployment remains live-verified; this follow-up has not yet been pushed or live-verified.
- Next action: review diff, run final regression checks, commit, push, wait for deployment, then live-smoke the scanner route and mobile review without claiming physical-camera verification.

## COLLECTION SCANNER FOLLOW-UP DEPLOYMENT AND LIVE VERIFICATION
- Commit `1df79801d08ff0eb4cffa094c5858a5f1c39bfa0` was pushed to `origin/main`.
- GitHub Actions succeeded for the follow-up: Deploy Deck Nexus run `35808751021`; Pages build/deployment run `35808750211`.
- Live production smoke at `https://haroldh1995.github.io/Deck-Nexus/scan?scanner-followup=1df7980` used headless Chromium at `393x844`. The scanner route loaded the current production bundle `index-BEaiRfOQ.js`, no page errors occurred, body/document widths were both `393px`, the camera-permission surface was present, and `Start Batch` was absent from primary scanner actions.
- No physical Fodder Cannon scan, physical iPhone Safari scan, hardware feeder verification, or live OCR/printing verification is claimed. Deterministic media-harness E2E remains the available camera verification.
- Final git state is clean. Master Product Completion remains paused; stop after this scanner follow-up and do not resume unrelated work automatically.

## VERIFIED-ONLY AUTOMATIC SCANNER POLICY
- Current task: VERIFIED-ONLY AUTOMATIC SCANNER RESULTS. Home Screen remains unchanged.
- Automatic camera intake now publishes only results whose canonical card identity is `verified`. Review-required, ambiguous, unresolved, timeout, and recognition-error outcomes are silently suppressed from the visible batch and do not emit confirmation audio, capture notifications, or success feedback.
- Suppressed physical targets are marked internally as complete for duplicate protection and re-arm behavior, so uncertain evidence cannot retry forever or create an empty automatic batch. Existing manually started batches remain intact.
- Duplicate-frame suppression is silent. The scanner no longer announces that a duplicate was ignored.
- Added `isVerifiedScannerResult` coverage and updated scanner correctness/pipeline documentation to make publication precision explicit.
- Validation: full unit suite passed (39 files, 193 tests); focused scanner suite passed (3 files, 17 tests); scanner/feeder E2E passed on Chromium and mobile Chromium (2 tests); typecheck, lint, build, and diff check passed. Lint retains only existing React hook warnings.
- Physical-device/card verification remains unavailable. No claim of physical Fodder Cannon verification is made.
- Git state: verified-only changes are uncommitted and limited to scanner logic, scanner tests, scanner documentation, and this checkpoint.
- Next action: review, commit, push, wait for deployment, and live-smoke the scanner route without claiming physical hardware verification.

## VERIFIED-ONLY POLICY FINAL VALIDATION
- Added bounded silent retry (up to three evidence attempts per physical target) before suppression, with target-keyed cleanup on exit, replacement, pause, refresh, and visibility changes.
- Final pre-commit validation passed after the bounded retry change: 39 files/193 unit tests, 3 focused scanner files/17 tests, 2 scanner E2E projects, typecheck, lint, build, and diff check.

## VERIFIED-ONLY DEPLOYMENT AND LIVE VERIFICATION
- Commit `217cca9505a1bbfa1189a8aaaa2cbaed4da6ea42` was pushed to `origin/main`.
- GitHub Actions succeeded: Deploy Deck Nexus run `35810188741`; Pages build/deployment run `35810188234`.
- Live production smoke at `https://haroldh1995.github.io/Deck-Nexus/scan?verified-only=217cca9` used headless Chromium at `393x844`. The scanner route loaded bundle `index-DCx7d_p7.js`, produced no page errors, body/document widths were both `393px`, the camera-permission surface was present, and Start Batch was absent from primary actions.
- No physical card, iPhone Safari, or hardware feeder verification is claimed. Final git state is pending this checkpoint-only update; Master Product Completion remains paused.

## APPLICATION ACTION AND REDUNDANCY AUDIT
- Current task: audit Deck Nexus actions, destinations, and redundant surfaces while preserving the Home Screen visual system and animation. Master Product Completion remains paused.
- Route audit: the permanent Home command routes were exercised by the existing Chromium/mobile E2E coverage; route definitions and internal navigation targets were reviewed against `AppShell` and the route table. Home visuals, animation, scene geometry, and interaction behavior were not changed.
- Functional bug fixed: Batch Review's `Review Assumed Only` button previously displayed a message but did not filter records. It now toggles a real review-needed filter with `aria-pressed` state and a return-to-all action.
- Functional bug fixed: removed scanner records remained in the active review list and batch summary after the Remove action. Active scanner state now excludes records marked `removed` while preserving the durable record in IndexedDB for audit/history.
- Redundancy audit: distinct destinations for owned inventory, custom collections, wishlist, upgrade lists, deck workflow, analyzer, import/export, and scanner review were retained because they have different data semantics. No safe consolidation was made that would remove an existing workflow.
- Regression coverage: added mobile/Chromium E2E assertions for the review filter toggle and removal behavior. Focused scanner E2E passed on both browser projects; full E2E passed all 40 tests across Chromium and mobile Chromium. Typecheck, lint, production build, and diff check passed; the full unit suite had already passed 39 files/193 tests before this focused UI change.
- Git/deployment state: action-audit changes are currently uncommitted and not deployed. Next action: run the post-change unit suite, review the final diff, commit/push, wait for GitHub Actions/Pages, then live-smoke route/action behavior. Physical-device verification remains unavailable.

## APPLICATION ACTION AUDIT DEPLOYMENT AND VERIFICATION
- Commit `89948ba3fdb1d781aa18740832084ab0fd312922` was pushed to `origin/main`.
- Post-change validation passed: full unit suite `39 files / 193 tests`; focused scanner E2E `2 passed`; full repository E2E `40 passed` across Chromium and mobile Chromium; `npx tsc -b --pretty false`; `npm run lint -- --quiet`; `npm run build`; and `git diff --check`.
- GitHub Actions succeeded for the audit commit: Deploy Deck Nexus run `35813528438`; Pages build/deployment run `35813527456`.
- Live production smoke at `https://haroldh1995.github.io/Deck-Nexus/scan?audit=89948ba` used headless Chromium at `393x844`. The current production bundle loaded without page errors, the Scanner heading and camera-permission surface were present, body width equaled viewport width, and `Start Batch` was absent from primary scanner actions.
- Home Screen visual/animation regression coverage remained green; no Home scene or animation files were changed.
- Physical iPhone/card, physical Fodder Cannon, hardware feeder, and physical camera accuracy verification remain unavailable and are not claimed. Final git state is clean; Master Product Completion remains paused.

## SCANNER SIGHTING / SCRYFALL COLLECTION REPAIR
- Current task: repair the scanner path evidenced by the supplied handheld screenshots. Home Screen visual and animation remain unchanged; unrelated master-product work remains paused.
- Root causes found in the current code: the recovery prompt was rendered for an empty abandoned batch, and the frame analyzer's global edge/luminance bounding box could treat the guide/background as the card. That produced an invalid normalized crop, so OCR/Scryfall verification never reached the verified publication path. The OCR worker was also lazy-started on the first card, consuming the recognition budget on a cold load. Type-line punctuation in canonical Scryfall data was treated as a contradiction when OCR omitted the dash.
- First divergence point for the supplied screenshot class: card localization/crop selection, before trustworthy field evidence. The empty recovery prompt was a separate UI/persistence symptom. The exact historical physical OCR result and old confidence calculation were not reproduced from the video and are not claimed.
- Scanner changes: bounded card-shaped border localization inside clutter; acceptable/close frames remain usable when not clipped; OCR worker warm-up begins when camera readiness is established; empty recovery batches no longer block the camera; type-line comparison ignores punctuation-only separators while preserving meaningful tokens.
- Scryfall/matching changes: the canonical matcher now has a Found Footage regression covering title, mana, Artifact - Clue type, rules, set, and collector evidence. Resolved records continue to store canonical Scryfall identity and image URL; physical imagery remains correction evidence only.
- Verified-only publication remains in force: only canonical identity `verified` creates a visible batch record, Scryfall image, confirmation sound, or user-facing capture feedback. Uncertain results remain silent and are suppressed according to the established precision policy.
- Tests completed for this checkpoint: scanner camera, matching, and recognition focused tests passed (3 files, 21 tests). Full regression, build, deployment, and live smoke verification are pending.
- Git state: uncommitted changes are limited to scanner localization/readiness, matching, scanner tests, and this checkpoint/documentation.
- Next action: run the complete available regression suite, review the final diff, commit/push, wait for deployment, and live-smoke the scanner route without claiming physical-card verification.

## SCANNER SIGHTING / SCRYFALL COLLECTION REPAIR VALIDATION
- Commit `3eac5773f050a48c4030afab9fde360f8b143573` was pushed to `origin/main`.
- Validation passed: full unit suite `39 files / 195 tests`; full E2E `40 passed` across Chromium and mobile Chromium; focused scanner suite `3 files / 21 tests`; `npx tsc -b --pretty false`; `npm run lint -- --quiet`; `npm run build`; and `git diff --check`.
- GitHub Actions succeeded for the implementation commit: Deploy Deck Nexus run `35909830446`; Pages build/deployment run `35909829568`.
- Live production smoke at `https://haroldh1995.github.io/Deck-Nexus/scan?scanner-repair=3eac577` used headless Chromium at `393x844` with service workers blocked. The deployed scanner loaded with no page errors, `Scan Cards` heading, camera permission surface, no primary `Start Batch` requirement, and body/document widths both `393px`. Current bundle was `index-B_DYEo4z.js`.
- Live verification covered route/layout/permission UI only. Physical Fodder Cannon, physical iPhone Safari, live OCR, exact physical printing, and hardware-feeder verification were unavailable and are not claimed.
- Final git state is clean. Home Screen visual/animation files were not changed. Master Product Completion remains paused; do not resume unrelated work automatically.

## COLLECTION-FIRST RESTRUCTURE
- CURRENT TASK: DECK NEXUS MASTER RESTRUCTURE. Camera scanning is removed; the larger unrelated completion effort remains paused.
- ARCHITECTURE: `/import` is now the Import Center. It detects CSV, plain text, Arena-style text, JSON, and ZIP inputs; resolves canonical Scryfall records; previews entries; supports merge, confirmed replace, and custom-folder strategies; and keeps local import history with undo data.
- SUPPORTED SOURCES: Moxfield, Archidekt, ManaBox, Dragon Shield, TCGplayer, Card Kingdom, Deckbox, Deckstats, Scryfall, MTG Arena, MTGGoldfish, generic CSV, plain text, JSON, and Deck Nexus exports when their public format is compatible.
- STORAGE: `collectionImports` is durable IndexedDB state. Owned records receive canonical Scryfall image and printing metadata where resolved; unresolved rows remain in import history and are never silently discarded. Legacy scanner tables are retired by the database migration without runtime scanner code.
- REMOVAL: scanner feature modules, camera/OCR dependencies, scanner routes, settings, CSS, tests, E2E harnesses, user-facing copy, ecosystem capabilities, and scanner documentation were removed. Home visual/animation behavior was retained while its former scan destination became Import Center.
- VALIDATION: typecheck, lint, production build, focused import/repository tests, full unit suite (after final parser/service changes pending), and full E2E (after final parser/service changes pending). Physical-device scanning is no longer applicable to the product.
- GIT STATE: collection-first restructure is uncommitted.
- DEPLOYMENT STATE: previous deployed scanner commit remains the last live deployment; this restructure is not pushed or live-verified.
- NEXT ACTION: run final regression, review diff, commit, push, wait for GitHub Pages, and verify the live Import Center route.

## COLLECTION-FIRST RESTRUCTURE VALIDATION CHECKPOINT
- Validation completed: full unit suite `33 files / 163 tests`; full E2E `40 passed` across Chromium and mobile Chromium; `npx tsc -b --pretty false`; `npm run lint -- --quiet`; `npm run build`; and `git diff --check`.
- E2E specifically covers Import Center file/paste preview and import flow on desktop and mobile, Home route coverage, collection/deck workflows, startup, responsiveness, and interaction performance.
- Scanner removal is complete in the application runtime. The only remaining scanner-related migration strings are dynamically constructed legacy IndexedDB table names used solely to retire old data during database upgrade.
- GIT STATE: implementation is ready for commit and push.
- DEPLOYMENT STATE: not yet deployed; live Import Center verification remains pending.
- NEXT ACTION: commit, push, verify GitHub Actions and GitHub Pages, then smoke-test the deployed Import Center route.

## COLLECTION-FIRST RESTRUCTURE DEPLOYMENT CHECKPOINT
- Implementation commit `a8fa2af6a764def207bbcd442c76cac27ef11a91` was pushed to `origin/main`; checkpoint commit `658d8ad64f8d89377472e157d56e0d18abe44e33` is the current verified remote head.
- GitHub Actions succeeded for the implementation: `Deploy Deck Nexus` run `35921670842`; Pages build/deployment run `35921670125`. The checkpoint deployment also succeeded: `Deploy Deck Nexus` run `35922126252`; Pages build/deployment run `35922126514`.
- Live smoke at `https://haroldh1995.github.io/Deck-Nexus/` used headless Chromium at `393x844`: HTTP 200, current Home loaded without page errors, body width matched the viewport, and Import Center navigation links were present.
- Live Import Center route content loaded from the deployed bundle at `/Deck-Nexus/import?live=a8fa2af`: Import Center heading and collection import controls rendered, no page errors occurred, and body width matched the viewport. Direct deep-link status is the repository's GitHub Pages SPA fallback status; the app content itself loaded.
- No camera/scanner verification is applicable because camera scanning was intentionally removed from the product.
- Final checkpoint commit `658d8ad64f8d89377472e157d56e0d18abe44e33` is deployed and remote-verified.
