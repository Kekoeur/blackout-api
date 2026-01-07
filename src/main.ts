import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') || '*',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,  // Retire les props non décorées
      transform: true,  // Transforme les types automatiquement
      forbidNonWhitelisted: true,  // Rejette les props inconnues
    }),
  );

  app.use('/uploads', express.static('uploads'));

  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT || 3026;
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 Server running on http://localhost:${port}`);
  console.log(`🌐 Network: http://192.168.1.50:${port}`);
}

bootstrap();