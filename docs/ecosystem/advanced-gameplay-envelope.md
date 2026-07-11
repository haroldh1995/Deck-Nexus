# Advanced Gameplay Envelope

The Advanced Gameplay envelope is a future BoardState data package only. It does
not launch BoardState.

Included:

- envelope schema version
- consumer intent `advanced_gameplay`
- source application metadata
- immutable snapshot ID
- gameplay checksum
- immutable gameplay payload
- commander configuration
- format
- BoardState compatibility metadata
- exact validation result reference when available
- structural readiness status
- unresolved-card list
- display deck name
- correlation ID

Excluded:

- battlefield
- hand
- graveyard
- exile
- stack
- life totals
- player seats
- turn/phase state
- active effects
- tokens in play
- game actions
- private notes and ownership inventory
