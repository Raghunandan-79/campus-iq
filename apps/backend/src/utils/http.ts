type Fields = Record<string, unknown>;

function serialize(data: unknown): unknown {
  if (data instanceof Date) return data.toISOString();
  if (Array.isArray(data)) return data.map(serialize);
  if (data && typeof data === "object") {
    const out: Fields = {};
    for (const [k, v] of Object.entries(data as Fields)) out[k] = serialize(v);
    return out;
  }
  return data;
}

export function ok(res: { json: (b: unknown) => unknown }, data: unknown) {
  return res.json({ data: serialize(data) });
}

export function okList(
  res: { json: (b: unknown) => unknown },
  items: unknown,
  pagination: { page: number; pageSize: number; total: number },
) {
  return res.json({ data: serialize(items), pagination });
}

export function fail(
  res: { status: (n: number) => { json: (b: unknown) => unknown } },
  status: number,
  code: string,
  message: string,
  details?: unknown,
) {
  return res.status(status).json({
    error: { code, message, ...(details !== undefined ? { details } : {}) },
  });
}
