# Scanner Pipeline

Deck Nexus treats a scan as a physical-card intake session, not as a name
lookup. The live camera loop stays lightweight and asynchronous while a
bounded recognition job owns one target generation.

## Stages

1. `scannerCamera` owns permissions, stream lifecycle, intrinsic/display
   geometry, torch and refresh behavior.
2. `frameAnalysis` samples the visible guide, searches bounded card-shaped
   rectangles using border evidence so surrounding scenery does not become
   the card, and reports quality dimensions, stability and a short-lived
   visual fingerprint.
3. `scannerDetection` converts the analyzed candidate into a source-space
   quadrilateral.
4. `scannerPerspective` warps that quadrilateral into a stable card canvas.
5. `scannerEnhancement` creates a bounded contrast/sharpened recognition
   variant while retaining the original normalized card.
6. `scannerRecognition` reads independent card regions, retries with the
   enhanced variant when evidence is weak, and emits field-owned evidence.
7. `scannerMatching` compares the reliable evidence with canonical Scryfall
   records, rewarding agreement and rejecting contradictions.
8. `scannerLifecycle` owns target generations and stale-result rejection.
9. `scannerEngine` and the repositories persist every terminal physical
   capture before feedback is emitted.
10. Batch Review presents identity and printing certainty separately and
    preserves unresolved evidence for correction.

The preparation boundary is exposed by `scannerPipeline.ts`. Its
`ScannerStageAdapter` and `ScannerRecognitionEngine` interfaces are the
extension point for a future worker or local vision provider. A replacement
engine must return the same target-owned evidence contract; camera lifecycle,
matching safety and batch persistence do not depend on a particular OCR or
vision implementation.

## Session matching controls

The live scanner supports optional session-level `set` and `lang` filters.
They narrow Scryfall candidate generation for a focused collection intake,
but are treated as user constraints rather than physical evidence. A session
filter can improve speed and reduce same-name printing ambiguity, but it never
by itself verifies an exact printing or bypasses contradiction checks. Without
a filter, the recognition path remains unchanged.

## Safety and completion

The scanner warms its OCR worker when the camera becomes ready so worker
startup does not consume the first handheld recognition budget. It may use
an acceptable frame when an ideal frame is unavailable.
"Too close" is guidance unless clipping or unusable geometry prevents
recognition. A target has a bounded recognition budget; failure to identify a
card becomes a terminal internal unresolved/review decision rather than an
infinite detected state. Only a durable verified batch insert emits the single
capture feedback event.

Automatic camera intake is precision-only at the publication boundary:
`verified` card identity is the only outcome that creates a visible batch
record, success feedback, or confirmation sound. Review, ambiguous, and
unresolved outcomes complete their target generation silently so weak evidence
cannot create a user-visible guess or an infinite retry loop.

Transient physical evidence is target-owned. Canonical Scryfall indexes and
candidate caches may be shared, but OCR, fingerprints, candidates and
confidence cannot cross target generations. A new physical presentation is
allowed to produce another capture even when its canonical card and printing
match the prior card.

The first changed frame in a replacement establishes the new target and then
continues through the normal quality/evidence budget. It is not discarded as
an unproductive `possible new target` holding state. A large card in frame is
guidance only while the normalized crop remains readable; tray blocking is
reserved for close frames that are clipped or otherwise unusable.

Recovery is only surfaced when a recoverable batch contains active records.
An empty abandoned batch remains available for the next verified capture but
does not cover the camera with an unfinished-batch prompt. Resolved records
carry the matched Scryfall image URL; a physical thumbnail is correction
evidence only.

## Diagnostics

Development builds retain a bounded transition trace containing the funnel
from detection through terminal batch insertion. It is not rendered to normal
users and does not persist raw camera frames by default.
