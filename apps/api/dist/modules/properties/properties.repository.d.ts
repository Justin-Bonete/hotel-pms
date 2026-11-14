import type { Prisma } from '@prisma/client';
import type { PropertyScope } from '../../common/access/access-context';
import type { Tx } from '../../database/prisma/prisma.service';
export declare const propertyInclude: {
    group: {
        select: {
            name: true;
        };
    };
    _count: {
        select: {
            rooms: {
                where: {
                    deletedAt: null;
                };
            };
        };
    };
};
export type PropertyRow = Prisma.PropertyGetPayload<{
    include: typeof propertyInclude;
}>;
export declare class PropertiesRepository {
    list(tx: Tx, args: {
        skip: number;
        take: number;
        scope: PropertyScope;
    }): Promise<{
        rows: ({
            _count: {
                rooms: number;
            };
            group: {
                name: string;
            } | null;
        } & {
            organizationId: string;
            status: import("@prisma/client").$Enums.PropertyStatus;
            type: import("@prisma/client").$Enums.PropertyType;
            name: string;
            id: string;
            createdAt: Date;
            email: string | null;
            phone: string | null;
            updatedAt: Date;
            deletedAt: Date | null;
            slug: string;
            groupId: string | null;
            addressLine1: string | null;
            addressLine2: string | null;
            city: string | null;
            region: string | null;
            country: string;
            postalCode: string | null;
            timezone: string;
            currency: string;
            checkInTime: string;
            checkOutTime: string;
        })[];
        total: number;
    }>;
    findById(tx: Tx, id: string): Prisma.Prisma__PropertyClient<({
        _count: {
            rooms: number;
        };
        group: {
            name: string;
        } | null;
    } & {
        organizationId: string;
        status: import("@prisma/client").$Enums.PropertyStatus;
        type: import("@prisma/client").$Enums.PropertyType;
        name: string;
        id: string;
        createdAt: Date;
        email: string | null;
        phone: string | null;
        updatedAt: Date;
        deletedAt: Date | null;
        slug: string;
        groupId: string | null;
        addressLine1: string | null;
        addressLine2: string | null;
        city: string | null;
        region: string | null;
        country: string;
        postalCode: string | null;
        timezone: string;
        currency: string;
        checkInTime: string;
        checkOutTime: string;
    }) | null, null, import("@prisma/client/runtime/library").DefaultArgs, Prisma.PrismaClientOptions>;
    /** Includes archived rows: the unique constraint on (organization, slug) covers them too. */
    slugExists(tx: Tx, slug: string): Promise<boolean>;
    groupExists(tx: Tx, id: string): Promise<boolean>;
    create(tx: Tx, data: Prisma.PropertyUncheckedCreateInput): Prisma.Prisma__PropertyClient<{
        _count: {
            rooms: number;
        };
        group: {
            name: string;
        } | null;
    } & {
        organizationId: string;
        status: import("@prisma/client").$Enums.PropertyStatus;
        type: import("@prisma/client").$Enums.PropertyType;
        name: string;
        id: string;
        createdAt: Date;
        email: string | null;
        phone: string | null;
        updatedAt: Date;
        deletedAt: Date | null;
        slug: string;
        groupId: string | null;
        addressLine1: string | null;
        addressLine2: string | null;
        city: string | null;
        region: string | null;
        country: string;
        postalCode: string | null;
        timezone: string;
        currency: string;
        checkInTime: string;
        checkOutTime: string;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, Prisma.PrismaClientOptions>;
    update(tx: Tx, id: string, data: Prisma.PropertyUncheckedUpdateInput): Prisma.Prisma__PropertyClient<{
        _count: {
            rooms: number;
        };
        group: {
            name: string;
        } | null;
    } & {
        organizationId: string;
        status: import("@prisma/client").$Enums.PropertyStatus;
        type: import("@prisma/client").$Enums.PropertyType;
        name: string;
        id: string;
        createdAt: Date;
        email: string | null;
        phone: string | null;
        updatedAt: Date;
        deletedAt: Date | null;
        slug: string;
        groupId: string | null;
        addressLine1: string | null;
        addressLine2: string | null;
        city: string | null;
        region: string | null;
        country: string;
        postalCode: string | null;
        timezone: string;
        currency: string;
        checkInTime: string;
        checkOutTime: string;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, Prisma.PrismaClientOptions>;
    countActiveRooms(tx: Tx, propertyId: string): Prisma.PrismaPromise<number>;
}
