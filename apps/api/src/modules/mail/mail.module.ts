import { Global, Module } from '@nestjs/common';
import { ENV } from '../../config/config.module';
import type { Env } from '../../config/env';
import { ConsoleMailService, MailService } from './mail.service';
import { ResendMailService } from './resend-mail.service';

@Global()
@Module({
  providers: [{ provide: MailService, inject: [ENV], useFactory: (env: Env) => (env.MAIL_PROVIDER === 'resend' ? new ResendMailService(env) : new ConsoleMailService(env)) }],
  exports: [MailService],
})
export class MailModule {}
