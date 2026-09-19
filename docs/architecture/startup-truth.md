# Deck Nexus Startup Truth

## Complete Before Reveal

Deck Nexus static application UI follows one lifecycle:

`PREPARE -> COMPLETE -> REVEAL -> REMAIN READY`

The Home Nexus is an atomic unit. `HOME_READY` is the single authority for revealing it. All Home navigation cards must contain their complete frame, artwork, icon, title, description, action, and decorative layers before reveal. Orbit movement changes visual position only; it never loads, unloads, demotes, or reconstructs card content.

## Startup Truth Law

- Startup progress comes from real application events.
- The loading UI never completes startup work, invents progress, or delays readiness.
- Safe startup work remains parallel; cache hits become ready immediately.
- Magical status text translates technical state without exposing implementation details.
- Progress is presentation; readiness is a dependency result.
- Critical failures keep Home hidden and offer only valid recovery actions.
- Noncritical work does not block Home.
- Startup generations reject stale asynchronous completion and retries deduplicate in-flight work.
- User mutations do not restart application startup.
- The loader is compositor-driven and does not consume a per-frame React update loop.

## Residency

Static application assets load once per application version. Persisted data hydrates into resident state and changes through mutation-driven updates. Derived data is reused until its source revision changes. Remote data is shown cached-first and refreshed according to freshness policy. Routes must not reboot global providers or caches.

Future startup work must expose real lifecycle events, measurable units when available, dependency criticality, and generation-safe completion. Heavy workloads should use indexes, batching, yielding, workers, or cached summaries instead of delaying the complete application shell unnecessarily.
