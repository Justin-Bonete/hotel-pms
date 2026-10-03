import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ENV } from '../../config/config.module';
import type { Env } from '../../config/env';
import { parseDurationSeconds } from '../../config/env';
import { RbacModule } from '../rbac/rbac.module';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { PasswordService } from './password.service';
import { JWT_ISSUER, TokenService } from './token.service';

@Module({
  imports: [
    RbacModule,
    JwtModule.registerAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({
        secret: env.JWT_ACCESS_SECRET,
        signOptions: {
          algorithm: 'HS256',
          issuer: JWT_ISSUER,
          expiresIn: parseDurationSeconds(env.ACCESS_TOKEN_TTL),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthRepository,
    PasswordService,
    TokenService,
    // Order matters: rate-limit, then authentication, then permissions. All apply to every route.
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [TokenService],
})
export class AuthModule {}
