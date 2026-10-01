import { HttpException, HttpStatus } from '@nestjs/common';

/** Domain error with a stable machine-readable code and a human-readable message. */
export class AppException extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status: HttpStatus | number = HttpStatus.BAD_REQUEST,
    public readonly details?: unknown[],
  ) {
    super({ code, message, details }, status);
  }
}
