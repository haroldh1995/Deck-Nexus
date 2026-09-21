# Deck Nexus Scanner Correctness Law

The scanner treats a camera capture as evidence for a canonical Scryfall record. A search result is a candidate, not proof.

1. The scanner may say `I don't know`.
2. OCR quality is not card-identity confidence.
3. Card identity and exact printing identity are separate decisions.
4. Reliable words, numbers, symbols, layout, and printing evidence are scored independently.
5. Positive evidence and reliable contradictions are both retained.
6. Garbage OCR never becomes a verified card through fuzzy search.
7. A reliable set plus collector number can verify a printing, but missing printing evidence leaves the card identity intact and printing unknown or in review.
8. Historical printed text is compared as printed evidence and is not required to equal current Oracle text.
9. Every asynchronous recognition result belongs to a target generation. Stale results are discarded.
10. One physical target creates at most one batch entry until it exits. Re-entry creates a new target.
11. Prices are downstream enrichment and never identity evidence.
12. Manual corrections outrank late automatic results.
13. Unresolved captures are preserved for review rather than assigned an invented identity.
14. Static Scryfall records and indexes are reused; they are not rebuilt per scan.
15. High-confidence false positives are release-blocking defects.

## Permanent Mobile Overlay Law

Complex review workflows use a full-screen mobile surface. Desktop modal geometry is not compressed onto a phone. Review owns the usable viewport, respects safe areas, has one scroll owner, makes the scanner inert, manages focus, and keeps actions readable and touchable. Small decisions may remain compact dialogs or sheets.
