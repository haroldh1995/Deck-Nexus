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
13. Automatic camera intake publishes only verified card identities. Review,
    ambiguous, and unresolved recognition outcomes are silently suppressed from
    the user-facing batch and produce no success feedback or sound.
14. Static Scryfall records and indexes are reused; they are not rebuilt per scan.
15. High-confidence false positives are release-blocking defects.
16. Detection must have a path to completion; uncertainty reduces identity certainty, not physical capture completion.
17. A detected target that cannot be confidently identified terminates
    internally and is suppressed rather than hanging or presenting a guessed
    result.
18. `Too close` is functional image-usability guidance, not an arbitrary card-area rejection. A usable close frame may proceed.
19. An acceptable frame is preferable to waiting indefinitely for an ideal frame.
20. Zero-touch handheld scanning does not depend on discovering `Start Batch`; batches are created when physical capture requires them.
21. Every acquired target becomes a durable verified batch capture or reaches
    an explicit silent suppression/cancellation/loss/error terminal reason.
22. False-positive protection must not make the scanner too conservative to complete physical intake.
23. Physical capture completion, card identity success, and printing identity success are separate outcomes.
24. A usable detected card must advance into acquisition and recognition without a capture button; only a verified result may become visible.
25. Degraded evidence may terminate as a silent suppression; it may not create an infinite scan.
26. `Too close` is a warning until clipping or unusable geometry proves it is a blocker.
27. A bounded best-frame window and evidence budget are preferred to waiting for a mythical perfect frame.
28. A newly acquired target must either be durably captured or receive an explicit lost, canceled, or camera-error terminal reason.
29. Start Batch is an advanced control, never a hidden prerequisite for ordinary handheld intake.
30. The scanner must be both precision-first and productive: false-positive safety cannot be achieved by refusing to complete physical captures.

## Scanner Input Law

Present card -> automatically detect -> acquire a target -> use the best available evidence -> attempt canonical matching -> durably store one physical capture -> emit one confirmation event -> continue watching for the next physical target. Manual controls are for pause, review, correction, rescan, troubleshooting, and advanced feeder control, not ordinary per-card operation.

## Permanent Mobile Overlay Law

Complex review workflows use a full-screen mobile surface. Desktop modal geometry is not compressed onto a phone. Review owns the usable viewport, respects safe areas, has one scroll owner, makes the scanner inert, manages focus, and keeps actions readable and touchable. Small decisions may remain compact dialogs or sheets.
