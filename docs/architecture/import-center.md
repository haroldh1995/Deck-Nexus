# Import Center

Deck Nexus uses a local-first collection import pipeline:

1. `importParser` detects CSV, plain text, Arena-style text, JSON, and ZIP packages and normalizes rows into `ParsedImportEntry` records.
2. `importResolution` resolves each entry against local catalog data and Scryfall, preserving unresolved and ambiguous rows for review.
3. `ImportCenterScreen` presents the source, parse preview, canonical match status, quantity summary, and import strategy.
4. `collectionImportService` applies merge, replace, or new-folder strategies. Canonical card images and printing metadata are stored from the matched Scryfall record, not from the source file.
5. `collectionImports` stores an auditable local history with original source text and undo recovery data.

Supported source families include Moxfield, Archidekt, ManaBox, Dragon Shield, TCGplayer, Card Kingdom, Deckbox, Deckstats, Scryfall, MTG Arena, MTGGoldfish, generic CSV, plain text, JSON, and Deck Nexus exports where their public export format is compatible.

The parser and resolver are intentionally independent of the UI. New source adapters can normalize into `ParsedImportEntry` without changing collection storage or Scryfall resolution. Prices remain downstream enrichment and never determine card identity.
