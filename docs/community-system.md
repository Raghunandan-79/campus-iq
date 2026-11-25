# Community System

## Resource voting

`resource_votes` — one row per (resource, user), `vote_type ∈ {upvote,
downvote}`.

Toggle semantics (POST `/resources/:id/vote` with `{vote_type}`):

| Existing | Action | Result |
|---|---|---|
| none | upvote/downvote | that vote |
| same | same | vote removed |
| opposite | switch | vote switched |

`DELETE /resources/:id/vote` always removes. All mutations run in a
transaction; the unique index makes duplicates impossible. Scores are always
computed server-side — never trusted from clients.

Review votes (`review_votes`) behave identically via `/reviews/:id/vote`.

## Resource reviews

- Top-level reviews + one level of displayed replies (`parent_review_id`).
- Create/edit own/delete own (moderators can delete any, logged).
- Sort: `best` (net score), `newest`, `oldest`; paginated (top-level only).
- Each review shows author, score, timestamp, vote controls, reply count.

## Bookmarks

`bookmarks` unique (resource,user); idempotent POST, DELETE to remove.
Listed at `GET /bookmarks` and `/users/me/bookmarks`.

## Moderation & safety

- `reports` table: target_type ∈ resource | resource_review | college_review,
  with reason, reporter, status (open/resolved/dismissed).
- Moderators (`role ∈ moderator|admin`) list reports at
  `GET /api/v1/moderation/reports` and resolve via
  `POST /api/v1/moderation/reports/:id/resolve` with `hide`/`remove`/`dismiss`.
- Hide/remove sets `moderation_status` on the target and writes a
  `moderation_logs` audit row.
- Users cannot report their own content; cannot edit/delete others' content;
  cannot vote as another user.
- All user text is rendered as plain text (React escapes by default) — no
  arbitrary HTML.
- Input limits: titles 300, descriptions 5000, review content 5000,
  report reasons 1000 chars. Rate limits on all endpoints.
