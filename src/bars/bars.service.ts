import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BarsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.bar.findMany({
      select: {
        id: true,
        name: true,
        city: true,
        address: true,
        qrCode: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findOne(id: string) {
    return this.prisma.bar.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        city: true,
        address: true,
        qrCode: true,
      },
    });
  }
}