import { Global, Inject, Injectable, Module } from '@nestjs/common';
import { ENV } from '../../config/config.module';
import type { Env } from '../../config/env';
import { decryptString, deriveDevKey, encryptString } from './tokens';

/** Encrypts secrets before they are stored in the database. */
@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  constructor(@Inject(ENV) env: Env) {
    // Production requires DATA_ENCRYPTION_KEY (checked at boot). In development a key is derived so it just works.
    this.key = env.DATA_ENCRYPTION_KEY ? Buffer.from(env.DATA_ENCRYPTION_KEY, 'hex') : deriveDevKey(env.JWT_ACCESS_SECRET);
  }

  encrypt(plaintext: string): string {
    return encryptString(this.key, plaintext);
  }

  decrypt(payload: string): string {
    return decryptString(this.key, payload);
  }
}

@Global()
@Module({ providers: [CryptoService], exports: [CryptoService] })
export class CryptoModule {}
