import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RatingsService {
  constructor(private prisma: PrismaService) {}

  async rateAllDrinkConsumptions(
    userId: string,
    drinkId: string,
    stars: number,
    comment?: string,
  ) {
    console.log('⭐ Rating drink:', drinkId, 'by user:', userId);

    // ⭐ CHANGER : Vérifier dans OrderItem avec Order VALIDATED
    const assignedOrderItems = await this.prisma.orderItemAssignment.findMany({
      where: {
        orderItem: {
          drinkId,
          order: {
            status: 'VALIDATED',
          },
        },
        OR: [
          { userId, friendId: null }, // Assigné à moi-même directement
          { 
            friend: {
              linkedUserId: userId, // Assigné via un ami lié
            },
          },
        ],
      },
    });

    if (assignedOrderItems.length === 0) {
      throw new BadRequestException('Vous devez avoir consommé ce shooter pour le noter');
    }

    console.log('✅ User is assigned to this drink', assignedOrderItems.length, 'times');

    // Supprimer l'ancienne note (si existe)
    await this.prisma.rating.deleteMany({
      where: {
        userId,
        drinkId,
      },
    });

    // Créer la nouvelle note
    const rating = await this.prisma.rating.create({
      data: {
        userId,
        drinkId,
        rating: stars,
        comment: comment || null,
      },
      include: {
        drink: {
          select: {
            name: true,
          },
        },
      },
    });

    console.log('✅ Rating created:', rating.id, 'for', rating.drink.name);

    return rating;
  }

  async getMyRatings(userId: string) {
    return this.prisma.rating.findMany({
      where: { userId },
      include: {
        drink: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getRatingForDrink(userId: string, drinkId: string) {
    return this.prisma.rating.findFirst({
      where: {
        userId,
        drinkId,
      },
    });
  }

  async updateRating(
    userId: string,
    drinkId: string,
    stars: number,
    comment?: string,
  ) {
    const rating = await this.prisma.rating.findFirst({
      where: { userId, drinkId },
    });

    if (!rating) {
      throw new BadRequestException('Rating not found');
    }

    return this.prisma.rating.update({
      where: { id: rating.id },
      data: {
        rating: stars,
        comment: comment || null,
      },
    });
  }
}