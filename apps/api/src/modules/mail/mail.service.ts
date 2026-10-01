import { Inject, Injectable, Logger } from '@nestjs/common';
import { ENV } from '../../config/config.module';
import type { Env } from '../../config/env';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export abstract class MailService {
  abstract send(message: MailMessage): Promise<void>;
}

/**
 * Development stand-in: prints the email to the API console so you can click the link.
 * In production it sends NOTHING and says so loudly. Email provider: connect integration (later phase).
 */
@Injectable()
export class ConsoleMailService extends MailService {
  private readonly logger = new Logger('Mail');

  constructor(@Inject(ENV) private readonly env: Env) {
    super();
  }

  async send(message: MailMessage): Promise<void> {
    if (this.env.NODE_ENV === 'production') {
      this.logger.warn(`Email provider not configured. NOT sent: "${message.subject}"`);
      return;
    }
    this.logger.log(`\n--- EMAIL (dev console) ---\nTo: ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n---------------------------`);
  }
}
