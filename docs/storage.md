# File Storage

Provider-independent storage behind `StorageProvider`
(`apps/backend/src/storage/types.ts`):

```ts
interface StorageProvider {
  upload(input: { key; body: Readable; contentType; contentLength? }): Promise<void>;
  download(key): Promise<Readable>;
  delete(key): Promise<void>;
  exists(key): Promise<boolean>;
}
```

Implementations: `LocalStorageProvider`, `R2StorageProvider`, selected by
`STORAGE_PROVIDER` via `StorageProviderFactory` (`storage/index.ts`).

## Local (default, zero credentials)

- Root: `STORAGE_LOCAL_DIR` (default `./uploads`), gitignored.
- Keys are server-generated: `resources/<userId>/<uuid>.<ext>` — client
  filenames are never used as paths.
- `resolveKey()` rejects path traversal (`..`, absolute paths).
- Uploads stream to `<key>.tmp-*` then atomically rename — partial files never
  appear at the final key; temp files are cleaned on failure.

## Cloudflare R2

- S3-compatible via `@aws-sdk/client-s3`; private bucket; credentials
  server-side only (`R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_ENDPOINT`,
  `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_REGION=auto`).
- No public object URLs are exposed — downloads always stream through
  `GET /api/v1/resources/:id/download` with authorization checks.
- R2 free tier (as of writing): 10 GB storage, ~1M Class A + 10M Class B
  operations/month, zero egress fees. Exceeding storage is billed; verify
  current limits at https://developers.cloudflare.com/r2/pricing/ — **free
  tier is not unlimited**.

## Upload pipeline

1. `requireAuth` → multer memory storage, `LIMIT_FILE_SIZE =
   MAX_UPLOAD_SIZE_MB` (default 20), single `file` field.
2. Extension allowlist (`ALLOWED_FILE_EXTENSIONS`, default `.pdf`).
3. Content inspection: PDF magic bytes `%PDF-` must match a `.pdf` name —
   browser MIME types are never trusted.
4. Server-generated key → `storage.upload()`.
5. DB insert (`upload_status=ready`). If the DB write fails, the stored object
   is deleted (idempotent cleanup).
6. Only then is success reported to the client.

## Downloads

`GET /api/v1/resources/:id/download` requires auth, enforces the same
visibility rules as viewing, streams the object with
`Content-Disposition: attachment` (sanitized filename), and increments
`download_count`. Restricted/hidden resources 404 rather than 403 to avoid
leaking existence.
