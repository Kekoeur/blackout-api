// apps/client-api/src/admin/admin.service.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  // ===== COMMANDES =====
  
  async getAllOrders(status?: string) {
    // ⭐ SOLUTION : Construire le where conditionnellement
    // TypeScript infère correctement le type quand c'est écrit comme ça
    return this.prisma.order.findMany({
      ...(status ? { where: { status: status as any } } : {}),
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        bar: {
          select: {
            id: true,
            name: true,
            city: true,
          },
        },
        items: {
          include: {
            drink: {
              select: {
                name: true,
                imageUrl: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
  
  async deleteOrder(orderId: string) {
    await this.prisma.orderItemAssignment.deleteMany({
      where: {
        orderItem: {
          orderId,
        },
      },
    });
    
    await this.prisma.orderItem.deleteMany({
      where: { orderId },
    });
    
    return this.prisma.order.delete({
      where: { id: orderId },
    });
  }
  
  // ===== UTILISATEURS MOBILE =====
  
  async getAllMobileUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
        _count: {
          select: {
            orders: true,
            photoSubmissions: true,
            friends: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
  
  async deleteMobileUser(userId: string) {
    await this.prisma.orderItemAssignment.deleteMany({
      where: { userId },
    });
    
    const userOrders = await this.prisma.order.findMany({
      where: { userId },
      select: { id: true },
    });
    
    for (const order of userOrders) {
      await this.prisma.orderItemAssignment.deleteMany({
        where: {
          orderItem: {
            orderId: order.id,
          },
        },
      });
      
      await this.prisma.orderItem.deleteMany({
        where: { orderId: order.id },
      });
    }
    
    await this.prisma.order.deleteMany({
      where: { userId },
    });
    
    const userSubmissions = await this.prisma.photoSubmission.findMany({
      where: { userId },
      select: { id: true },
    });
    
    await this.prisma.photoSubmissionItem.deleteMany({
      where: {
        photoSubmissionId: {
          in: userSubmissions.map(s => s.id),
        },
      },
    });
    
    await this.prisma.photoSubmission.deleteMany({
      where: { userId },
    });
    
    await this.prisma.friend.deleteMany({
      where: { userId },
    });
    
    return this.prisma.user.delete({
      where: { id: userId },
    });
  }
}