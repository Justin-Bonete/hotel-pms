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
exports.FrontDeskController = void 0;
const common_1 = require("@nestjs/common");
const access_decorators_1 = require("../rbac/decorators/access.decorators");
const frontdesk_service_1 = require("./frontdesk.service");
let FrontDeskController = class FrontDeskController {
    frontDesk;
    constructor(frontDesk) {
        this.frontDesk = frontDesk;
    }
    get(propertyId, access) {
        return this.frontDesk.get(propertyId, access);
    }
};
exports.FrontDeskController = FrontDeskController;
__decorate([
    (0, access_decorators_1.RequirePermission)('reservation.read'),
    (0, common_1.Get)('properties/:propertyId/front-desk'),
    __param(0, (0, common_1.Param)('propertyId', common_1.ParseUUIDPipe)),
    __param(1, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Function]),
    __metadata("design:returntype", void 0)
], FrontDeskController.prototype, "get", null);
exports.FrontDeskController = FrontDeskController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [frontdesk_service_1.FrontDeskService])
], FrontDeskController);
//# sourceMappingURL=frontdesk.controller.js.map