# Backup Adapter

The backup adapter separates existing Deck Nexus local backup/export behavior
from future Hub-managed central backup.

Active today:

- Local file export and restore
- JSON export
- ZIP ecosystem package export

Not connected today:

- Google Drive
- iCloud
- Dropbox
- OneDrive
- GitHub provider backup
- Hub central backup

Cloud providers must remain unavailable until a real provider or Hub
authorization flow exists. Provider setup must never be inferred from local
export capability alone.
