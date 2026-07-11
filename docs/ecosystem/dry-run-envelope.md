# Dry Run Envelope

The Dry Run envelope prepares immutable deck data for a future BoardState Dry Run
consumer. Deck Nexus does not simulate Dry Runs.

Included:

- envelope schema version
- consumer intent `dry_run`
- source application metadata
- immutable snapshot ID
- gameplay checksum
- immutable gameplay payload
- commander configuration
- format
- safe planning metadata such as goals and Bracket Lock
- exact validation result reference when available
- structural readiness status
- unresolved-card list
- correlation ID

Excluded:

- simulated outcomes
- opening hand
- shuffled library order
- battlefield/runtime zones
- fake rules results
- private notes by default
