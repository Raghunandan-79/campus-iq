# API Reference

Base URL: `/api/v1` (proxied same-origin by the Next.js app).

Response envelopes:

- Success: `{ "data": ... }` or `{ "data": [...], "pagination": {page,pageSize,total} }`
- Error: `{ "error": { "code", "message", "details?" } }`

All endpoints are JSON except file upload (multipart) and download (binary).

## Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/signup` | — | `{name,email,password,collegeId?}` → sets session cookie |
| POST | `/auth/login` | — | `{email,password}` → sets session cookie |
| POST | `/auth/logout` | cookie | Destroys session |
| GET | `/auth/me` | cookie | Current user |

## Users

| Method | Path | Description |
|---|---|---|
| GET | `/users/me` | Profile + college info |
| PATCH | `/users/me` | `{name?, collegeId?}` |
| GET | `/users/me/resources` | Own uploads |
| GET | `/users/me/bookmarks` | Own bookmarks |
| GET | `/users/me/reviews` | Own resource reviews |

## Colleges

| Method | Path | Description |
|---|---|---|
| GET | `/colleges?q=&location=&page=&pageSize=` | Directory w/ rating aggregates |
| GET | `/colleges/:id` | Detail + aggregates (avg ratings, counts) |
| GET | `/colleges/:id/reviews?sort=&page=` | Reviews; sort: helpful/highest/lowest/newest |
| POST | `/colleges/:id/reviews` | Create review (auth; one per user per college) |
| PATCH | `/college-reviews/:reviewId` | Edit own review (owner/mod) |
| DELETE | `/college-reviews/:reviewId` | Delete own review (owner/mod) |
| POST | `/college-reviews/:reviewId/report` | `{reason}` |

## College review body

```json
{
  "overallRating": 4, "academicsRating": 4, "facultyRating": 3,
  "infrastructureRating": 4, "campusLifeRating": 5,
  "placementsRating": 4, "administrationRating": 3,
  "content": "optional text (max 5000)"
}
```

Ratings are integers 1–5.

## Subjects

| Method | Path | Description |
|---|---|---|
| GET | `/subjects?q=&collegeId=&page=` | List |
| GET | `/subjects/:id` | Detail |
| GET | `/subjects/:id/resources` | Resources for subject (visibility-aware) |
| POST | `/subjects` | Create (moderator/admin) |

## Resources

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/resources?q=&subjectId=&collegeId=&resourceType=&semester=&sort=&page=` | optional | Search/list. sort: newest/top/downloads |
| POST | `/resources` | yes | multipart: `file` + fields `title,description,resourceType,subjectId,collegeId?,visibility` |
| GET | `/resources/:id` | optional | Detail incl. score, counts, viewer vote/bookmark |
| DELETE | `/resources/:id` | yes | Owner or moderator |
| GET | `/resources/:id/download` | yes | Streams file, increments download_count |
| POST | `/resources/:id/vote` | yes | `{vote_type:"upvote"\|"downvote"}` — same vote toggles off |
| DELETE | `/resources/:id/vote` | yes | Remove vote |
| POST | `/resources/:id/bookmark` | yes | Idempotent save |
| DELETE | `/resources/:id/bookmark` | yes | Remove bookmark |
| GET | `/resources/:id/reviews?sort=&page=` | optional | Top-level reviews w/ replies; sort: best/newest/oldest |
| POST | `/resources/:id/reviews` | yes | `{content, parentReviewId?}` |

## Reviews (resource reviews)

| Method | Path | Description |
|---|---|---|
| PATCH | `/reviews/:reviewId` | Edit own `{content}` |
| DELETE | `/reviews/:reviewId` | Owner or moderator |
| POST | `/reviews/:reviewId/vote` | `{vote_type?}` default upvote; toggles |
| DELETE | `/reviews/:reviewId/vote` | Remove vote |
| POST | `/reviews/:reviewId/report` | `{reason}` |

## Bookmarks / Health / Moderation

| Method | Path | Description |
|---|---|---|
| GET | `/bookmarks` | Current user's bookmarks |
| GET | `/health`, `/health/db` | Liveness / DB check |
| GET | `/moderation/reports?status=open` | Moderator: list reports |
| POST | `/moderation/reports/:id/resolve` | Moderator: `{action: hide\|remove\|dismiss}` |

## Conventions

- Pagination: `page` (1-based), `pageSize` (max 50–100 per endpoint).
- Scores returned as `{upvotes, downvotes, score, userVote}` where
  `score = upvotes - downvotes` and `userVote ∈ upvote|downvote|null`.
- All timestamps ISO-8601.
