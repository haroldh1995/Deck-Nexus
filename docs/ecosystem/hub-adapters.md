# Hub Adapters

Deck Nexus now has production-safe Hub adapter contracts without a live Hub
runtime. The adapters prepare local profile, friends, notifications, backup,
and app-link data for future Hub consumption while keeping every current
feature local-first.

Current implementation:

- Profile: local Deck Nexus settings only; no Hub identity or authentication.
- Friends: unavailable and empty; no fabricated friend graph or presence.
- Notifications: local in-app status only; no remote notification channel.
- Backup: local file, JSON, and ZIP export are active; cloud providers require setup.
- App links: Deck Nexus local routing and BoardState file/manual fallback only.

Future implementation must add real Hub transport, capability negotiation,
identity verification, and migration checks before any status can be reported
as connected or synced.
