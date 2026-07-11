# Integration Risk Register

| Risk | Current status | Affected future prompt | Mitigation direction |
| --- | --- | --- | --- |
| Inconsistent deck IDs across apps | Deck IDs are local generated strings; exports now include source app and stable snapshot IDs | Bridge | Continue using source app metadata and add cross-app aliases later. |
| Mutable deck data without immutable gameplay snapshots | Canonical local snapshots exist; BoardState gameplay snapshots are not implemented | Immutable snapshots | Add immutable snapshot store and exported-at distinction in Prompt 4. |
| Commander zone representation ambiguity | Commander cards live in `cards` with `section: commander`; deck also stores commander IDs/names | Snapshot exports, rules bridge | Normalize commander zone in export contract and preserve partner/background metadata. |
| Quantity ambiguity | `DeckCard.quantity` exists, Commander singleton checks are local guidance | Rules bridge | BoardState must validate quantities and exceptions. |
| Unresolved imported cards | `unresolvedImports` and `ImportResult.unresolvedImports` exist | Snapshot exports | Block or annotate unresolved entries in snapshot readiness. |
| Missing oracle/Scryfall IDs | Manual local entries can synthesize local IDs | Snapshot exports, rules bridge | Require confidence tier and unresolved state before BoardState export. |
| Exact printing versus gameplay identity ambiguity | Deck cards and owned printings both store print data | Snapshot exports | Separate gameplay identity from preferred/owned printing metadata. |
| Ownership state mixed with legality state | Deck cards include owned/missing counts | BoardState bridge | Keep ownership metadata out of gameplay legality input unless explicitly requested. |
| Maybeboard/cuts mixed with deck model | Deck contains `cards`, `maybeboard`, and `cuts` arrays | Snapshot exports | Export only selected gameplay zones; include side planning zones separately. |
| Local notes accidentally exported to gameplay | Notes exist on deck/card/list records | Snapshot exports, Hub | Add export privacy filters and explicit metadata flags. |
| Local legality guidance differs from BoardState | Analyzer and bracket checks are local | Rules bridge | Display local guidance only; BoardState remains authority. |
| Validation result staleness | Prompt 3 ties results to snapshot checksums | Rules bridge, immutable snapshots | Continue checksum-based stale detection and avoid showing stale results as current. |
| No production BoardState endpoint configured | Prompt 3 bridge uses unavailable status unless endpoint config exists | Rules bridge, deployment | Configure HTTPS endpoint or supported app bridge later; do not substitute test adapter in production. |
| Test adapter leakage | Test adapter exists for deterministic automation | Rules bridge | Do not select test adapter from production config; mark test results non-authoritative. |
| Response trust boundary | External responses can be malformed or hostile | Rules bridge | Validate schema, authority, request ID, checksum, status values, and render messages as text only. |
| Bracket estimates are not rules validation | Bracket analysis stores warnings and allowed flag | Rules bridge | Label bracket results as planning signals. |
| Color identity edge cases | Local helpers cover common cases | Rules bridge | Delegate edge cases to BoardState validation. |
| Partners/backgrounds/companions | Not fully modeled as authoritative zones | Rules bridge | Extend export contract with explicit supplemental commander roles. |
| Attractions/stickers/dungeons/extras | Scanner has extra kinds; deck gameplay zones are not authoritative | Rules bridge | BoardState decides supported game objects. |
| Banned/restricted freshness | Scryfall/legalities cache may become stale | Rules bridge | Include data timestamps; BoardState validates current rules. |
| Commander-specific exceptions | Local classification is not exhaustive | Rules bridge | BoardState owns exception handling. |
| No gameplay snapshot store | Export checksums exist, but immutable gameplay snapshot records are not stored | Immutable snapshots | Add stored immutable snapshot IDs and hashes in Prompt 4. |
| Snapshot schema evolution | Prompt 2 adds v1 schema/export/snapshot versions | Later prompts | Preserve compatibility utilities and add migrations only when needed. |
| No migration path for snapshots | Not implemented | Immutable snapshots | Add snapshot migration/versioning utilities. |
| Local profile only | No Hub identity | Hub adapters | Add local profile export status without claiming sync. |
| No friend graph | Not implemented | Hub adapters | Hub owns friend graph. |
| No notification routing | Not implemented | Hub adapters | Hub owns notifications. |
| No app-link registry | Not implemented | Cross-app launch, Hub | Define app-link contract later. |
| Service worker stale data | No service worker source found, but browser cache and Pages fallback assets can stale | Deployment | Verify deployed asset hashes after each prompt. |
| IndexedDB migration risk | DB is at Dexie version 5 after adding non-destructive BoardState validation result history | All data prompts | Avoid destructive migrations; add stores only when necessary. |
| Backup/restore conflict risk | Backup contents are opaque | Snapshot/Hub | Add schema-aware conflict policy later. |
| GitHub Pages base-path risk | Vite base changes in `github-pages` mode | Deployment | Keep route and asset verification in release checks. |
| Offline mode ambiguity | Scryfall cache/offline flags exist | Snapshot/export | Record data freshness and unresolved states in exports. |
