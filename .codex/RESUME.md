# Deck Nexus Resume Instructions

SILENT MODE IS THE DEFAULT FOR DECK NEXUS CODEX WORK.

When asked to resume Deck Nexus work:

1. Inspect `git status`, the current branch, recent commits, the complete diff, repository instructions, package scripts, and test configuration before editing.
2. Read `.codex/WORK_STATE.md` when it exists.
3. Verify the recorded checkpoint against the actual code, Git state, and test evidence. Never assume `WORK_STATE.md` is perfectly current; Git, code, and test evidence take precedence.
4. Preserve unfinished changes and resume from the first genuinely incomplete task. Do not restart completed work or create duplicate implementations.
5. Update `WORK_STATE.md` at meaningful milestones: architecture, focused tests, regression validation, build, commit, push, deployment, and live verification.
6. Run focused tests after implementation, then the full available regression verification before completion. Do not invent commands or disable tests.
7. Review the final diff, remove temporary instrumentation and unrelated changes, then commit and push.
8. Verify the actual deployment and inspect the live Deck Nexus application. Never claim an external integration or live behavior was verified unless it was actually verified.
9. Preserve Deck Nexus architecture, user data, migrations, ownership boundaries, pricing, BoardState compatibility, offline behavior, and established features. Never reset IndexedDB or delete legacy data to solve development problems.
10. Never use Xcode or build a native iPhone app unless a future task explicitly changes that requirement.
11. Preserve the visible-interaction principle: critical UI should appear as a complete stable state, and nonessential background work must be idle-scheduled, deduplicated, and deferred while the user is interacting.
12. Apply the UI residency rule: static application UI loads once per application version, persisted data hydrates into resident state, derived data invalidates by source revision, remote data uses cached-first refresh, loaded images do not flash back to loading, and route changes do not reboot global caches or providers.

13. Apply the complete-before-reveal law: static UI prepares completely, is revealed once, and remains ready. The Home Nexus is an atomic unit; all navigation cards keep their complete frame, artwork, icon, title, description, and action content resident. Orbit position may change transforms and depth, but it may not select a partial card, unload content, or trigger asset loading.

These files are internal development state only and must not be bundled into the production UI.
