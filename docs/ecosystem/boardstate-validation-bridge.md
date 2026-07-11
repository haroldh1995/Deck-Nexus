# BoardState Validation Bridge

Deck Nexus now has a versioned bridge layer for submitting canonical deck snapshots to Original BoardState for legality validation.

Current deployment status: production bridge architecture exists, but no live BoardState endpoint or installed app bridge is configured by default. The live app must report the bridge as not connected until a real BoardState transport is configured and verified.

## Flow

1. Mutable Deck Nexus deck.
2. Canonical `DeckSnapshot`.
3. `BoardStateValidationRequest`.
4. Configured bridge transport.
5. `BoardStateValidationResponse`.
6. Local validation result record.
7. Non-destructive display inside Deck Nexus.

Deck Nexus never sends mutable database entities directly to BoardState.

## Boundary

Deck Nexus keeps local planning guidance for card counts, color identity, bracket estimates, recommendations, and ownership. BoardState owns authoritative Commander legality and rules interpretation.

Validation results never mutate decks automatically. Suggested actions must remain explicit user actions implemented through existing Deck Nexus edit flows.

## Configuration

Supported environment settings:

- `VITE_BOARDSTATE_BRIDGE_ENABLED`
- `VITE_BOARDSTATE_ENDPOINT`
- `VITE_BOARDSTATE_TRANSPORT`
- `VITE_BOARDSTATE_COMPATIBILITY_VERSION`
- `VITE_BOARDSTATE_REQUEST_TIMEOUT_MS`
- `VITE_BOARDSTATE_ALLOWED_ORIGIN`

Remote production endpoints must use HTTPS. Secrets must not be embedded in browser code; authenticated production validation would require a secure proxy.

## Offline And Unavailable Behavior

Offline, timeout, network, schema, and malformed-response failures produce unavailable or failed validation records. They do not mark a deck illegal.

## Staleness

Validation records are tied to the exact snapshot checksum. If the current deck snapshot checksum differs from the validated checksum, Deck Nexus marks the result stale and prompts the user to validate again.

## Current UI

The Export screen includes a BoardState Validation panel. With no configured production bridge it shows not connected status and preserves local export/deck-building behavior.
