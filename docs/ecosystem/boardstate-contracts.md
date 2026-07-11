# BoardState Contracts

## Request

`BoardStateValidationRequest` contains:

- request ID, schema version, timestamp, correlation ID.
- Deck Nexus source application and compatibility version.
- requested authority: `boardstate`.
- requested validation modes.
- canonical `DeckSnapshot`.
- snapshot ID, version, checksum, and Commander format.
- client capabilities.
- privacy flags showing no gameplay state, profile snapshot, or collection snapshot is included.

Validation modes include deck legality, commander legality, color identity, singleton, deck size, commander configuration, banned/restricted checks, special card rules, companion, partner/background, and format compatibility.

## Response

`BoardStateValidationResponse` contains:

- response ID and schema version.
- request ID.
- validated timestamp.
- BoardState application, rules, and compatibility versions.
- snapshot ID, version, and checksum.
- validation status and legality status.
- Commander configuration status.
- issues, warnings, informational findings, unsupported checks.
- capabilities used.
- result checksum.
- transport metadata.
- error metadata when applicable.

## Issue Model

Issues include stable ID, code, severity, category, title, message, affected card identifiers, affected sections, commander flag, optional rules reference, suggested action type, authoritative flag, source authority, and metadata.

Messages are treated as untrusted text. Deck Nexus does not render BoardState response HTML.

## Result Storage

Deck Nexus stores validation records separately from decks. Records include deck ID, snapshot ID, snapshot checksum, request and response IDs, BoardState version, rules version, status, legality status, findings, unsupported checks, stale flag, transport type, schema versions, authoritative flag, and test-only flag.

Historical valid results are preserved when a later transport failure occurs.
