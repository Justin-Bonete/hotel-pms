import { HttpException, HttpStatus } from '@nestjs/common';
/** Domain error with a stable machine-readable code and a human-readable message. */
export declare class AppException extends HttpException {
    readonly code: string;
    readonly details?: unknown[] | undefined;
    constructor(code: string, message: string, status?: HttpStatus | number, details?: unknown[] | undefined);
}
