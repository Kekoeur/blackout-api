import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BarsController } from './bars.controller';
import { BarsService } from './bars.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [AuthModule],
  controllers: [BarsController],
  providers: [BarsService, PrismaService],
  exports: [BarsService],
})
export class BarsModule {}