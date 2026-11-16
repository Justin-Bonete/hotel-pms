"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FoliosModule = void 0;
const common_1 = require("@nestjs/common");
const webhooks_module_1 = require("../webhooks/webhooks.module");
const folio_ledger_service_1 = require("./folio-ledger.service");
const folios_controller_1 = require("./folios.controller");
const folios_service_1 = require("./folios.service");
let FoliosModule = class FoliosModule {
};
exports.FoliosModule = FoliosModule;
exports.FoliosModule = FoliosModule = __decorate([
    (0, common_1.Module)({
        imports: [webhooks_module_1.WebhooksModule],
        controllers: [folios_controller_1.FoliosController],
        providers: [folios_service_1.FoliosService, folio_ledger_service_1.FolioLedger],
        exports: [folio_ledger_service_1.FolioLedger],
    })
], FoliosModule);
//# sourceMappingURL=folios.module.js.map