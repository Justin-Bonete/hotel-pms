import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { requestContextMiddleware } from './common/context/request-context';
import { ENV } from './config/config.module';
import type { Env } from './config/env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const env = app.get<Env>(ENV);

  if (env.TRUST_PROXY) app.set('trust proxy', 1);
  app.use(requestContextMiddleware);
  app.use(helmet());
  app.use(cookieParser());
  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: env.WEB_ORIGIN, credentials: true });
  app.enableShutdownHooks();

  await app.listen(env.API_PORT);
  Logger.log(`API ready at http://localhost:${env.API_PORT}/api/v1/health`, 'Bootstrap');
}

bootstrap().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
