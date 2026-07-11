# Snapshot Lifecycle

Allowed lifecycle actions:

- create
- view
- compare to current deck
- compare to another snapshot
- export
- verify
- archive
- duplicate into a new mutable deck
- create a new snapshot from the current deck

Disallowed:

- edit protected snapshot card quantities
- replace a snapshot card in place
- modify the commander in place
- mutate checksum-protected metadata
- silently refresh a snapshot from the live deck
- overwrite an old snapshot with a new deck version

Archiving is stored outside the protected payload. Deletion, if added later,
must require explicit confirmation and must not delete the live deck.
