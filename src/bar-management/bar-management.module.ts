// apps/client-api/src/bar-management/bar-management.module.ts

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { BarManagementController } from './bar-management.controller';
import { BarManagementService } from './bar-management.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.BAR_DASHBOARD_JWT_SECRET || 'bar-dashboard-secret',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [BarManagementController],
  providers: [BarManagementService, PrismaService],
  exports: [BarManagementService],
})
export class BarManagementModule {}