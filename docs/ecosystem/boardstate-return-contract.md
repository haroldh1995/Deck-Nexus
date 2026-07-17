# BoardState Return Contract

`boardstate.launch-acknowledgment.v1` distinguishes:

- received
- accepted
- imported
- session_created
- validation_started
- validation_completed
- rejected
- unsupported
- incompatible
- canceled
- timeout
- malformed
- checksum_mismatch
- transport_failed
- unknown

`boardstate.return-envelope.v1` supports optional return types such as import
acknowledgment, validation result, session creation acknowledgment, Dry Run
summary, Advanced Gameplay return, deck-change proposal, rules issue summary,
unsupported-card report, compatibility result, and error.

Deck Nexus validates request ID, correlation ID, snapshot ID, gameplay checksum,
application boundary, schema, status, and payload type before storing or showing
a return. Returned proposals do not mutate decks automatically.
