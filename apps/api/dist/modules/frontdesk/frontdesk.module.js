"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FrontDeskModule = void 0;
const common_1 = require("@nestjs/common");
const frontdesk_controller_1 = require("./frontdesk.controller");
const frontdesk_service_1 = require("./frontdesk.service");
let FrontDeskModule = class FrontDeskModule {
};
exports.FrontDeskModule = FrontDeskModule;
exports.FrontDeskModule = FrontDeskModule = __decorate([
    (0, common_1.Module)({ controllers: [frontdesk_controller_1.FrontDeskController], providers: [frontdesk_service_1.FrontDeskService] })
], FrontDeskModule);
//# sourceMappingURL=frontdesk.module.js.map