import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // Rend PrismaService disponible partout
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}