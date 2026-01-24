// apps/client-api/src/admin/admin.service.ts

import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

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
        nsfwFlagCount: true,
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
  
  async resetUserNsfwFlag(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { nsfwFlagCount: 0 },
    });

    return { success: true, message: 'NSFW flag count reset to 0' };
  }

  async deleteMobileUser(userId: string) {
    // 1. Delete Consumptions (references User, Order, Bar, Drink)
    await this.prisma.consumption.deleteMany({
      where: { userId },
    });

    // 2. Delete Ratings (references User and Drink)
    await this.prisma.rating.deleteMany({
      where: { userId },
    });

    // 3. Delete OrderItemAssignments where user is assigned
    await this.prisma.orderItemAssignment.deleteMany({
      where: { userId },
    });

    // 4. Delete Orders and their items
    const userOrders = await this.prisma.order.findMany({
      where: { userId },
      select: { id: true },
    });

    for (const order of userOrders) {
      // Delete OrderItemAssignments for this order
      await this.prisma.orderItemAssignment.deleteMany({
        where: {
          orderItem: {
            orderId: order.id,
          },
        },
      });

      // Delete OrderItems
      await this.prisma.orderItem.deleteMany({
        where: { orderId: order.id },
      });
    }

    // Delete the orders themselves
    await this.prisma.order.deleteMany({
      where: { userId },
    });

    // 5. Delete PhotoSubmissions and their items
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

    // 6. Delete Friends
    await this.prisma.friend.deleteMany({
      where: { userId },
    });

    // 7. Finally delete the User
    return this.prisma.user.delete({
      where: { id: userId },
    });
  }

  // ===== DELETE ALL ORDERS =====

  async deleteAllOrders() {
    // Delete in correct order to respect foreign keys
    await this.prisma.consumption.deleteMany({});
    await this.prisma.orderItemAssignment.deleteMany({});
    await this.prisma.orderItem.deleteMany({});
    await this.prisma.order.deleteMany({});

    return {
      message: 'All orders and related data deleted successfully',
      success: true,
    };
  }

  // ===== PHOTO SUBMISSIONS =====

  async getAllPhotoSubmissions(status?: string) {
    return this.prisma.photoSubmission.findMany({
      ...(status ? { where: { status: status as any } } : {}),
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            nsfwFlagCount: true,
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
            friend: {
              select: {
                name: true,
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

  async deletePhotoSubmission(submissionId: string) {
    // Get the photo submission first to find associated order
    const submission = await this.prisma.photoSubmission.findUnique({
      where: { id: submissionId },
    });

    if (!submission) {
      throw new Error('Photo submission not found');
    }

    // Try to find and delete associated QR code order
    // Orders are linked by userId, barId, and similar timestamp
    const relatedOrder = await this.prisma.order.findFirst({
      where: {
        userId: submission.userId,
        barId: submission.barId,
        photoUrl: { not: null }, // Only QR code orders
        // Find order created within 5 minutes of photo submission
        createdAt: {
          gte: new Date(new Date(submission.createdAt).getTime() - 5 * 60 * 1000),
          lte: new Date(new Date(submission.createdAt).getTime() + 5 * 60 * 1000),
        },
      },
    });

    // If there's a related order, delete it first (with cascade)
    if (relatedOrder) {
      await this.deleteOrder(relatedOrder.id);
    }

    // Delete photo submission items
    await this.prisma.photoSubmissionItem.deleteMany({
      where: { photoSubmissionId: submissionId },
    });

    // Finally delete the photo submission
    return this.prisma.photoSubmission.delete({
      where: { id: submissionId },
    });
  }

  async deleteAllPhotoSubmissions() {
    // Delete items first (foreign key constraint)
    await this.prisma.photoSubmissionItem.deleteMany({});
    await this.prisma.photoSubmission.deleteMany({});

    return {
      message: 'All photo submissions deleted successfully',
      success: true,
    };
  }

  // ===== CLEANUP TEST DATA =====

  async cleanupTestData() {
    // Delete all orders, photo submissions, and related data
    // This is useful for cleaning up test data during development

    // Delete consumptions (references orders)
    await this.prisma.consumption.deleteMany({});

    // Delete order item assignments
    await this.prisma.orderItemAssignment.deleteMany({});

    // Delete order items
    await this.prisma.orderItem.deleteMany({});

    // Delete orders
    const deletedOrders = await this.prisma.order.deleteMany({});

    // Delete photo submission items
    await this.prisma.photoSubmissionItem.deleteMany({});

    // Delete photo submissions
    const deletedSubmissions = await this.prisma.photoSubmission.deleteMany({});

    return {
      message: 'Test data cleanup completed successfully',
      success: true,
      deleted: {
        orders: deletedOrders.count,
        photoSubmissions: deletedSubmissions.count,
      },
    };
  }

  // ===== FRIENDS (GUESTS) =====

  async getAllFriends() {
    const friends = await this.prisma.friend.findMany({
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        linkedUser: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        _count: {
          select: {
            orderItemAssignments: true,
            photoSubmissionItems: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Transform to match Guest interface expected by frontend
    return friends.map(friend => ({
      id: friend.id,
      firstName: friend.name.split(' ')[0] || friend.name,
      lastName: friend.name.split(' ').slice(1).join(' ') || '',
      email: friend.linkedUser?.email || null,
      phone: null,
      attending: true, // Friends are always "attending" in this context
      plusOne: false,
      dietaryRestrictions: null,
      message: friend.linkedUser ? `Linked to ${friend.linkedUser.username}` : 'Not linked',
      createdAt: friend.createdAt.toISOString(),
      // Additional fields for context
      userId: friend.userId,
      linkedUserId: friend.linkedUserId,
      orderCount: friend._count.orderItemAssignments,
      photoCount: friend._count.photoSubmissionItems,
    }));
  }

  async deleteFriend(friendId: string) {
    // Delete assignments and items first
    await this.prisma.orderItemAssignment.deleteMany({
      where: { friendId },
    });

    await this.prisma.photoSubmissionItem.deleteMany({
      where: { friendId },
    });

    // Delete the friend
    return this.prisma.friend.delete({
      where: { id: friendId },
    });
  }

  // ===== BAR USERS =====

  async getAllBarUsers() {
    return this.prisma.barUser.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        isSuperAdmin: true,
        createdAt: true,
        barAccess: {
          include: {
            bar: {
              select: {
                id: true,
                name: true,
                city: true,
              },
            },
          },
        },
        _count: {
          select: {
            createdDrinks: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async createBarUser(data: {
    email: string;
    password: string;
    name: string;
    barId?: string;
    role?: string;
  }) {
    // Check if email already exists
    const existing = await this.prisma.barUser.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      throw new BadRequestException('Un utilisateur avec cet email existe déjà');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Create the bar user
    const barUser = await this.prisma.barUser.create({
      data: {
        email: data.email,
        password: hashedPassword,
        name: data.name,
      },
    });

    // If a barId is provided, create bar access
    if (data.barId) {
      await this.prisma.barUserAccess.create({
        data: {
          barUserId: barUser.id,
          barId: data.barId,
          role: (data.role as any) || 'STAFF',
        },
      });
    }

    return {
      id: barUser.id,
      email: barUser.email,
      name: barUser.name,
      createdAt: barUser.createdAt,
    };
  }

  async deleteBarUser(userId: string) {
    // Delete bar access records
    await this.prisma.barUserAccess.deleteMany({
      where: { barUserId: userId },
    });

    // Delete invitation tokens created by this user (if we track that)
    // Note: InvitationToken has createdBy as String, need to check if it's the userId
    // For now, skip this as it might not be necessary

    // Delete the bar user
    return this.prisma.barUser.delete({
      where: { id: userId },
    });
  }

  // ===== BARS =====

  async getAllBars() {
    return this.prisma.bar.findMany({
      select: {
        id: true,
        name: true,
        city: true,
        address: true,
        active: true,
        createdAt: true,
        _count: {
          select: {
            orders: true,
            photoSubmissions: true,
            consumptions: true,
            menuDrinks: true,
          },
        },
        userAccess: {
          include: {
            barUser: {
              select: {
                id: true,
                name: true,
                email: true,
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

  async deleteBar(barId: string) {
    // Delete all related data in correct order

    // 1. Delete consumptions
    await this.prisma.consumption.deleteMany({
      where: { barId },
    });

    // 2. Delete photo submission items, then submissions
    const barSubmissions = await this.prisma.photoSubmission.findMany({
      where: { barId },
      select: { id: true },
    });

    await this.prisma.photoSubmissionItem.deleteMany({
      where: {
        photoSubmissionId: {
          in: barSubmissions.map(s => s.id),
        },
      },
    });

    await this.prisma.photoSubmission.deleteMany({
      where: { barId },
    });

    // 3. Delete orders and their items
    const barOrders = await this.prisma.order.findMany({
      where: { barId },
      select: { id: true },
    });

    for (const order of barOrders) {
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
      where: { barId },
    });

    // 4. Delete menu drinks
    await this.prisma.menuDrink.deleteMany({
      where: { barId },
    });

    // 5. Delete drinks created by this bar
    await this.prisma.drink.deleteMany({
      where: { barId },
    });

    // 6. Delete bar user access
    await this.prisma.barUserAccess.deleteMany({
      where: { barId },
    });

    // 7. Delete invitation tokens
    await this.prisma.invitationToken.deleteMany({
      where: { barId },
    });

    // 8. Finally delete the bar
    return this.prisma.bar.delete({
      where: { id: barId },
    });
  }
}