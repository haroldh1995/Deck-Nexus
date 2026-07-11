# Immutable Deck Snapshots

Deck Nexus immutable snapshots freeze a mutable local deck into a versioned,
checksum-protected payload for future BoardState consumers. Snapshot creation is
local-first and does not launch BoardState, Advanced Gameplay, Dry Run, shared
sessions, or Hub workflows.

## Boundary

Deck Nexus owns snapshot creation, history, verification, comparison, export,
backup inclusion, and duplication into a new mutable deck. BoardState remains the
future authority for gameplay state, rules execution, Advanced Gameplay, Dry Run,
shared sessions, tutorials, and multiplayer state.

## Lifecycle

1. Mutable Deck Nexus deck
2. Canonical Deck Nexus export snapshot
3. Normalized immutable snapshot payload
4. Gameplay checksum and full snapshot checksum
5. Append-only local persistence
6. Read-only history/detail/export surfaces

The live deck remains editable after snapshot creation. Old snapshots do not
silently refresh when the live deck changes.

## Status Language

Allowed: "Immutable snapshot created locally", "Prepared for Advanced Gameplay
export", "Prepared for Dry Run export", "BoardState validation required", and
"Current deck differs from this snapshot".

Forbidden until later verified integrations exist: "Advanced Gameplay launched",
"Dry Run started", "BoardState session created", "Shared session active", or
"Snapshot synced to BoardState".
