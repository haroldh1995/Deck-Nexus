# Snapshot Schema Reference

## ImmutableDeckSnapshot

Fields:

- `metadata`: snapshot identity, sequence, schema/format versions, source app,
  timestamps, creation reason, consumer intent, gameplay checksum, full checksum,
  and metadata checksum.
- `deckIdentity`: deck name, Commander format, optional description/image, and
  original Deck Nexus deck ID.
- `gameplay`: format, commander configuration, commander zone, main deck,
  gameplay-included cards, and unresolved gameplay cards.
- `nonGameplaySections`: maybeboard, cuts, tokens/extras, and planning lists.
- `planningMetadata`: goals, Bracket Lock, estimated bracket, tags, summaries,
  missing-card summary, and archival notes.
- `validationMetadata`: exact BoardState validation reference only when the
  stored validation result matches the canonical source snapshot and is not stale
  or test-only.
- `sourceMetadata`: source deck ID/update time and canonical export snapshot
  identity.
- `compatibility`: honest BoardState/Hub preparation flags.

## SnapshotCardEntry

Each card entry stores source deck card ID, oracle ID, Scryfall ID, card name,
quantity, section, commander/companion flags, selected printing reference,
gameplay identity version, unresolved status, and source card timestamps. Entries
never hold mutable deck object references.

## Envelopes

Advanced Gameplay and Dry Run envelopes contain immutable gameplay payload,
format, commander configuration, checksum, structural readiness, unresolved-card
list, and correlation ID. They intentionally exclude live gameplay state.
