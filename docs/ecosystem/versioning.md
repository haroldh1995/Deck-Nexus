# Versioning

Deck Nexus ecosystem exports use explicit schema, snapshot, export, and compatibility versions. These versions are independent from the IndexedDB database version.

## Current Versions

- Schema: `deck-nexus.snapshot.schema.v1`
- Snapshot: `deck-nexus.snapshot.v1`
- Export: `deck-nexus.export.v1`
- Compatibility: `boardstate-ecosystem.v1`
- Producer application: `Deck Nexus`
- Producer application version: `1.0.0`

## Compatibility Evaluation

Import compatibility utilities classify incoming data as:

- `current`: matches the current schema/export/snapshot versions.
- `older_supported`: a known older version pattern that can be preserved for later non-destructive migration.
- `future_unsupported`: a future version that Deck Nexus should not import until updated.
- `unknown`: missing or unrecognized version metadata.

Prompt 2 does not rewrite the importer and does not reject legacy exports. It only provides compatibility status and migration recommendations for future import work.

## Checksums

Checksums use deterministic stable JSON ordering and ignore checksum fields themselves. Identical exported data produces the same checksum. Changing exported content changes the checksum.

Checksums are integrity markers only. Cryptographic signing is not active; unsigned signature metadata remains explicitly null until a real signing contract exists.

## Migration Expectations

Future migrations must be:

- non-destructive
- schema-versioned
- test-covered
- compatible with legacy local data
- explicit about unsupported future versions

No prompt should reset IndexedDB, delete legacy records, or silently drop user data to satisfy an export schema.
