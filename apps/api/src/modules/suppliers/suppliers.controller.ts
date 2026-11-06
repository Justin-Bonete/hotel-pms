import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { supplierSchema, updateSupplierSchema } from '@pms/validation';
import type { SupplierInput, UpdateSupplierInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Access, RequirePermission } from '../rbac/decorators/access.decorators';
import { SuppliersService } from './suppliers.service';

// Suppliers belong to the organization. The caller must hold the permission somewhere.
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @RequirePermission('purchasing.read')
  @Get()
  list() {
    return this.suppliers.list();
  }

  @RequirePermission('purchasing.manage')
  @Post()
  create(@Body(new ZodValidationPipe(supplierSchema)) dto: SupplierInput, @Access() access: AccessContext) {
    return this.suppliers.create(dto, access);
  }

  @RequirePermission('purchasing.manage')
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(updateSupplierSchema)) dto: UpdateSupplierInput, @Access() access: AccessContext) {
    return this.suppliers.update(id, dto, access);
  }

  @RequirePermission('purchasing.manage')
  @HttpCode(200)
  @Delete(':id')
  async archive(@Param('id', ParseUUIDPipe) id: string, @Access() access: AccessContext) {
    await this.suppliers.archive(id, access);
    return null;
  }
}
