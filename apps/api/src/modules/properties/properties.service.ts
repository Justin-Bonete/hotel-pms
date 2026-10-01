import { Injectable } from '@nestjs/common';
import type { PropertySummary } from '@pms/types';
import type { PaginationInput } from '@pms/validation';
import { Paginated } from '../../common/http/response.interceptor';
import { PrismaService } from '../../database/prisma/prisma.service';
import { PropertiesRepository } from './properties.repository';

@Injectable()
export class PropertiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: PropertiesRepository,
  ) {}

  async list(query: PaginationInput): Promise<Paginated<PropertySummary>> {
    const { rows, total } = await this.prisma.forTenant((tx) =>
      this.repo.list(tx, { skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    );
    const items: PropertySummary[] = rows.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      type: p.type,
      status: p.status,
      city: p.city,
      region: p.region,
      groupName: p.group?.name ?? null,
    }));
    return new Paginated(items, { page: query.page, pageSize: query.pageSize, total });
  }
}
