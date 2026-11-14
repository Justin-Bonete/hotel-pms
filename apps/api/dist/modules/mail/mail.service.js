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
exports.ConsoleMailService = exports.MailService = void 0;
const common_1 = require("@nestjs/common");
const config_module_1 = require("../../config/config.module");
class MailService {
}
exports.MailService = MailService;
/**
 * Development stand-in: prints the email to the API console so you can click the link.
 * In production it sends NOTHING and says so loudly. Email provider: connect integration (later phase).
 */
let ConsoleMailService = class ConsoleMailService extends MailService {
    env;
    logger = new common_1.Logger('Mail');
    constructor(env) {
        super();
        this.env = env;
    }
    async send(message) {
        if (this.env.NODE_ENV === 'production') {
            this.logger.warn(`Email provider not configured. NOT sent: "${message.subject}"`);
            return;
        }
        this.logger.log(`\n--- EMAIL (dev console) ---\nTo: ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n---------------------------`);
    }
};
exports.ConsoleMailService = ConsoleMailService;
exports.ConsoleMailService = ConsoleMailService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(config_module_1.ENV)),
    __metadata("design:paramtypes", [Object])
], ConsoleMailService);
//# sourceMappingURL=mail.service.js.map