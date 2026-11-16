import { Inject, Injectable, Logger } from '@nestjs/common';
import { ENV } from '../../config/config.module';
import type { Env } from '../../config/env';
import { MailMessage, MailService } from './mail.service';
import { buildResendRequest } from './resend-request';

/**
 * Real email through resend.com. Best effort on purpose: a failure is logged but never thrown, so a password-reset request
 * answers the same whether or not the address exists, and a provider outage can't break signing up or inviting staff.
 */
@Injectable()
export class ResendMailService extends MailService {
  private readonly logger = new Logger('Mail');

  constructor(@Inject(ENV) private readonly env: Env) {
    super();
  }

  async send(message: MailMessage): Promise<void> {
    const { url, init } = buildResendRequest(this.env.RESEND_API_KEY ?? '', this.env.MAIL_FROM ?? '', message);
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
      if (!res.ok) this.logger.error(`Email provider refused "${message.subject}" (HTTP ${res.status}): ${(await res.text()).slice(0, 200)}`);
    } catch (err) {
      this.logger.error(`Could not send "${message.subject}": ${(err as Error).message}`);
    }
  }
}
