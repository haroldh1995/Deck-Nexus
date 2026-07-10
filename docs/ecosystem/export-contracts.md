# Export Contracts

Deck Nexus now has a local canonical export foundation for future BoardState and Hub consumers. These exports do not include gameplay state, BoardState validation, Hub identity, friends, notifications, cloud sync, prices, or marketplace data.

## Export Objects

- Deck Snapshot: full deck reconstruction data, including metadata, commander metadata, main deck, maybeboard, cuts, goals, tags, groups, favorite state, ownership summary, missing cards, analysis metadata, recommendation metadata, and compatibility sections.
- Collection Snapshot: owned-card inventory, exact printings, set/color/type/rarity summaries, favorite card IDs, and scanner summary metadata.
- Profile Snapshot: local-only settings and preferences Deck Nexus owns, including appearance, accessibility, scanner, backup, default deck-building, and Home customization settings.
- Application Metadata: producer name, application version, schema/export/snapshot versions, compatibility version, supported consumers, checksum, capabilities, and unsigned signature placeholder.
- Export Metadata: export ID, format, timestamps, source application, migration status, and checksum.
- Backup Metadata: backup ID/name, schema/export/snapshot versions, deck count, owned-card count, timestamps, and checksum.
- ZIP Manifest: package file list and per-file checksum references.

## Export Formats

- Primary JSON: deterministic compact JSON.
- Pretty JSON: deterministic readable JSON.
- Compressed JSON: gzip-compressed canonical JSON where the platform supports `CompressionStream`; otherwise the byte output remains valid JSON bytes for compatibility.
- ZIP package: uncompressed ZIP containing `deck-snapshot.json`, `collection-snapshot.json`, `profile-snapshot.json`, `metadata.json`, and `manifest.json`.
- MTG Arena text: generated from the canonical Deck Snapshot. Existing Arena modes are preserved as all cards, optimal including missing cards, and owned-only.

## Ownership

Deck Nexus owns the serialization of local deck, card, owned-card, scanner, collection, profile-setting, backup, analysis, and recommendation data.

BoardState will later consume these snapshots and remains responsible for authoritative gameplay validation, rules execution, Advanced Gameplay, Dry Runs, shared sessions, and multiplayer authority.

Hub will later consume compatible profile/app-link surfaces and remains responsible for identity, friends, notifications, presence, and ecosystem-wide launch routing.

## Non-Goals

- No BoardState bridge networking is implemented in this prompt.
- No gameplay import or battlefield state is exported.
- No Hub networking, cloud sync, friends, notifications, or presence is implemented.
- No destructive database migrations are required.
