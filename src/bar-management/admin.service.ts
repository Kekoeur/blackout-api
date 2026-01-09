// apps/client-api/src/bar-management/admin.service.ts

import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  // =============== STATISTIQUES GLOBALES ===============

  async getGlobalStats() {
    const [
      totalBars,
      activeBars,
      totalUsers,
      totalOrders,
      totalRevenue,
      recentActivity,
    ] = await Promise.all([
      this.prisma.bar.count(),
      this.prisma.bar.count({ where: { active: true } }),
      this.prisma.barUser.count({ where: { isSuperAdmin: false } }),
      this.prisma.order.count({ where: { status: 'VALIDATED' } }),
      this.calculateTotalRevenue(),
      this.getRecentActivity(),
    ]);

    return {
      totalBars,
      activeBars,
      inactiveBars: totalBars - activeBars,
      totalUsers,
      totalOrders,
      totalRevenue,
      recentActivity,
    };
  }

  private async calculateTotalRevenue() {
    const validatedOrders = await this.prisma.order.findMany({
      where: { status: 'VALIDATED' },
      include: {
        items: {
          include: {
            drink: true,
          },
        },
      },
    });

    const menuDrinks = await this.prisma.menuDrink.findMany({
      select: {
        drinkId: true,
        price: true,
        barId: true,
      },
    });

    const priceMap = new Map<string, number>();
    menuDrinks.forEach((md) => {
      priceMap.set(`${md.barId}-${md.drinkId}`, md.price);
    });

    let totalRevenue = 0;
    for (const order of validatedOrders) {
      for (const item of order.items) {
        const price = priceMap.get(`${order.barId}-${item.drinkId}`) || 0;
        totalRevenue += price;
      }
    }

    return totalRevenue;
  }

  private async getRecentActivity() {
    const recentOrders = await this.prisma.order.findMany({
      where: { status: 'VALIDATED' },
      orderBy: { validatedAt: 'desc' },
      take: 5,
      include: {
        bar: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    return recentOrders.map((order) => ({
      type: 'order',
      id: order.id,
      bar: order.bar.name,
      user: order.user.username,
      createdAt: order.validatedAt,
    }));
  }

  // =============== GESTION DES BARS ===============

  async getAllBars() {
    return this.prisma.bar.findMany({
      include: {
        _count: {
          select: {
            orders: { where: { status: 'VALIDATED' } },
            photoSubmissions: true,
            menuDrinks: true,
            userAccess: true,
          },
        },
        userAccess: {
          where: { role: 'OWNER' },
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

  async getBarDetails(barId: string) {
    const bar = await this.prisma.bar.findUnique({
      where: { id: barId },
      include: {
        userAccess: {
          include: {
            barUser: {
              select: {
                id: true,
                name: true,
                email: true,
                isSuperAdmin: true,
              },
            },
          },
          orderBy: {
            role: 'desc',
          },
        },
        _count: {
          select: {
            orders: { where: { status: 'VALIDATED' } },
            photoSubmissions: true,
            menuDrinks: true,
            consumptions: true,
          },
        },
      },
    });

    if (!bar) {
      throw new BadRequestException('Bar not found');
    }

    // Calculer le revenu du bar
    const revenue = await this.calculateBarRevenue(barId);

    return {
      ...bar,
      revenue,
    };
  }

  private async calculateBarRevenue(barId: string) {
    const orders = await this.prisma.order.findMany({
      where: { barId, status: 'VALIDATED' },
      include: {
        items: true,
      },
    });

    const menuDrinks = await this.prisma.menuDrink.findMany({
      where: { barId },
      select: {
        drinkId: true,
        price: true,
      },
    });

    const priceMap = new Map<string, number>();
    menuDrinks.forEach((md) => {
      priceMap.set(md.drinkId, md.price);
    });

    let revenue = 0;
    for (const order of orders) {
      for (const item of order.items) {
        revenue += priceMap.get(item.drinkId) || 0;
      }
    }

    return revenue;
  }

  async toggleBarActive(barId: string) {
    const bar = await this.prisma.bar.findUnique({
      where: { id: barId },
      select: { active: true, name: true },
    });

    if (!bar) {
      throw new BadRequestException('Bar not found');
    }

    const updated = await this.prisma.bar.update({
      where: { id: barId },
      data: { active: !bar.active },
    });

    console.log(`✅ Bar "${bar.name}" ${updated.active ? 'activated' : 'deactivated'}`);

    return updated;
  }

  async deleteBar(barId: string) {
    const bar = await this.prisma.bar.findUnique({
      where: { id: barId },
      select: { name: true },
    });

    if (!bar) {
      throw new BadRequestException('Bar not found');
    }

    // Supprimer en cascade
    await this.prisma.$transaction([
      // 1. Supprimer les assignments
      this.prisma.orderItemAssignment.deleteMany({
        where: {
          orderItem: {
            order: {
              barId,
            },
          },
        },
      }),
      // 2. Supprimer les photo submission items
      this.prisma.photoSubmissionItem.deleteMany({
        where: {
          photoSubmission: {
            barId,
          },
        },
      }),
      // 3. Supprimer les order items
      this.prisma.orderItem.deleteMany({
        where: {
          order: {
            barId,
          },
        },
      }),
      // 4. Supprimer les consumptions
      this.prisma.consumption.deleteMany({
        where: { barId },
      }),
      // 5. Supprimer les orders
      this.prisma.order.deleteMany({
        where: { barId },
      }),
      // 6. Supprimer les photo submissions
      this.prisma.photoSubmission.deleteMany({
        where: { barId },
      }),
      // 7. Supprimer le menu
      this.prisma.menuDrink.deleteMany({
        where: { barId },
      }),
      // 8. Supprimer les invitations
      this.prisma.invitationToken.deleteMany({
        where: { barId },
      }),
      // 9. Supprimer les accès utilisateurs
      this.prisma.barUserAccess.deleteMany({
        where: { barId },
      }),
      // 10. Supprimer le bar
      this.prisma.bar.delete({
        where: { id: barId },
      }),
    ]);

    console.log(`🗑️ Bar "${bar.name}" and all related data deleted`);

    return { success: true, message: `Bar "${bar.name}" deleted` };
  }

  // =============== GESTION DES UTILISATEURS ===============

  async getAllUsers() {
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
                active: true,
              },
            },
          },
          orderBy: {
            role: 'desc',
          },
        },
        _count: {
          select: {
            barAccess: true,
            createdDrinks: true,
          },
        },
      },
      orderBy: [
        { isSuperAdmin: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async getUserDetails(userId: string) {
    const user = await this.prisma.barUser.findUnique({
      where: { id: userId },
      include: {
        barAccess: {
          include: {
            bar: {
              select: {
                id: true,
                name: true,
                city: true,
                active: true,
              },
            },
          },
        },
        createdDrinks: {
          select: {
            id: true,
            name: true,
            type: true,
            barId: true,
          },
        },
        _count: {
          select: {
            barAccess: true,
            createdDrinks: true,
          },
        },
      },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    return user;
  }

  async createOwner(email: string, name: string, password: string) {
    const existing = await this.prisma.barUser.findUnique({
      where: { email },
    });

    if (existing) {
      throw new BadRequestException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.prisma.barUser.create({
      data: {
        email,
        name,
        password: hashedPassword,
        isSuperAdmin: false,
      },
    });

    console.log(`✅ Owner created: ${email}`);

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }

  async promoteToOwner(userId: string, barId: string) {
    // Vérifier que le user existe
    const user = await this.prisma.barUser.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Vérifier que le bar existe
    const bar = await this.prisma.bar.findUnique({
      where: { id: barId },
    });

    if (!bar) {
      throw new BadRequestException('Bar not found');
    }

    // Vérifier si l'utilisateur a déjà un accès
    const existingAccess = await this.prisma.barUserAccess.findUnique({
      where: {
        barUserId_barId: {
          barUserId: userId,
          barId,
        },
      },
    });

    if (existingAccess) {
      // Mettre à jour le rôle
      await this.prisma.barUserAccess.update({
        where: {
          barUserId_barId: {
            barUserId: userId,
            barId,
          },
        },
        data: {
          role: 'OWNER',
        },
      });
    } else {
      // Créer un nouvel accès
      await this.prisma.barUserAccess.create({
        data: {
          barUserId: userId,
          barId,
          role: 'OWNER',
        },
      });
    }

    console.log(`✅ User ${user.email} promoted to OWNER of bar ${bar.name}`);

    return { success: true };
  }

  async updateUser(userId: string, data: { name?: string; email?: string }) {
    const user = await this.prisma.barUser.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Vérifier si l'email existe déjà
    if (data.email && data.email !== user.email) {
      const existing = await this.prisma.barUser.findUnique({
        where: { email: data.email },
      });

      if (existing) {
        throw new BadRequestException('Email already in use');
      }
    }

    return this.prisma.barUser.update({
      where: { id: userId },
      data,
    });
  }

  async deleteUser(userId: string) {
    const user = await this.prisma.barUser.findUnique({
      where: { id: userId },
      select: { email: true, isSuperAdmin: true },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.isSuperAdmin) {
      throw new ForbiddenException('Cannot delete super admin');
    }

    // Supprimer les accès du user
    await this.prisma.barUserAccess.deleteMany({
      where: { barUserId: userId },
    });

    // Supprimer le user
    await this.prisma.barUser.delete({
      where: { id: userId },
    });

    console.log(`🗑️ User ${user.email} deleted`);

    return { success: true };
  }

  async sendPasswordResetEmail(userId: string) {
    const user = await this.prisma.barUser.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Générer un token de réinitialisation
    const resetToken = Math.random().toString(36).substring(2, 15) +
                       Math.random().toString(36).substring(2, 15);
    const resetExpiry = new Date(Date.now() + 3600000); // 1h

    // Stocker le token
    await this.prisma.barUser.update({
      where: { id: userId },
      data: {
        resetToken,
        resetTokenExpiry: resetExpiry,
      },
    });

    // TODO: Envoyer l'email avec Nodemailer
    console.log(`📧 Password reset email would be sent to ${user.email}`);
    console.log(`🔗 Reset link: ${process.env.DASHBOARD_URL || 'http://localhost:3001'}/reset-password?token=${resetToken}`);

    return {
      success: true,
      message: 'Password reset email sent',
      // En dev, retourner le token
      ...(process.env.NODE_ENV === 'development' && { resetToken }),
    };
  }

  async changeUserRole(userId: string, barId: string, newRole: 'OWNER' | 'MANAGER' | 'STAFF' | 'VIEWER') {
    const access = await this.prisma.barUserAccess.findUnique({
      where: {
        barUserId_barId: {
          barUserId: userId,
          barId,
        },
      },
    });

    if (!access) {
      throw new BadRequestException('User does not have access to this bar');
    }

    return this.prisma.barUserAccess.update({
      where: {
        barUserId_barId: {
          barUserId: userId,
          barId,
        },
      },
      data: {
        role: newRole,
      },
    });
  }
}