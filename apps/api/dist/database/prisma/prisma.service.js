"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var PrismaService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const node_async_hooks_1 = require("node:async_hooks");
const request_context_1 = require("../../common/context/request-context");
const app_exception_1 = require("../../common/http/app-exception");
const config_module_1 = require("../../config/config.module");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/**
 * The ONLY door to the database.
 *
 * Connects as pms_app, so PostgreSQL Row-Level Security applies. Repositories must run queries
 * through one of the two helpers below; each opens a transaction and sets the tenant for it:
 *
 *   forTenant(fn)          tenant taken from the authenticated request (normal path)
 *   withoutTenant(why, fn) RLS bypass for flows that run before a tenant is known
 *                          (login, refresh, register, password reset). Keep usages few and reviewed.
 *
 * Using the bare client (this.prisma.user.findMany) would see zero tenant rows, which is the safe failure.
 */
let PrismaService = PrismaService_1 = class PrismaService extends client_1.PrismaClient {
    logger = new common_1.Logger(PrismaService_1.name);
    commitQueue = new node_async_hooks_1.AsyncLocalStorage();
    constructor(env) {
        super({ datasourceUrl: env.APP_DATABASE_URL });
    }
    async onModuleInit() {
        await this.$connect();
    }
    async onModuleDestroy() {
        await this.$disconnect();
    }
    forTenant(fn) {
        const organizationId = request_context_1.RequestContextStore.get()?.organizationId;
        if (!organizationId) {
            throw new app_exception_1.AppException('TENANT_CONTEXT_MISSING', 'This request has no organization context.', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
        return this.forOrganization(organizationId, fn);
    }
    /** Explicit organization (background jobs, seeds run by the app, tests). */
    forOrganization(organizationId, fn) {
        if (!UUID.test(organizationId)) {
            throw new app_exception_1.AppException('TENANT_CONTEXT_INVALID', 'Invalid organization context.', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
        return this.runCommitted(() => this.$transaction(async (tx) => {
            // is_local = true: the setting dies with the transaction, so pooled connections never leak a tenant.
            await tx.$queryRaw `SELECT set_config('app.org_id', ${organizationId}, true)`;
            return fn(tx);
        }));
    }
    /**
     * Queue a side effect (e.g. a realtime event) to run only AFTER the surrounding forTenant/withoutTenant
     * transaction has committed. If it rolls back, the effect never happens. Outside a transaction it runs now.
     */
    afterCommit(effect) {
        const queue = this.commitQueue.getStore();
        if (queue)
            queue.push(effect);
        else
            effect();
    }
    async runCommitted(work) {
        const queue = [];
        const result = await this.commitQueue.run(queue, work);
        for (const effect of queue) {
            try {
                effect();
            }
            catch (err) {
                this.logger.warn(`after-commit effect failed: ${err.message}`);
            }
        }
        return result;
    }
    withoutTenant(reason, fn) {
        this.logger.debug(`RLS bypass: ${reason}`);
        return this.runCommitted(() => this.$transaction(async (tx) => {
            await tx.$queryRaw `SELECT set_config('app.bypass_rls', 'on', true)`;
            return fn(tx);
        }));
    }
};
exports.PrismaService = PrismaService;
exports.PrismaService = PrismaService = PrismaService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(config_module_1.ENV)),
    __metadata("design:paramtypes", [Object])
], PrismaService);
//# sourceMappingURL=prisma.service.js.map