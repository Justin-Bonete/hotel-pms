import type { Tx } from '../../database/prisma/prisma.service';
export declare class RbacRepository {
    loadAccessData(tx: Tx, userId: string): Promise<{
        user: {
            status: import("@prisma/client").$Enums.UserStatus;
            organization: {
                status: import("@prisma/client").$Enums.OrganizationStatus;
            };
        } | null;
        assignments: ({
            role: {
                key: string;
                permissions: {
                    permission: {
                        key: string;
                    };
                }[];
            };
        } & {
            userId: string;
            organizationId: string;
            id: string;
            createdAt: Date;
            roleId: string;
            scopeType: import("@prisma/client").$Enums.ScopeType;
            scopeId: string;
        })[];
        properties: {
            id: string;
            groupId: string | null;
        }[];
    }>;
    listRoles(tx: Tx): import("@prisma/client").Prisma.PrismaPromise<({
        permissions: {
            permission: {
                key: string;
            };
        }[];
    } & {
        key: string;
        organizationId: string | null;
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        isSystem: boolean;
    })[]>;
    /**
     * Active users who hold a permission at a property: through an organization-wide role, a role on the
     * property's group, or a role on the property itself.
     */
    usersWithPermission(tx: Tx, propertyId: string, groupId: string | null, permissionKey: string): Promise<{
        id: string;
        firstName: string;
        lastName: string;
    }[]>;
}
