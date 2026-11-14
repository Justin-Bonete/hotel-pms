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
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { FoliosModule } from './modules/folios/folios.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { PosModule } from './modules/pos/pos.module';
import { PurchasingModule } from './modules/purchasing/purchasing.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { FrontDeskModule } from './modules/frontdesk/frontdesk.module';
import { HousekeepingModule } from './modules/housekeeping/housekeeping.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { StaffModule } from './modules/staff/staff.module';
import { TaxesModule } from './modules/taxes/taxes.module';
import { GuestsModule } from './modules/guests/guests.module';
import { RatesModule } from './modules/rates/rates.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { RoomTypesModule } from './modules/room-types/room-types.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { MailModule } from './modules/mail/mail.module';

@Module({
  imports: [ConfigModule, PrismaModule, RedisModule, AuditModule, MailModule, AuthModule, HealthModule,
    PropertiesModule, PropertyGroupsModule, BuildingsModule, RoomTypesModule, RoomsModule,
    GuestsModule, RatesModule, ReservationsModule, FoliosModule, TaxesModule,
    RealtimeModule, StaffModule, HousekeepingModule, MaintenanceModule, FrontDeskModule,
    SuppliersModule, InventoryModule, PurchasingModule, ExpensesModule, DashboardModule, PosModule],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // Order matters: context first (outermost), then the response envelope.
    { provide: APP_INTERCEPTOR, useClass: RequestContextInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
  ],
})
export class AppModule {}
