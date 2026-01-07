import { Module } from '@nestjs/common';
import { PhotosController } from './photos.controller';
import { PhotosService } from './photos.service';
import { PrismaService } from '../prisma/prisma.service';
import { MulterModule } from '@nestjs/platform-express';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    AuthModule,
    MulterModule.register({
      dest: './uploads/photos',
    }),
    JwtModule.register({
      secret: process.env.BAR_DASHBOARD_JWT_SECRET || 'bar-dashboard-secret',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [PhotosController],
  providers: [PhotosService, PrismaService],
  exports: [PhotosService]
})
export class PhotosModule {}