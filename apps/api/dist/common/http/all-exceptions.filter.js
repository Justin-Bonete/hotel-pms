"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllExceptionsFilter = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const app_exception_1 = require("./app-exception");
const STATUS_CODES = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHENTICATED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    422: 'UNPROCESSABLE',
    429: 'RATE_LIMITED',
};
let AllExceptionsFilter = class AllExceptionsFilter {
    logger = new common_1.Logger('Exceptions');
    catch(exception, host) {
        const http = host.switchToHttp();
        const res = http.getResponse();
        const req = http.getRequest();
        const requestId = res.getHeader('x-request-id');
        const { status, body } = this.translate(exception, requestId);
        if (status >= 500) {
            const err = exception instanceof Error ? exception : new Error(String(exception));
            this.logger.error(`[${requestId}] ${req.method} ${req.url}: ${err.message}`, err.stack);
        }
        res.status(status).json({ error: { ...body, requestId } });
    }
    translate(exception, requestId) {
        if (exception instanceof app_exception_1.AppException) {
            return {
                status: exception.getStatus(),
                body: { code: exception.code, message: exception.message, details: exception.details },
            };
        }
        if (exception instanceof common_1.HttpException) {
            const status = exception.getStatus();
            const response = exception.getResponse();
            const raw = typeof response === 'string' ? response : response.message;
            const message = Array.isArray(raw) ? raw.join('; ') : (raw ?? exception.message);
            return { status, body: { code: STATUS_CODES[status] ?? 'HTTP_ERROR', message } };
        }
        // Backstop: the database refused an overlapping booking on the same room (exclusion constraint).
        // Matched on the message so it works whichever Prisma error class carries it.
        if (exception instanceof Error && /reservations_no_room_overlap|exclusion constraint/i.test(exception.message)) {
            return {
                status: common_1.HttpStatus.CONFLICT,
                body: { code: 'ROOM_UNAVAILABLE', message: 'That room is already booked for some of those dates.' },
            };
        }
        if (exception instanceof client_1.Prisma.PrismaClientKnownRequestError) {
            switch (exception.code) {
                case 'P2002':
                    return {
                        status: common_1.HttpStatus.CONFLICT,
                        body: { code: 'ALREADY_EXISTS', message: 'A record with these values already exists.' },
                    };
                case 'P2025':
                    return {
                        status: common_1.HttpStatus.NOT_FOUND,
                        body: { code: 'NOT_FOUND', message: 'The requested record was not found.' },
                    };
                case 'P2003':
                    return {
                        status: common_1.HttpStatus.CONFLICT,
                        body: { code: 'REFERENCE_CONFLICT', message: 'This record is linked to other data and cannot be changed this way.' },
                    };
            }
        }
        // Unknown failure: never leak internals, always give a reference the user can quote.
        return {
            status: common_1.HttpStatus.INTERNAL_SERVER_ERROR,
            body: {
                code: 'INTERNAL_ERROR',
                message: `Something went wrong on our side. Please try again. If it keeps happening, contact support and quote reference ${requestId ?? 'unavailable'}.`,
            },
        };
    }
};
exports.AllExceptionsFilter = AllExceptionsFilter;
exports.AllExceptionsFilter = AllExceptionsFilter = __decorate([
    (0, common_1.Catch)()
], AllExceptionsFilter);
//# sourceMappingURL=all-exceptions.filter.js.map