import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AppLogger } from './common/logger/app-logger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: new AppLogger() });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = parseInt(process.env.PORT ?? '8000', 10);
  await app.listen(port, '0.0.0.0');
  console.log(`Ticket service listening on port ${port}`);
}

bootstrap();
