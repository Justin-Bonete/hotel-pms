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
var RealtimeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealtimeService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const redis_service_1 = require("../../database/redis/redis.service");
/**
 * Live updates. Events are published to Redis (so every API instance sees them) and pushed to connected
 * browsers over Server-Sent Events. Events carry ids only; clients refetch through the normal, permission-checked API.
 */
let RealtimeService = RealtimeService_1 = class RealtimeService {
    redis;
    prisma;
    logger = new common_1.Logger(RealtimeService_1.name);
    subscriber;
    listeners = new Set();
    constructor(redis, prisma) {
        this.redis = redis;
        this.prisma = prisma;
    }
    async onModuleInit() {
        try {
            this.subscriber = this.redis.client.duplicate();
            this.subscriber.on('error', (err) => this.logger.warn(`Realtime subscriber error: ${err.message}`));
            await this.subscriber.psubscribe('rt:*');
            this.subscriber.on('pmessage', (_pattern, channel, message) => {
                try {
                    const event = JSON.parse(message);
                    const organizationId = channel.slice('rt:'.length);
                    for (const listener of this.listeners)
                        listener(organizationId, event);
                }
                catch (err) {
                    this.logger.warn(`Ignoring malformed realtime message: ${err.message}`);
                }
            });
        }
        catch (err) {
            // The app keeps working without live updates; screens still refresh on a timer.
            this.logger.warn(`Realtime disabled: ${err.message}`);
        }
    }
    onModuleDestroy() {
        this.subscriber?.disconnect();
    }
    /** Call from inside a transaction: the event is sent only if (and after) the transaction commits. */
    emit(organizationId, type, propertyId, ids) {
        this.prisma.afterCommit(() => {
            const event = { type, propertyId, ids, at: new Date().toISOString() };
            this.redis.client.publish(`rt:${organizationId}`, JSON.stringify(event)).catch((err) => {
                this.logger.warn(`Could not publish ${type}: ${err.message}`);
            });
        });
    }
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
};
exports.RealtimeService = RealtimeService;
exports.RealtimeService = RealtimeService = RealtimeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_service_1.RedisService,
        prisma_service_1.PrismaService])
], RealtimeService);
//# sourceMappingURL=realtime.service.js.map