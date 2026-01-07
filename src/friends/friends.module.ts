import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module'; // ⭐ AJOUTER
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [AuthModule], // ⭐ AJOUTER
  controllers: [FriendsController],
  providers: [FriendsService, PrismaService],
  exports: [FriendsService],
})
export class FriendsModule {}