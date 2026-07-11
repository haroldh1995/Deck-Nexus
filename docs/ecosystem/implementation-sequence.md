# Ecosystem Implementation Sequence

## 1. Audit and Preservation

Purpose: document current Deck Nexus architecture, data, routes, ownership boundaries, and risks.

Deliverables: current-state docs, risk register, honest linked-app status, type-only ecosystem readiness scaffolding.

Must not implement early: BoardState bridge, immutable gameplay snapshots, cross-app launches, Hub runtime features.

Validation: current tests, build, live deployment, no false connected status.

## 2. Shared Deck/Profile/Card/Collection Snapshot Exports

Purpose: define local export contracts for Deck Nexus data.

Deliverables: versioned schemas, export mappers, privacy filters, readiness validation.

Status: implemented locally in Prompt 2 for deck, collection, profile, metadata, JSON, compressed JSON, ZIP package, Arena text, checksum, and compatibility utilities.

Must not implement early: BoardState live validation or gameplay simulation.

Dependencies: Prompt 1 audit and risk register.

Validation: deterministic export tests and backward compatibility checks.

## 3. BoardState Legality/Rules-Validation Bridge

Purpose: connect future BoardState validation without moving rules authority into Deck Nexus.

Deliverables: bridge client, request/response contracts, error states, honest status UI.

Status: implemented in Prompt 3 as a production-safe, configurable bridge architecture with unavailable default status, deterministic test adapter, result persistence, stale detection, and Export-screen validation panel.

Must not implement early: in-app rules engine or fake validation.

Dependencies: snapshot export contracts.

Validation: bridge unit/component tests, full regression tests, production build, live not-connected behavior unless a real endpoint is configured.

## 4. Immutable Deck Snapshots for Advanced Gameplay and Dry Runs

Purpose: create immutable, versioned deck snapshot records for BoardState consumption.

Deliverables: snapshot store, content hashes, schema version, exported-at timestamps, migration path.

Status: implemented in Prompt 4 as a local immutable snapshot system with append-only persistence, read-only history/detail UI, deterministic gameplay and full checksums, snapshot comparison, archival state, duplication into a new mutable deck, and Advanced Gameplay/Dry Run export envelopes that do not launch BoardState.

Must not implement early: Advanced Gameplay or Dry Run engine inside Deck Nexus.

Dependencies: export schemas and bridge readiness.

Validation: immutability, hash, migration, and restore tests.

## 5. Cross-App Launch/Link/Export Actions

Purpose: safely hand off prepared Deck Nexus data to BoardState or Hub.

Deliverables: app-link contracts, launch affordances, unavailable states, base-path-safe links.

Must not implement early: fake launch success or nonexistent URLs.

Dependencies: snapshots and bridge status.

Validation: unavailable-state tests and link contract tests.

## 6. Hub-Ready Profile/Friend/Notification/Backup/App-Link Adapters

Purpose: prepare Deck Nexus for future Hub identity and routing.

Deliverables: local profile adapter, backup metadata contracts, notification placeholders as unavailable, app registry contract.

Must not implement early: friends, notifications, cloud sync, or profile sync.

Dependencies: Hub contract and privacy rules.

Validation: local-only status tests and no false connected claims.

## 7. Final Audit/Deployment/Package/Live Verification

Purpose: verify the ecosystem-ready Deck Nexus build remains stable and honest.

Deliverables: regression audit, deployment verification, live status verification, documentation update.

Must not implement early: unrelated UI redesigns or gameplay engine features.

Dependencies: all prior prompts.

Validation: full tests, production build, pushed commit, successful Pages deployment, live app verification.
