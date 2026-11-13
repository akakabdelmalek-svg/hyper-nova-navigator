# Hyper Nova Navigator — Security Specification

## Data Invariants
1. **Handle Ownership & Uniqueness**: A `/handles/{handle}` document ID must match `^[a-z0-9_-]+$` (3–24 chars) and can only be created when `uid == request.auth.uid` and the document does not already exist. No PII (email) may appear in `/handles`.
2. **PII Isolation**: Email addresses are stored exclusively in `/users/{userId}/private/{docId}` and are readable/writable only by `request.auth.uid == userId`.
3. **Contact Isolation**: `/users/{userId}/contacts/{contactUid}` is strictly owned by `userId`; a contact can only be added if `/handles/{contactHandle}` exists and matches `contactUid`.
4. **DM Room Participant Lock**: `/dm_rooms/{roomId}` has an exact 2-element `participants` list containing `request.auth.uid`, and `roomId` must match the deterministic sorted pair. Subcollection messages must carry the same 2 `participants` and `senderUid == request.auth.uid`.
5. **Indie Game Integrity & Atomic Likes**: `/indie_games/{gameId}` starts with `likesCount == 0`, `playsCount == 0`, and `authorUid == request.auth.uid`. Likes can only increment/decrement by 1 atomically with a write/delete on `/indie_games/{gameId}/likes/{request.auth.uid}`.

## Dirty Dozen Adversarial Payloads (Must Return PERMISSION_DENIED)
1. Shadow field injection (`isAdmin: true`) on `/handles/{handle}` creation.
2. Spoofing `uid` of another user when claiming `/handles/{handle}`.
3. Reading `/users/{otherUid}/private/info` as a non-owner.
4. Writing `/handles/{handle}` with an unverified email token (`email_verified == false`).
5. Injecting >128 char document ID into `/indie_games/{longId}`.
6. Creating an `/indie_games` entry with initial `likesCount: 9999`.
7. Updating someone else's game `title` or `htmlCode`.
8. Updating `likesCount` without creating/deleting the corresponding `/likes/{uid}` doc.
9. Creating a `/dm_rooms` message with `senderUid` set to the victim's UID.
10. Listing `/dm_rooms` where `request.auth.uid` is not in `resource.data.participants`.
11. Backdating `createdAt` on `/squad_messages` instead of `request.time`.
12. Deleting a comment authored by another user on `/indie_games/{gameId}/comments/{commentId}`.
