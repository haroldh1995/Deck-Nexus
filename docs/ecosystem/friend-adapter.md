# Friend Adapter

The friend adapter defines the future Hub-owned friend surface without creating
friend data inside Deck Nexus.

Current production behavior:

- status: not connected
- friend requests: empty
- accepted friends: empty
- blocked users: empty
- favorites: empty
- online status: empty
- shared deck permissions: empty

Future Hub work must own identity, permissions, presence, and sharing policy.
Deck Nexus may later display Hub-provided friend data, but it must not fabricate
friends or online users locally.
