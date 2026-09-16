# Deck Nexus Work State

## CURRENT TASK
Targeted Home Nexus orbit input-latency repair.

## CURRENT OBJECTIVE
Make active Home orbit dragging directly follow the newest pointer position with no React-per-frame dependency or stale movement queue.

## LAST VERIFIED MILESTONE
Frame-coalesced direct pointer tracking and transform-only active dragging are implemented; focused tests, full unit suite, typecheck, lint, production build, mobile regression E2E, mobile interaction E2E, visual screenshots, and a throttled ten-cycle orbit stress run pass. Profiling coalesces 241 pointer moves into frame updates with no page errors or overflow.

## COMPLETED
- Continuous fractional orbit transforms with direct pointer dragging, bounded momentum, snap interruption, tap-to-center, keyboard fallback, reduced-motion handling, and pointer/orientation cleanup.
- Home render/performance improvements: on-demand orbit animation, scoped parallax input, scheduled particle rendering, cached card ref callbacks, and restrained touch feedback.
- Focused orbit math, scene, interaction, responsive, scanner/import regression, full unit, typecheck, lint, production, and GitHub Pages builds passed.
- Mobile and desktop Playwright interaction suites passed; live mobile Home, Library, Search, Import, and Scanner routes were inspected at 390x844 with no horizontal overflow or black screen. Live import parsing/review was exercised.
- The current commit is present on `origin/main`.
- GitHub Pages workflow runs for the current commit completed successfully.

## IN PROGRESS
- Commit, push, deploy, and live-verify the targeted repair.

## REMAINING
- Commit and push the repair, wait for GitHub Pages, then verify the live Home orbit and major routes.

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
- Deployment workflow and live verification of the targeted repair.

## KNOWN ISSUES
`npm audit` reports two moderate transitive advisories in Vitest's test-only dependency tree; the high-severity threshold command completed without a high-severity finding.

## EXTERNAL BLOCKERS
None.

## GIT STATE
Uncommitted targeted repair in `src/features/home/scene/useOrbitPhysics.ts` and this checkpoint file on `main`; `origin/main` is still the pre-repair commit.

## DEPLOYMENT STATE
Previous current commit deployment succeeded. New targeted repair is not yet committed or deployed.

## LIVE VERIFICATION STATE
Previous live verification passed. Re-verify the targeted repair after deployment.

## NEXT ACTION
Review the final diff, commit, push, monitor GitHub Pages, and perform cache-busted live Home orbit verification.

## IMPORTANT PRESERVATION NOTES
Do not reset IndexedDB, delete user data, discard legitimate working-tree changes, weaken ownership or pricing behavior, or move BoardState responsibilities across boundaries. Do not bundle `.codex` files into production.
