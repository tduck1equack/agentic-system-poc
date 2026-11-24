import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { json } from 'express';
import { AppModule } from './app.module';
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(json({ limit: '3mb' }));
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 3001), '0.0.0.0');
}
void bootstrap();
