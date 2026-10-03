type Json = string | number | boolean | null | string[];

const normalise = (value: unknown): Json => {
  if (value instanceof Date) return value.toISOString();
  if (value === undefined || value === null) return null;
  return value as Json;
};

/** Before/after of ONLY the fields that changed, ready for the audit log. */
export function changedFields<T extends object>(before: T, after: T, keys: readonly (keyof T & string)[]) {
  const b: Record<string, Json> = {};
  const a: Record<string, Json> = {};
  for (const key of keys) {
    const x = normalise(before[key]);
    const y = normalise(after[key]);
    if (JSON.stringify(x) !== JSON.stringify(y)) {
      b[key] = x;
      a[key] = y;
    }
  }
  return { before: b, after: a, changed: Object.keys(a) };
}
