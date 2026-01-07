import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ConsumptionsService {
  constructor(private prisma: PrismaService) {}

  async findMyConsumptions(userId: string) {
    console.log('🔍 Service - findMyConsumptions for user:', userId);

    const consumptions = await this.prisma.consumption.findMany({
      where: { userId },
      include: {
        drink: {
          select: {
            id: true,
            name: true,
            type: true,
            imageUrl: true,
            alcoholLevel: true,
          },
        },
        bar: {
          select: {
            id: true,
            name: true,
            city: true,
          },
        },
      },
      orderBy: { validatedAt: 'desc' },
    });

    console.log('📊 Found consumptions:', consumptions.length);
    return consumptions;
  }

  async findByBar(userId: string, barId: string) {
    return this.prisma.consumption.findMany({
      where: { userId, barId },
      include: {
        drink: true,
      },
      orderBy: { validatedAt: 'desc' },
    });
  }

  async getStats(userId: string) {
    const consumptions = await this.prisma.consumption.count({
      where: { userId },
    });

    const uniqueDrinks = await this.prisma.consumption.findMany({
      where: { userId },
      distinct: ['drinkId'],
      select: { drinkId: true },
    });

    const uniqueBars = await this.prisma.consumption.findMany({
      where: { userId },
      distinct: ['barId'],
      select: { barId: true },
    });

    return {
      totalConsumptions: consumptions,
      uniqueDrinks: uniqueDrinks.length,
      uniqueBars: uniqueBars.length,
    };
  }
}
