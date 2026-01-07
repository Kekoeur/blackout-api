import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { AuthModule } from 'src/auth/auth.module';
import { OrdersController } from './orders.controller';
import { PhotosModule } from '../photos/photos.module';

@Module({
  imports: [PhotosModule, AuthModule], // Pour utiliser PhotosService
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}