import { Module } from '@nestjs/common';
import { InvitationService } from './invitation.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  providers: [InvitationService, PrismaService],
  exports: [InvitationService], // 👈 CRUCIAL
})
export class InvitationModule {}
