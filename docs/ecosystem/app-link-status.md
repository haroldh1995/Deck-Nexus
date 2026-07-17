# App-Link Status

Deck Nexus app-link status language must stay explicit:

- Manual BoardState import available
- BoardState web URL configured but unverified
- Direct launch unavailable
- Return callback unavailable
- Schema incompatible
- BoardState import unconfirmed

Forbidden without verification:

- BoardState installed
- BoardState connected
- Live sync active
- Imported by BoardState
- Advanced Gameplay started
- Dry Run started
- Session created

Browsers cannot reliably prove installed-app availability, so Deck Nexus does
not show installed status.
