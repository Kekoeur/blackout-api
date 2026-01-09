import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
    : [];

  app.enableCors({
    origin: (origin, callback) => {
      // Autoriser Postman / curl
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.error('❌ CORS blocked origin:', origin);
      return callback(new Error('Not allowed by CORS'));
    },
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