# BoardState Launch Contract

`deck-nexus.boardstate-launch-request.v1` includes:

- launch request ID
- created/expires timestamps
- source and target application IDs
- compatibility version
- target capability and consumer intent
- immutable snapshot ID and sequence number
- gameplay checksum and full snapshot checksum
- intent-specific immutable envelope
- requested return mode and acknowledgment flag
- correlation ID and nonce
- transport type
- payload encoding/compression/size
- explicitly unsigned signature metadata
- privacy flags
- user-visible deck name

The launch request excludes secrets, provider credentials, mutable gameplay
state, private notes, ownership inventory, and profile data by default.

Opening a URL or exporting a file is not a successful import. Import requires a
valid BoardState acknowledgment or return payload.
