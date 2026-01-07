import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FriendsService {
  constructor(private prisma: PrismaService) {}

  async getMyFriends(userId: string) {
    return this.prisma.friend.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    });
  }

  async createFriend(userId: string, name: string) {
    return this.prisma.friend.create({
      data: {
        userId,
        name,
      },
    });
  }

  async deleteFriend(userId: string, friendId: string) {
    const friend = await this.prisma.friend.findFirst({
      where: { id: friendId, userId },
    });

    if (!friend) {
      throw new Error('Friend not found');
    }

    return this.prisma.friend.delete({
      where: { id: friendId },
    });
  }

  async assignOrderItem(
    userId: string,
    orderItemId: string,
    friendId: string | null, // null = pour soi-même
  ) {
    // Supprimer l'ancienne assignation si existe
    await this.prisma.orderItemAssignment.deleteMany({
      where: { orderItemId },
    });

    // Créer la nouvelle
    return this.prisma.orderItemAssignment.create({
      data: {
        userId,
        orderItemId,
        friendId,
      },
    });
  }
}