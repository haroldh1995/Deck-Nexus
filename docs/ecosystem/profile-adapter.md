# Profile Adapter

The Hub profile adapter exposes Deck Nexus local profile data for future Hub
compatibility. It includes appearance, accessibility, scanner, backup, and
deck-building preferences derived from local settings.

Current status: local profile only.

Excluded by design:

- Hub account ID
- Login or password
- Authentication token
- Social identity
- Friends
- Remote notifications

Imports are accepted only for Deck Nexus local profile payloads. Merge behavior
is review-only and never overwrites local settings automatically.
