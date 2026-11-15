import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { createApiKeySchema } from '@pms/validation';
import type { CreateApiKeyInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Access, RequirePermission } from '../rbac/decorators/access.decorators';
import { ApiKeysService } from './api-keys.service';

@Controller('integrations/api-keys')
export class ApiKeysController {
  constructor(private readonly keys: ApiKeysService) {}

  @RequirePermission('integration.read')
  @Get()
  list(@Access() access: AccessContext) {
    return this.keys.list(access);
  }

  /** The full key is in this response and nowhere else, ever. */
  @RequirePermission('integration.manage')
  @Post()
  create(@Body(new ZodValidationPipe(createApiKeySchema)) dto: CreateApiKeyInput, @Access() access: AccessContext) {
    return this.keys.create(dto, access);
  }

  @RequirePermission('integration.manage')
  @HttpCode(200)
  @Post(':id/revoke')
  revoke(@Param('id', ParseUUIDPipe) id: string, @Access() access: AccessContext) {
    return this.keys.revoke(id, access);
  }
}
