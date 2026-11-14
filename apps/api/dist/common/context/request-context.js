"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestContextStore = void 0;
exports.requestContextMiddleware = requestContextMiddleware;
const node_async_hooks_1 = require("node:async_hooks");
const node_crypto_1 = require("node:crypto");
const storage = new node_async_hooks_1.AsyncLocalStorage();
exports.RequestContextStore = {
    run(ctx, fn) {
        return storage.run(ctx, fn);
    },
    get() {
        return storage.getStore();
    },
};
const REQUEST_ID = /^[\w-]{8,64}$/;
/**
 * Only tags the request with an id (response header). The AsyncLocalStorage context is created later by
 * RequestContextInterceptor, because body parsers can drop async context that was opened this early.
 */
function requestContextMiddleware(req, res, next) {
    const incoming = req.header('x-request-id');
    res.setHeader('x-request-id', incoming && REQUEST_ID.test(incoming) ? incoming : (0, node_crypto_1.randomUUID)());
    next();
}
//# sourceMappingURL=request-context.js.map