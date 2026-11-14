import type { PropertyDetail, PropertySummary } from '@pms/types';
import type { CreatePropertyInput, PaginationInput, UpdatePropertyInput } from '@pms/validation';
import type { AccessContext, PropertyScope } from '../../common/access/access-context';
import { Paginated } from '../../common/http/response.interceptor';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PropertiesRepository } from './properties.repository';
export declare class PropertiesService {
    private readonly prisma;
    private readonly repo;
    private readonly audit;
    constructor(prisma: PrismaService, repo: PropertiesRepository, audit: AuditService);
    list(query: PaginationInput, scope: PropertyScope): Promise<Paginated<PropertySummary>>;
    get(id: string, access: AccessContext): Promise<PropertyDetail>;
    create(dto: CreatePropertyInput, access: AccessContext): Promise<PropertyDetail>;
    update(id: string, dto: UpdatePropertyInput, access: AccessContext): Promise<PropertyDetail>;
    /** Archive, never hard delete. Refused while the property still has rooms. */
    archive(id: string, access: AccessContext): Promise<void>;
    private requireGroup;
    private uniqueSlug;
}
