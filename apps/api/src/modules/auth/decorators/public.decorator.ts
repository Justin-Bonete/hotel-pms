import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';
/** Opt out of the global JWT guard. Everything is protected by default. */
export const Public = () => SetMetadata(IS_PUBLIC, true);
