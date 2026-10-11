import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { taxSchema, updateTaxSchema } from '@pms/validation';
import type { TaxInput, UpdateTaxInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Access, RequirePermission } from '../rbac/decorators/access.decorators';
import { TaxesService } from './taxes.service';

@Controller()
export class TaxesController {
  constructor(private readonly taxes: TaxesService) {}

  @RequirePermission('rate.read')
  @Get('properties/:propertyId/taxes')
  list(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Access() access: AccessContext) {
    return this.taxes.list(propertyId, access);
  }

  @RequirePermission('tax.manage')
  @Post('properties/:propertyId/taxes')
  create(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Body(new ZodValidationPipe(taxSchema)) dto: TaxInput, @Access() access: AccessContext) {
    return this.taxes.create(propertyId, dto, access);
  }

  @RequirePermission('tax.manage')
  @Patch('taxes/:id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(updateTaxSchema)) dto: UpdateTaxInput, @Access() access: AccessContext) {
    return this.taxes.update(id, dto, access);
  }

  @RequirePermission('tax.manage')
  @HttpCode(200)
  @Delete('taxes/:id')
  async archive(@Param('id', ParseUUIDPipe) id: string, @Access() access: AccessContext) {
    await this.taxes.archive(id, access);
    return null;
  }
}
