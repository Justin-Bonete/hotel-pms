"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const request_context_interceptor_1 = require("./common/context/request-context.interceptor");
const all_exceptions_filter_1 = require("./common/http/all-exceptions.filter");
const response_interceptor_1 = require("./common/http/response.interceptor");
const config_module_1 = require("./config/config.module");
const prisma_module_1 = require("./database/prisma/prisma.module");
const redis_module_1 = require("./database/redis/redis.module");
const audit_module_1 = require("./modules/audit/audit.module");
const auth_module_1 = require("./modules/auth/auth.module");
const health_module_1 = require("./modules/health/health.module");
const buildings_module_1 = require("./modules/buildings/buildings.module");
const properties_module_1 = require("./modules/properties/properties.module");
const property_groups_module_1 = require("./modules/property-groups/property-groups.module");
const analytics_module_1 = require("./modules/analytics/analytics.module");
const api_keys_module_1 = require("./modules/api-keys/api-keys.module");
const crypto_service_1 = require("./common/crypto/crypto.service");
const dashboard_module_1 = require("./modules/dashboard/dashboard.module");
const expenses_module_1 = require("./modules/expenses/expenses.module");
const folios_module_1 = require("./modules/folios/folios.module");
const inventory_module_1 = require("./modules/inventory/inventory.module");
const pos_module_1 = require("./modules/pos/pos.module");
const public_api_module_1 = require("./modules/public-api/public-api.module");
const purchasing_module_1 = require("./modules/purchasing/purchasing.module");
const suppliers_module_1 = require("./modules/suppliers/suppliers.module");
const frontdesk_module_1 = require("./modules/frontdesk/frontdesk.module");
const housekeeping_module_1 = require("./modules/housekeeping/housekeeping.module");
const maintenance_module_1 = require("./modules/maintenance/maintenance.module");
const webhooks_module_1 = require("./modules/webhooks/webhooks.module");
const realtime_module_1 = require("./modules/realtime/realtime.module");
const staff_module_1 = require("./modules/staff/staff.module");
const taxes_module_1 = require("./modules/taxes/taxes.module");
const guests_module_1 = require("./modules/guests/guests.module");
const rates_module_1 = require("./modules/rates/rates.module");
const reservations_module_1 = require("./modules/reservations/reservations.module");
const room_types_module_1 = require("./modules/room-types/room-types.module");
const rooms_module_1 = require("./modules/rooms/rooms.module");
const mail_module_1 = require("./modules/mail/mail.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [config_module_1.ConfigModule, prisma_module_1.PrismaModule, redis_module_1.RedisModule, audit_module_1.AuditModule, mail_module_1.MailModule, auth_module_1.AuthModule, health_module_1.HealthModule,
            properties_module_1.PropertiesModule, property_groups_module_1.PropertyGroupsModule, buildings_module_1.BuildingsModule, room_types_module_1.RoomTypesModule, rooms_module_1.RoomsModule,
            guests_module_1.GuestsModule, rates_module_1.RatesModule, reservations_module_1.ReservationsModule, folios_module_1.FoliosModule, taxes_module_1.TaxesModule,
            realtime_module_1.RealtimeModule, staff_module_1.StaffModule, housekeeping_module_1.HousekeepingModule, maintenance_module_1.MaintenanceModule, frontdesk_module_1.FrontDeskModule,
            suppliers_module_1.SuppliersModule, inventory_module_1.InventoryModule, purchasing_module_1.PurchasingModule, expenses_module_1.ExpensesModule, dashboard_module_1.DashboardModule, pos_module_1.PosModule, analytics_module_1.AnalyticsModule,
            crypto_service_1.CryptoModule, webhooks_module_1.WebhooksModule, api_keys_module_1.ApiKeysModule, public_api_module_1.PublicApiModule],
        providers: [
            { provide: core_1.APP_FILTER, useClass: all_exceptions_filter_1.AllExceptionsFilter },
            // Order matters: context first (outermost), then the response envelope.
            { provide: core_1.APP_INTERCEPTOR, useClass: request_context_interceptor_1.RequestContextInterceptor },
            { provide: core_1.APP_INTERCEPTOR, useClass: response_interceptor_1.ResponseInterceptor },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map