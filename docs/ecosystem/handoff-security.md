# Handoff Security

All BoardState handoff and return data is treated as untrusted.

Validation rules:

- allowed source/target application
- schema version
- launch request ID
- correlation ID
- snapshot ID
- gameplay checksum
- nonce where available
- payload size
- acknowledgment status
- return type

Production postMessage must never use wildcard target origins. No secrets,
provider tokens, private notes, ownership inventory, or executable content are
placed in launch URLs. File and clipboard fallbacks are export-only and do not
prove import.
