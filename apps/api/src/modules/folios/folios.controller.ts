import { Body, Controller, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { adjustmentSchema, chargeSchema, paymentSchema, refundSchema, voidSchema } from '@pms/validation';
import type { AdjustmentInput, ChargeInput, PaymentInput, RefundInput, VoidInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Access, RequirePermission } from '../rbac/decorators/access.decorators';
import { FoliosService } from './folios.service';

const KEY = 'idempotency-key';

/** Every money-moving route accepts an optional Idempotency-Key header: replaying it never posts twice. */
@Controller()
export class FoliosController {
  constructor(private readonly folios: FoliosService) {}

  @RequirePermission('folio.read')
  @Get('reservations/:id/folio')
  get(@Param('id', ParseUUIDPipe) id: string, @Access() access: AccessContext) {
    return this.folios.get(id, access);
  }

  @RequirePermission('folio.charge')
  @Post('reservations/:id/folio/charges')
  charge(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(chargeSchema)) dto: ChargeInput, @Headers(KEY) key: string | undefined, @Access() access: AccessContext) {
    return this.folios.addCharge(id, dto, cleanKey(key), access);
  }

  @RequirePermission('folio.adjust')
  @Post('reservations/:id/folio/adjustments')
  adjust(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(adjustmentSchema)) dto: AdjustmentInput, @Access() access: AccessContext) {
    return this.folios.addAdjustment(id, dto, access);
  }

  @RequirePermission('payment.take')
  @Post('reservations/:id/folio/payments')
  pay(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(paymentSchema)) dto: PaymentInput, @Headers(KEY) key: string | undefined, @Access() access: AccessContext) {
    return this.folios.recordPayment(id, dto, cleanKey(key), access);
  }

  @RequirePermission('folio.adjust')
  @HttpCode(200)
  @Post('folio-items/:id/void')
  voidItem(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(voidSchema)) dto: VoidInput, @Access() access: AccessContext) {
    return this.folios.voidItem(id, dto, access);
  }

  @RequirePermission('payment.refund')
  @Post('payments/:id/refunds')
  refund(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(refundSchema)) dto: RefundInput, @Headers(KEY) key: string | undefined, @Access() access: AccessContext) {
    return this.folios.refund(id, dto, cleanKey(key), access);
  }
}

/** Keys are opaque client strings; keep them short and printable. */
function cleanKey(value: string | undefined): string | undefined {
  const key = value?.trim();
  return key && /^[\w:.-]{8,100}$/.test(key) ? key : undefined;
}
