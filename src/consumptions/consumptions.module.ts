import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { ConsumptionsService } from './consumptions.service';
import { ConsumptionsController } from './consumptions.controller';

@Module({
  imports: [
    AuthModule,
  ],
  controllers: [ConsumptionsController],
  providers: [ConsumptionsService],
  exports: [ConsumptionsService],
})
export class ConsumptionsModule {}