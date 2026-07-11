# Snapshot Checksums

Deck Nexus records separate checksums for immutable snapshots.

## Gameplay Checksum

The gameplay checksum is derived from normalized gameplay identity only:

- format
- commander configuration
- commander zone
- main deck composition
- card quantities
- oracle/Scryfall identities
- selected printing identifiers when present
- unresolved gameplay entries
- gameplay identity version

It excludes timestamps, snapshot IDs, private notes, ownership inventory, scanner
metadata, UI ordering, and route/runtime state.

## Full Snapshot Checksum

The full checksum covers the immutable payload, including archival planning
metadata, maybeboard, cuts, source metadata, validation metadata, and
compatibility flags.

## Verification

Verification recomputes both checksums from the stored protected payload. Deck
Nexus reports mismatch states but does not rewrite corrupted snapshots or update
checksums to match altered content.
