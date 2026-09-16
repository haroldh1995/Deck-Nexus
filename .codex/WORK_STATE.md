# Deck Nexus Work State

## CURRENT TASK
Targeted Home Nexus orbit input-latency repair.

## CURRENT OBJECTIVE
Make active Home orbit dragging directly follow the newest pointer position with no React-per-frame dependency or stale movement queue.

## LAST VERIFIED MILESTONE
Frame-coalesced direct pointer tracking and transform-only active dragging are implemented; focused tests, full unit suite, typecheck, lint, production build, mobile regression E2E, mobile interaction E2E, visual screenshots, and a throttled ten-cycle orbit stress run pass. Profiling coalesces 241 pointer moves into frame updates with no page errors or overflow. Repair commit `961fec1` is pushed; its Pages build passed but the parallel deploy workflow build had a timing-sensitive existing BoardState test failure, so deployment is being retried by this checkpoint commit.

## COMPLETED
- Continuous fractional orbit transforms with direct pointer dragging, bounded momentum, snap interruption, tap-to-center, keyboard fallback, reduced-motion handling, and pointer/orientation cleanup.
- Home render/performance improvements: on-demand orbit animation, scoped parallax input, scheduled particle rendering, cached card ref callbacks, and restrained touch feedback.
- Focused orbit math, scene, interaction, responsive, scanner/import regression, full unit, typecheck, lint, production, and GitHub Pages builds passed.
- Mobile and desktop Playwright interaction suites passed; live mobile Home, Library, Search, Import, and Scanner routes were inspected at 390x844 with no horizontal overflow or black screen. Live import parsing/review was exercised.
- The current commit is present on `origin/main`.
- GitHub Pages workflow runs for the current commit completed successfully.

## IN PROGRESS
- Complete the retried deployment and live-verify the targeted repair.

## REMAINING
- Wait for the checkpoint-triggered GitHub Pages workflow, then verify the live Home orbit and major routes.

## FILES CURRENTLY INVOLVED
- `src/features/home/scene/useOrbitPhysics.ts`
- `src/features/home/scene/orbitMath.ts`
- `src/features/home/scene/HomeHologramScene.tsx`
- `src/features/home/scene/OrbitCard.tsx`
- `src/features/home/scene/useSceneParallax.ts`
- `src/features/home/scene/HologramParticlesCanvas.tsx`
- `src/styles/homeHologram.css`
- `src/styles/global.css`
- `src/tests/homeSceneMath.test.ts`
- `src/tests/e2e/interaction-performance.spec.ts`
- `src/tests/e2e/deck-nexus.spec.ts`

## TESTS ALREADY RUN
- `npx tsc -b --pretty false`
- `npm run lint -- --quiet`
- `npm test -- --reporter=dot --maxWorkers=1` (27 files, 151 tests)
- Focused Home/orbit Vitest tests
- Desktop and mobile Playwright interaction suites
- Mobile Playwright Deck Nexus suite (10 tests)
- `npm run build`
- `npm run build -- --mode github-pages`
- `npm audit --audit-level=high` (reports two moderate Vitest transitive advisories)

## TESTS STILL REQUIRED
- Successful deployment workflow and live verification of the targeted repair.

## KNOWN ISSUES
`npm audit` reports two moderate transitive advisories in Vitest's test-only dependency tree; the high-severity threshold command completed without a high-severity finding.

## EXTERNAL BLOCKERS
None.

## GIT STATE
Targeted repair committed as `961fec1`; this deployment checkpoint is uncommitted on `main` and will be pushed next.

## DEPLOYMENT STATE
The `961fec1` Pages build/deployment workflow succeeded, while the repository deploy workflow failed in its unit-test step because `boardStateBridge.test.ts` observed `valid` instead of `timeout` in a timestamp-order assertion. Local repeated runs pass; retry after checkpoint push is required.

## LIVE VERIFICATION STATE
Previous live verification passed. Re-verify the targeted repair after deployment.

## NEXT ACTION
Commit this checkpoint, push it, monitor both Pages workflows, and perform cache-busted live Home orbit verification.

## IMPORTANT PRESERVATION NOTES
Do not reset IndexedDB, delete user data, discard legitimate working-tree changes, weaken ownership or pricing behavior, or move BoardState responsibilities across boundaries. Do not bundle `.codex` files into production.
