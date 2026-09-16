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

These files are internal development state only and must not be bundled into the production UI.
