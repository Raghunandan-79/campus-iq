# College Reviews & Ratings

## Directory & detail

- `GET /api/v1/colleges` — search (`q` on name/location), `location` filter,
  pagination. Each row includes live aggregates.
- `GET /api/v1/colleges/:id` — detail + aggregates:
  - `reviewCount`, `avgOverall`
  - per-category averages (academics, faculty, infrastructure, campus life,
    placements, administration)
  - `resourceCount` (ready, non-removed resources), `memberCount` (users with
    `college_id`) — **real counts only, no invented statistics**.

## Review rules

- Auth required. **One active review per user per college** — enforced by the
  `college_reviews_unique(college_id, user_id)` index; duplicates → 409.
- Users edit (`PATCH /college-reviews/:id`) or delete their own; moderators
  can delete any (audit-logged).
- All six category ratings + overall are required integers 1–5; written
  review is optional (max 5000 chars).
- Reviews are reportable; moderators can hide/remove via the reports queue.
- A student's own college affiliation does **not** weight their review.

## Aggregates

Computed at read time from `college_reviews` where
`moderation_status = 'visible'` — `avg()` per rating column. Deleting or
hiding a review immediately changes aggregates; there are no stale counters.

## Sorting

`GET /colleges/:id/reviews?sort=` — `newest` (default), `highest`, `lowest`,
`helpful` (currently ordered by rating then recency; college reviews have no
vote mechanism in the MVP).

## Disclaimer

The UI states that reviews represent individual student experiences, not
verified institutional statements. Content policy: no personal attacks,
doxxing, or targeting named students/faculty — enforced via reports +
moderation, not automated filtering.
