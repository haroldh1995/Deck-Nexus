# BoardState Status And Errors

## Bridge States

- `disabled`
- `not_configured`
- `checking`
- `compatible`
- `partially_compatible`
- `incompatible`
- `unavailable`
- `error`

Configured status is not the same as connected. Deck Nexus may only show authoritative validation after receiving and verifying a real BoardState response.

## Validation Status

- `valid`
- `invalid`
- `valid_with_warnings`
- `incomplete`
- `unsupported`
- `unavailable`
- `timeout`
- `transport_error`
- `malformed_response`
- `incompatible_schema`
- `stale`
- `canceled`

Failures are not collapsed into illegal. Network and transport failures leave legality as not validated.

## User Messages

Offline: BoardState validation is unavailable while offline; local checks remain available.

Timeout: BoardState did not respond in time; no legality result was recorded.

Incompatible schema: the current Deck Nexus snapshot version is not supported by the connected BoardState version.

Malformed response: BoardState returned an unreadable response; the result is not saved as authoritative.

Checksum mismatch: the returned result does not match the submitted deck snapshot.

## Test Adapter

The deterministic test adapter can simulate legal, illegal, warning, unsupported, timeout, malformed, incompatible, checksum mismatch, and network-failure states. It is not selected by production configuration and does not represent a live BoardState connection.
