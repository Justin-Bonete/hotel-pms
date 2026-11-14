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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealtimeController = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
const access_decorators_1 = require("../rbac/decorators/access.decorators");
const realtime_service_1 = require("./realtime.service");
const HEARTBEAT_MS = 25_000;
/** Shorter than the 15-minute access token, so a signed-out or disabled user's stream always ends and must re-authenticate. */
const MAX_STREAM_MS = 14 * 60_000;
let RealtimeController = class RealtimeController {
    realtime;
    constructor(realtime) {
        this.realtime = realtime;
    }
    /** The browser keeps this open and reconnects when it ends. Only properties the caller can see are streamed. */
    stream(access) {
        return new rxjs_1.Observable((subscriber) => {
            const stop = this.realtime.subscribe((organizationId, event) => {
                if (organizationId !== access.organizationId)
                    return;
                if (!access.canSeeProperty(event.propertyId))
                    return;
                subscriber.next({ type: event.type, data: event });
            });
            subscriber.next({ type: 'ready', data: { at: new Date().toISOString() } });
            const beat = setInterval(() => subscriber.next({ type: 'ping', data: { at: new Date().toISOString() } }), HEARTBEAT_MS);
            const limit = setTimeout(() => subscriber.complete(), MAX_STREAM_MS);
            return () => {
                stop();
                clearInterval(beat);
                clearTimeout(limit);
            };
        });
    }
};
exports.RealtimeController = RealtimeController;
__decorate([
    (0, access_decorators_1.RequirePermission)('room.read'),
    (0, common_1.Header)('X-Accel-Buffering', 'no'),
    (0, common_1.Sse)('stream'),
    __param(0, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", rxjs_1.Observable)
], RealtimeController.prototype, "stream", null);
exports.RealtimeController = RealtimeController = __decorate([
    (0, common_1.Controller)('realtime'),
    __metadata("design:paramtypes", [realtime_service_1.RealtimeService])
], RealtimeController);
//# sourceMappingURL=realtime.controller.js.map