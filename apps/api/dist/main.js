"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const helmet_1 = __importDefault(require("helmet"));
const app_module_1 = require("./app.module");
const request_context_1 = require("./common/context/request-context");
const config_module_1 = require("./config/config.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const env = app.get(config_module_1.ENV);
    if (env.TRUST_PROXY)
        app.set('trust proxy', 1);
    app.use(request_context_1.requestContextMiddleware);
    app.use((0, helmet_1.default)());
    app.use((0, cookie_parser_1.default)());
    app.setGlobalPrefix('api/v1');
    app.enableCors({ origin: env.WEB_ORIGIN, credentials: true });
    app.enableShutdownHooks();
    await app.listen(env.API_PORT);
    common_1.Logger.log(`API ready at http://localhost:${env.API_PORT}/api/v1/health`, 'Bootstrap');
}
bootstrap().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
});
//# sourceMappingURL=main.js.map