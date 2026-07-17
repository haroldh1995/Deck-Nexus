# Cross-App Handoff

Deck Nexus prepares immutable deck snapshots for future Original BoardState
consumption through a versioned handoff request. The app does not become a
gameplay surface and does not claim import or session creation unless a valid
BoardState acknowledgment proves it.

## Flow

1. Mutable Deck Nexus deck
2. Immutable snapshot
3. BoardState intent envelope
4. Selected transport
5. Optional BoardState acknowledgment or return envelope
6. Local handoff history

No handoff mutates the live deck or the immutable snapshot. Returned deck-change
data must be reviewed before any future Deck Nexus mutation.

## Current Live Status

Direct BoardState launch is not configured in production. File export, compact
payload copy where supported, Web Share where supported, and manual import
instructions are available as local fallbacks. These fallbacks are export-only
and keep BoardState import unconfirmed.
