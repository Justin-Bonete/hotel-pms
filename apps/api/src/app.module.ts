import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { RequestContextInterceptor } from './common/context/request-context.interceptor';
import { AllExceptionsFilter } from './common/http/all-exceptions.filter';
import { ResponseInterceptor } from './common/http/response.interceptor';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './database/prisma/prisma.module';
import { RedisModule } from './database/redis/redis.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { BuildingsModule } from './modules/buildings/buildings.module';
import { PropertiesModule } from './modules/properties/properties.module';
import { PropertyGroupsModule } from './modules/property-groups/property-groups.module';
import { RoomTypesModule } from './modules/room-types/room-types.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { MailModule } from './modules/mail/mail.module';

@Module({
  imports: [ConfigModule, PrismaModule, RedisModule, AuditModule, MailModule, AuthModule, HealthModule,
    PropertiesModule, PropertyGroupsModule, BuildingsModule, RoomTypesModule, RoomsModule],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // Order matters: context first (outermost), then the response envelope.
    { provide: APP_INTERCEPTOR, useClass: RequestContextInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
  ],
})
export class AppModule {}
