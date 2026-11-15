import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { createWebhookSchema, updateWebhookSchema } from '@pms/validation';
import type { CreateWebhookInput, UpdateWebhookInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Access, RequirePermission } from '../rbac/decorators/access.decorators';
import { WebhooksService } from './webhooks.service';

@Controller('integrations')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @RequirePermission('integration.read')
  @Get('webhooks')
  list(@Access() access: AccessContext) {
    return this.webhooks.list(access);
  }

  @RequirePermission('integration.manage')
  @Post('webhooks')
  create(@Body(new ZodValidationPipe(createWebhookSchema)) dto: CreateWebhookInput, @Access() access: AccessContext) {
    return this.webhooks.create(dto, access);
  }

  @RequirePermission('integration.manage')
  @Patch('webhooks/:id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(updateWebhookSchema)) dto: UpdateWebhookInput, @Access() access: AccessContext) {
    return this.webhooks.update(id, dto, access);
  }

  @RequirePermission('integration.manage')
  @HttpCode(200)
  @Delete('webhooks/:id')
  async remove(@Param('id', ParseUUIDPipe) id: string, @Access() access: AccessContext) {
    await this.webhooks.remove(id, access);
    return null;
  }

  @RequirePermission('integration.manage')
  @HttpCode(200)
  @Post('webhooks/:id/rotate-secret')
  rotate(@Param('id', ParseUUIDPipe) id: string, @Access() access: AccessContext) {
    return this.webhooks.rotateSecret(id, access);
  }

  @RequirePermission('integration.manage')
  @HttpCode(200)
  @Post('webhooks/:id/test')
  test(@Param('id', ParseUUIDPipe) id: string, @Access() access: AccessContext) {
    return this.webhooks.sendTest(id, access);
  }

  @RequirePermission('integration.read')
  @Get('webhooks/:id/deliveries')
  deliveries(@Param('id', ParseUUIDPipe) id: string, @Access() access: AccessContext) {
    return this.webhooks.deliveries(id, access);
  }

  @RequirePermission('integration.manage')
  @HttpCode(200)
  @Post('webhook-deliveries/:id/redeliver')
  redeliver(@Param('id', ParseUUIDPipe) id: string, @Access() access: AccessContext) {
    return this.webhooks.redeliver(id, access);
  }
}
