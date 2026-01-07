import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DrinksService } from './drinks.service';
import { DrinksController } from './drinks.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    AuthModule,
    JwtModule.register({
      secret: process.env.BAR_DASHBOARD_JWT_SECRET || 'bar-dashboard-secret',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [DrinksController],
  providers: [DrinksService, PrismaService],
  exports: [DrinksService],
})
export class DrinksModule {}