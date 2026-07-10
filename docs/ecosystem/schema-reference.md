# Schema Reference

All ecosystem exports include:

- `schemaVersion`
- `snapshotVersion`
- `exportVersion`
- `compatibilityVersion`
- `sourceApplication`
- `applicationVersion`
- `createdAt`
- `updatedAt`
- stable IDs
- checksum fields
- migration metadata where applicable

Current versions:

- Schema Version: `deck-nexus.snapshot.schema.v1`
- Snapshot Version: `deck-nexus.snapshot.v1`
- Export Version: `deck-nexus.export.v1`
- Compatibility Version: `boardstate-ecosystem.v1`

## Deck Snapshot

Fields include `snapshotId`, `deckId`, `deckName`, `format`, `metadata`, `commander`, `colorIdentity`, `mainDeck`, `maybeboard`, `cuts`, `customCategories`, `deckGoals`, `bracketLock`, optional `estimatedBracket`, `recommendationMetadata`, `analyticsMetadata`, `deckNotes`, `customTags`, `groups`, `favorite`, `ownershipSummary`, `missingCards`, optional `deckImage`, timestamps, BoardState compatibility, Hub compatibility, metadata, and checksum.

BoardState compatibility is explicit but not connected. `validationStatus` remains `not_validated`, and `gameplayStateIncluded` is `false`.

## Deck Metadata

Fields include local deck identity, name, format, style, status, source, original import text, unresolved imports, timestamps, schema versions, and producer metadata.

## Commander Metadata

Fields include commander IDs/names, primary commanders, partner commanders, optional background, optional companion, timestamps, schema versions, and producer metadata. This is export structure only; authoritative commander legality remains future BoardState work.

## Deck Card

Fields include local card ID, deck ID, oracle ID, Scryfall ID, name, quantity, section, commander flag, printing selection, mana/type/text/color data, image URI, notes, ownership state, missing quantity, custom tags, role tags, categories, recommendation metadata, analytics metadata, sorting, custom category, timestamps, schema versions, and producer metadata.

No battlefield, zone transition, stack, turn, or gameplay state is exported.

## Owned Card and Printing

Owned Card fields include owned-card ID, oracle ID, Scryfall ID, name, quantity owned, printings, card text metadata, tags, notes, favorite state, duplicate flag, deck usage, scan timestamps, schema versions, and producer metadata.

Printing fields include printing ID, Scryfall ID, oracle ID, set code/name, collector number, language, foil flag, condition, quantity, image URI, last scanned timestamp, and a null purchase metadata field. Prices and marketplace fields are not exported.

## Collection Snapshot

Fields include collection metadata, owned cards, statistics, set summaries, color summaries, type summaries, rarity summaries, favorites, scanner metadata, schema versions, application metadata, export metadata, and checksum.

## Profile Snapshot

Fields include local profile ID, optional display/avatar fields, appearance settings, scanner settings, accessibility settings, backup preferences, application preferences, favorite commander/color/archetype placeholders, and explicit null/empty Hub identity, friends, and multiplayer presence fields.

Deck Nexus does not export Hub identity, friend graph, notifications, presence, or fake cloud IDs.

## Application, Export, Backup, and Manifest Metadata

Application Metadata records Deck Nexus as producer, lists BoardState and Hub as supported future consumers, and records capabilities. It includes checksum and a null digital signature placeholder.

Export Metadata records export format and migration status.

Backup Metadata records backup counts and checksum without changing legacy backup contents.

Manifest records ZIP package files and their checksum references.
