import { HttpStatus } from '@nestjs/common';
import { AppException } from './app-exception';

export const notFound = (what: string) => new AppException('NOT_FOUND', `${what} was not found.`, HttpStatus.NOT_FOUND);
export const conflict = (code: string, message: string) => new AppException(code, message, HttpStatus.CONFLICT);
export const badRequest = (code: string, message: string) => new AppException(code, message, HttpStatus.BAD_REQUEST);
