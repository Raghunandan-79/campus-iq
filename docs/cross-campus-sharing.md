# Cross-Campus Resource Sharing

This is CampusIQ's core differentiator: a student at one college can discover
and download academic resources uploaded by students at **any** participating
college.

## Visibility model

Every resource has a `visibility`:

| Value | Who can view/download |
|---|---|
| `campus` (default) | Everyone, including anonymous viewers for metadata |
| `college` | Users affiliated with the resource's `college_id` (+ owner/staff) |
| `restricted` | Owner + moderators/admins only |

Enforced in SQL via `visibilityCondition()` in
`apps/backend/src/modules/resources/routes.ts` — hidden resources return 404
(not 403) so existence isn't leaked. Removed/hidden-by-moderation resources are
excluded from all listings.

Ownership ≠ access: the uploader contributes the file; the community accesses
it per visibility rules. Downloads require authentication.

## Discovery

`GET /api/v1/resources` supports:

- `q` — title/description substring (ilike)
- `subjectId`, `collegeId`, `resourceType`, `semester` (via subject join)
- `sort` — `newest` | `top` (net vote score) | `downloads`
- `page`/`pageSize` pagination

College-specific browsing: `?collegeId=`; subject browsing:
`/subjects/:id` → `?subjectId=`.

## Attribution

Every resource response includes `college {id,name,location}`,
`subject {id,name,code,semester}`, `uploader.name`, file metadata, score, and
timestamps — rendered on cards and the detail page.

## Upload defaults

- `collegeId` defaults to the uploader's affiliation; can be set explicitly.
- `visibility` defaults to `campus`.
- Initially PDFs only (`ALLOWED_FILE_EXTENSIONS=.pdf`,
  `ALLOWED_MIME_TYPES=application/pdf`, magic-byte verified). Extend
  deliberately via env after adding validators.
