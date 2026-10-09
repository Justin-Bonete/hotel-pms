import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ratePlanSchema } from '@pms/validation';
import type { RatePlanInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Access, RequirePermission } from '../rbac/decorators/access.decorators';
import { RatesService } from './rates.service';

@Controller()
export class RatesController {
  constructor(private readonly rates: RatesService) {}

  @RequirePermission('rate.read')
  @Get('properties/:propertyId/rate-plans')
  list(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Access() access: AccessContext) {
    return this.rates.list(propertyId, access);
  }

  @RequirePermission('rate.manage')
  @Post('properties/:propertyId/rate-plans')
  create(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Body(new ZodValidationPipe(ratePlanSchema)) dto: RatePlanInput, @Access() access: AccessContext) {
    return this.rates.create(propertyId, dto, access);
  }

  @RequirePermission('rate.manage')
  @Patch('rate-plans/:id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(ratePlanSchema)) dto: RatePlanInput, @Access() access: AccessContext) {
    return this.rates.update(id, dto, access);
  }

  @RequirePermission('rate.manage')
  @HttpCode(200)
  @Delete('rate-plans/:id')
  async archive(@Param('id', ParseUUIDPipe) id: string, @Access() access: AccessContext) {
    await this.rates.archive(id, access);
    return null;
  }
}
