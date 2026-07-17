# Transport Registry

Deck Nexus registers handoff transports behind a common capability model:

- direct web
- postMessage
- same-origin bridge
- custom URI/app link
- Android intent
- file export
- clipboard
- Web Share
- QR code
- manual import
- future Hub route

Each transport reports availability, acknowledgment support, return support,
payload size limit, and an honest reason. Production currently exposes local
fallbacks only. Direct web launch remains unavailable unless a real HTTPS
BoardState import URL is configured and later acknowledged.

Payload-size rules prevent large snapshots from being placed in URLs, app links,
clipboard payloads, or QR codes. Oversized payloads are redirected to file export
or manual import.
