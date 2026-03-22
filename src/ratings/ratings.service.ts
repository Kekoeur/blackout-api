import { Injectable, BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
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
            status: 'DELIVERED',
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

    try {
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
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Failed to save rating');
    }
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
      throw new NotFoundException('Rating not found');
    }

    try {
      return await this.prisma.rating.update({
        where: { id: rating.id },
        data: {
          rating: stars,
          comment: comment || null,
        },
      });
    } catch (error) {
      throw new InternalServerErrorException('Failed to update rating');
    }
  }
}