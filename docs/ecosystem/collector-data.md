# Collector Data

Deck Nexus supports collector-focused card data as a permanent product capability. Pricing and value data are informational collection metadata, not gameplay rules data.

## Implemented

- Scryfall price references are retained on normalized cards when Scryfall provides them.
- Marketplace checkout links such as `purchase_uris` are discarded.
- Owned cards and owned printings can store finish, language, condition, storage location, trade status, want status, special-copy flags, cached prices, manual reference values, and price timestamps.
- Collection value, deck value, highest-value cards, valuable duplicate counts, missing-price counts, and trade comparison summaries are computed from explicit price references.
- Price history records can store Scryfall or manual reference values over time.
- Search, Card Detail, Owned Cards, and Analyzer expose restrained collector value views.

## Price Sources

The initial supported source is Scryfall card pricing fields. Unsupported fields remain nullable. Future providers such as TCGplayer, Cardmarket, Card Kingdom, or local shop data require explicit provider adapters and must not be fabricated.

Every displayed market price must be traceable to source label and fetch timestamp. Unknown prices are shown as unavailable, never as zero.

## Boundaries

Price data does not affect:

- Commander legality.
- Deck Nexus local soft-legality guidance.
- BoardState authoritative validation.
- BoardState gameplay payloads.
- Immutable gameplay checksums.
- MTG Arena export text.

Manual reference values are displayed separately from market references and do not overwrite provider data. Condition, signed, altered, misprint, serialized, stamped, promo, and artist-proof metadata are tracked without automatic value adjustments unless a future condition-aware pricing source provides that data.

## Offline Behavior

When offline, Deck Nexus continues to manage decks and collections. Cached prices may be displayed with cached/stale freshness wording. If no cached price exists, the UI shows price unavailable offline.

## Backup and Export

Collection and full-backup exports may include collector metadata and cached price references. BoardState Advanced Gameplay and Dry Run envelopes exclude price data by default because BoardState consumes gameplay configuration, not collection valuation.
