import type { Tx } from '../../database/prisma/prisma.service';
/** id -> "First Last" for records that store a user id without a relation (who requested, approved, recorded...). */
export declare function userNames(tx: Tx, ids: ReadonlyArray<string | null | undefined>): Promise<Map<string, string>>;
