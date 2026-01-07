import { Injectable, ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { generateFriendCode } from 'src/utils/generate-friend-code';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(data: { email: string; username: string; password: string }) {
    const exists = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: data.email },
          { username: data.username },
        ],
      },
    });

    if (exists) {
      throw new ConflictException('Email or username already exists');
    }

        let friendCode = generateFriendCode(data.username);
    
    let codeExists = await this.prisma.user.findUnique({
      where: { friendCode },
    });
    
    while (codeExists) {
      friendCode = generateFriendCode(data.username);
      codeExists = await this.prisma.user.findUnique({
        where: { friendCode },
      });
    }

    return this.prisma.user.create({
      data: {
        ...data,
        friendCode,
      },
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        friendCode: true,
        createdAt: true,
      },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        friendCode: true,
        createdAt: true,
      },
    });
  }

  async updateProfile(userId: string, data: { username?: string; bio?: string }) {
    // Vérifier si username est déjà pris
    if (data.username) {
      const existing = await this.prisma.user.findFirst({
        where: {
          username: data.username,
          NOT: { id: userId },
        },
      });

      if (existing) {
        throw new BadRequestException('Ce nom d\'utilisateur est déjà pris');
      }
    }

    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        friendCode: true,
      },
    });
  }

  async updateAvatar(userId: string, avatarPath: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { avatar: avatarPath },
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        friendCode: true,
      },
    });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('Utilisateur non trouvé');
    }

    // Vérifier l'ancien mot de passe
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      throw new UnauthorizedException('Mot de passe actuel incorrect');
    }

    // Hasher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { success: true };
  }

  async deleteAccount(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('Utilisateur non trouvé');
    }

    // Vérifier le mot de passe
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      throw new UnauthorizedException('Mot de passe incorrect');
    }

    // Supprimer l'utilisateur (cascade les relations)
    await this.prisma.user.delete({
      where: { id: userId },
    });

    return { success: true };
  }

  async findOne(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        friendCode: true,
      },
    });
  }

  async findByFriendCode(friendCode: string) {
    return this.prisma.user.findUnique({
      where: { friendCode },
      select: {
        id: true,
        username: true,
        avatar: true,
      },
    });
  }

  async linkFriend(userId: string, friendId: string, targetFriendCode: string) {
    // Trouver l'utilisateur cible
    const targetUser = await this.findByFriendCode(targetFriendCode);
    
    if (!targetUser) {
      throw new BadRequestException('Code ami invalide');
    }

    // Vérifier que l'ami appartient bien à l'utilisateur
    const friend = await this.prisma.friend.findFirst({
      where: {
        id: friendId,
        userId,
      },
    });

    if (!friend) {
      throw new BadRequestException('Ami non trouvé');
    }

    // Lier l'ami au compte
    await this.prisma.friend.update({
      where: { id: friendId },
      data: {
        linkedUserId: targetUser.id,
      },
    });

    return { success: true, linkedTo: targetUser.username };
  }

  async getUserStats(userId: string) {
    // Total de consommations
    const totalConsumptions = await this.prisma.consumption.count({
      where: { userId },
    });

    // Shooters uniques testés (via assignments)
    const uniqueDrinks = await this.prisma.orderItemAssignment.findMany({
      where: {
        OR: [
          { userId, friendId: null },
          { 
            friend: {
              linkedUserId: userId,
            },
          },
        ],
        orderItem: {
          order: {
            status: 'VALIDATED',
          },
        },
      },
      select: {
        orderItem: {
          select: {
            drinkId: true,
          },
        },
      },
      distinct: ['orderItemId'],
    });

    const uniqueDrinkIds = new Set(uniqueDrinks.map(u => u.orderItem.drinkId));

    // Bars visités
    const uniqueBars = await this.prisma.order.findMany({
      where: {
        userId,
        status: 'VALIDATED',
      },
      select: {
        barId: true,
      },
      distinct: ['barId'],
    });

    return {
      totalConsumptions,
      uniqueShooters: uniqueDrinkIds.size,
      barsVisited: uniqueBars.length,
    };
  }
}
