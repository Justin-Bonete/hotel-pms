/**
 * Room nights in date order, each tax line directly under the charge it was calculated on, voids next to
 * the lines they cancel, and extras (no service date) last. Lines saved in one batch share a timestamp,
 * so database order alone is not enough.
 */
export function orderForDisplay<T extends { id: string; parentItemId: string | null; serviceDate: Date | null; createdAt: Date; reversesItemId: string | null }>(items: readonly T[]): T[] {
  const children = new Map<string, T[]>();
  const roots: T[] = [];
  for (const item of items) {
    if (item.parentItemId) children.set(item.parentItemId, [...(children.get(item.parentItemId) ?? []), item]);
    else roots.push(item);
  }
  const day = (i: T) => (i.serviceDate ? i.serviceDate.toISOString().slice(0, 10) : '9999-12-31');
  roots.sort((a, b) => day(a).localeCompare(day(b)) || a.createdAt.getTime() - b.createdAt.getTime());
  return roots.flatMap((root) => [root, ...(children.get(root.id) ?? []).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())]);
}
