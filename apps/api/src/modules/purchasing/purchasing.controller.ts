import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { createOrderSchema, decisionSchema, invoiceSchema, invoicesQuerySchema, ordersQuerySchema, payInvoiceSchema, receiveSchema } from '@pms/validation';
import type { CreateOrderInput, DecisionInput, InvoiceInput, InvoicesQuery, OrdersQuery, PayInvoiceInput, ReceiveInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Access, RequirePermission } from '../rbac/decorators/access.decorators';
import { PurchasingService } from './purchasing.service';

@Controller()
export class PurchasingController {
  constructor(private readonly purchasing: PurchasingService) {}

  @RequirePermission('purchasing.read')
  @Get('properties/:propertyId/purchase-orders')
  list(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Query(new ZodValidationPipe(ordersQuerySchema)) query: OrdersQuery, @Access() access: AccessContext) {
    return this.purchasing.list(propertyId, query, access);
  }

  @RequirePermission('purchasing.request')
  @Post('properties/:propertyId/purchase-orders')
  create(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Body(new ZodValidationPipe(createOrderSchema)) dto: CreateOrderInput, @Access() access: AccessContext) {
    return this.purchasing.create(propertyId, dto, access);
  }

  /** Approve/reject need purchasing.approve; the requester may cancel their own request. The service checks which. */
  @RequirePermission('purchasing.read')
  @HttpCode(200)
  @Post('purchase-orders/:id/decision')
  decide(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(decisionSchema)) dto: DecisionInput, @Access() access: AccessContext) {
    return this.purchasing.decide(id, dto, access);
  }

  @RequirePermission('purchasing.receive')
  @HttpCode(200)
  @Post('purchase-orders/:id/receive')
  receive(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(receiveSchema)) dto: ReceiveInput, @Access() access: AccessContext) {
    return this.purchasing.receive(id, dto, access);
  }

  @RequirePermission('purchasing.pay')
  @HttpCode(200)
  @Post('purchase-orders/:id/invoice')
  invoice(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(invoiceSchema)) dto: InvoiceInput, @Access() access: AccessContext) {
    return this.purchasing.invoice(id, dto, access);
  }

  @RequirePermission('purchasing.read')
  @Get('properties/:propertyId/supplier-invoices')
  invoices(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Query(new ZodValidationPipe(invoicesQuerySchema)) query: InvoicesQuery, @Access() access: AccessContext) {
    return this.purchasing.listInvoices(propertyId, query, access);
  }

  @RequirePermission('purchasing.pay')
  @HttpCode(200)
  @Post('supplier-invoices/:id/pay')
  pay(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(payInvoiceSchema)) dto: PayInvoiceInput, @Access() access: AccessContext) {
    return this.purchasing.payInvoice(id, dto, access);
  }
}
