import type { Tx } from '../../database/prisma/prisma.service';

/** id -> "First Last" for records that store a user id without a relation (who requested, approved, recorded...). */
export async function userNames(tx: Tx, ids: ReadonlyArray<string | null | undefined>): Promise<Map<string, string>> {
  const wanted = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  if (wanted.length === 0) return new Map();
  const users = await tx.user.findMany({ where: { id: { in: wanted } }, select: { id: true, firstName: true, lastName: true } });
  return new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
}
