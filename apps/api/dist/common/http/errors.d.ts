import { AppException } from './app-exception';
export declare const notFound: (what: string) => AppException;
export declare const conflict: (code: string, message: string) => AppException;
export declare const badRequest: (code: string, message: string) => AppException;
