import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

@Injectable()
export class PasswordService {
  private dummyHash?: Promise<string>;

  hash(plain: string): Promise<string> {
    return argon2.hash(plain, { type: argon2.argon2id });
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }

  /** Burn the same CPU time as a real check so unknown emails aren't distinguishable by speed. */
  async spendVerifyTime(plain: string): Promise<void> {
    this.dummyHash ??= argon2.hash('timing-equalizer-not-a-real-password', { type: argon2.argon2id });
    await this.verify(await this.dummyHash, plain);
  }
}
