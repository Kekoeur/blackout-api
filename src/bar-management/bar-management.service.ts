// apps/client-api/src/bar-management/bar-management.service.ts

import { Injectable, UnauthorizedException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { InvitationService } from './invitation.service';

@Injectable()
export class BarManagementService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private invitationService: InvitationService
  ) {}

  // ⭐ AUTHENTIFICATION
  async login(email: string, password: string) {
    const barUser = await this.prisma.barUser.findUnique({
      where: { email },
      include: {
        barAccess: {
          include: {
            bar: true,
          },
        },
      },
    });

    if (!barUser || !(await bcrypt.compare(password, barUser.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.jwt.sign({
      sub: barUser.id,
      email: barUser.email,
      type: 'bar-dashboard',
    });

    return {
      token,
      user: {
        id: barUser.id,
        email: barUser.email,
        name: barUser.name,
        isSuperAdmin: barUser.isSuperAdmin,
        bars: barUser.barAccess.map(access => ({
          id: access.bar.id,
          name: access.bar.name,
          role: access.role,
        })),
      },
    };
  }

  async register(email: string, password: string, name: string) {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const barUser = await this.prisma.barUser.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
    });

    const token = this.jwt.sign({
      sub: barUser.id,
      email: barUser.email,
      type: 'bar-dashboard',
    });

    return {
      token,
      user: {
        id: barUser.id,
        email: barUser.email,
        name: barUser.name,
        bars: [],
      },
    };
  }

  // ⭐ GESTION DES BARS
  async createBar(userId: string, data: {
    name: string;
    city: string;
    address: string;
  }) {
    // Générer API Key et QR Code
    const apiKey = `bar_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const qrCode = JSON.stringify({ type: 'bar', barId: 'TEMP' });

    const bar = await this.prisma.bar.create({
      data: {
        name: data.name,
        city: data.city,
        address: data.address,
        apiKey,
        qrCode,
        ownerId: userId,
        userAccess: {
          create: {
            barUserId: userId,
            role: 'OWNER', // Créateur = Owner automatiquement
          },
        },
      },
    });

    // Mettre à jour le QR Code avec le vrai ID
    const updatedBar = await this.prisma.bar.update({
      where: { id: bar.id },
      data: {
        qrCode: JSON.stringify({ type: 'bar', barId: bar.id }),
      },
    });

    return updatedBar;
  }

  async getMyBars(userId: string) {
    const access = await this.prisma.barUserAccess.findMany({
      where: { barUserId: userId },
      include: {
        bar: {
          include: {
            _count: {
              select: {
                orders: true,
                photoSubmissions: { where: { status: 'PENDING' } },
              },
            },
          },
        },
      },
    });

    return access.map(a => ({
      id: a.bar.id,
      name: a.bar.name,
      city: a.bar.city,
      address: a.bar.address,
      role: a.role,
      pendingOrders: a.bar._count.orders,
      pendingPhotos: a.bar._count.photoSubmissions,
      active: a.bar.active,
    }));
  }

  // ⭐ VÉRIFICATION DES PERMISSIONS
  async checkPermission(userId: string, barId: string, requiredRole?: string) {
    const access = await this.prisma.barUserAccess.findUnique({
      where: {
        barUserId_barId: {
          barUserId: userId,
          barId,
        },
      },
    });

    if (!access) {
      throw new ForbiddenException('No access to this bar');
    }

    // Hiérarchie des rôles
    const roleHierarchy = {
      OWNER: 4,
      MANAGER: 3,
      STAFF: 2,
      VIEWER: 1,
    };

    if (requiredRole && roleHierarchy[access.role] < roleHierarchy[requiredRole]) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return access;
  }

  // ⭐ GESTION DES UTILISATEURS DU BAR
  async inviteUser(ownerId: string, barId: string, email: string, role: string) {
    // Vérifier que l'inviteur est OWNER
    await this.checkPermission(ownerId, barId, 'OWNER');

    // Trouver ou créer l'utilisateur
    let targetUser = await this.prisma.barUser.findUnique({
      where: { email },
    });

    if (!targetUser) {
      // Créer un compte temporaire
      const tempPassword = Math.random().toString(36).substring(7);
      targetUser = await this.prisma.barUser.create({
        data: {
          email,
          password: await bcrypt.hash(tempPassword, 10),
          name: email.split('@')[0],
        },
      });

      // TODO: Envoyer un email avec le mot de passe temporaire
    }

    // Ajouter l'accès
    await this.prisma.barUserAccess.create({
      data: {
        barUserId: targetUser.id,
        barId,
        role: role as any,
      },
    });

    return { success: true, email };
  }

  // ⭐ STATISTIQUES DU BAR
  async getBarStats(userId: string, barId: string) {
    await this.checkPermission(userId, barId, 'VIEWER');

    // ⭐ NOUVEAU : Calculer le revenu réel
    const validatedOrders = await this.prisma.order.findMany({
      where: { 
        barId, 
        status: 'VALIDATED' 
      },
      include: {
        items: {
          include: {
            drink: true, // Pour avoir le drinkId
          },
        },
      },
    });

    // Récupérer tous les prix des drinks du menu de ce bar
    const menuDrinks = await this.prisma.menuDrink.findMany({
      where: { barId },
      select: {
        drinkId: true,
        price: true,
      },
    });

    // Créer un map pour accès rapide aux prix
    const priceMap = new Map<string, number>();
    menuDrinks.forEach(md => {
      priceMap.set(md.drinkId, md.price);
    });

    // Calculer le revenu total
    let totalRevenue = 0;
    for (const order of validatedOrders) {
      for (const item of order.items) {
        const price = priceMap.get(item.drinkId) || 0; // Prix du shooter dans le menu
        totalRevenue += price; // Ajouter le prix (chaque item = 1 shooter)
      }
    }

    const [
      totalOrders,
      pendingOrders,
      pendingPhotos,
      topDrinks,
    ] = await Promise.all([
      this.prisma.order.count({ where: { barId, status: 'VALIDATED' } }),
      this.prisma.order.count({ where: { barId, status: 'PENDING' } }),
      this.prisma.photoSubmission.count({ where: { barId, status: 'PENDING' } }),
      this.prisma.orderItem.groupBy({
        by: ['drinkId'],
        where: {
          order: {
            barId,
            status: 'VALIDATED',
          },
        },
        _count: true,
        orderBy: {
          _count: {
            drinkId: 'desc',
          },
        },
        take: 5,
      }),
    ]);

    // ⭐ Enrichir les topDrinks avec le nom du shooter
    const topDrinksWithNames = await Promise.all(
      topDrinks.map(async (item) => {
        const drink = await this.prisma.drink.findUnique({
          where: { id: item.drinkId },
          select: {
            id: true,
            name: true,
            imageUrl: true,
          },
        });
        
        return {
          drinkId: item.drinkId,
          drinkName: drink?.name || 'Unknown',
          drinkImage: drink?.imageUrl || '',
          count: item._count,
        };
      })
    );

    return {
      totalOrders,
      totalRevenue, // ⭐ Revenu réel calculé
      pendingOrders,
      pendingPhotos,
      topDrinks: topDrinksWithNames, // ⭐ Avec les noms des drinks
    };
  }

  // apps/client-api/src/bar-management/bar-management.service.ts

  async registerWithInvitation(token: string, name: string, password: string) {
    // Vérifier le token
    const invitation = await this.invitationService.verifyInvitation(token);

    const hashedPassword = await bcrypt.hash(password, 10);

    // Créer l'utilisateur
    const user = await this.prisma.barUser.create({
      data: {
        email: invitation.email,
        name,
        password: hashedPassword,
        isSuperAdmin: false,
      },
    });

    // Utiliser l'invitation
    await this.invitationService.useInvitation(token, user.id);

    // Générer le JWT
    const jwtToken = this.jwt.sign({
      sub: user.id,
      email: user.email,
      type: 'bar-dashboard',
    });

    return {
      token: jwtToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        bars: [
          {
            id: invitation.barId,
            name: invitation.barName,
            role: invitation.role,
          },
        ],
      },
    };
  }

  async getBarMembers(userId: string, barId: string) {
    // Vérifier que le user est OWNER
    await this.checkPermission(userId, barId, 'OWNER');

    return this.prisma.barUserAccess.findMany({
      where: { barId },
      include: {
        barUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [
        { role: 'desc' },
        { createdAt: 'asc' },
      ],
    });
  }

  async getBarInvitations(userId: string, barId: string) {
    // Vérifier que le user est OWNER
    await this.checkPermission(userId, barId, 'OWNER');

    return this.prisma.invitationToken.findMany({
      where: {
        barId,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async removeMember(ownerId: string, barId: string, userId: string) {
    // Vérifier que le owner a les permissions
    await this.checkPermission(ownerId, barId, 'OWNER');

    // Ne pas permettre de supprimer un OWNER
    const targetAccess = await this.prisma.barUserAccess.findUnique({
      where: {
        barUserId_barId: {
          barUserId: userId,
          barId,
        },
      },
    });

    if (targetAccess?.role === 'OWNER') {
      throw new ForbiddenException('Cannot remove owner');
    }

    return this.prisma.barUserAccess.delete({
      where: {
        barUserId_barId: {
          barUserId: userId,
          barId,
        },
      },
    });
  }

  async getBarTeam(barId: string) {
    return this.prisma.barUserAccess.findMany({
      where: { barId },
      include: {
        barUser: {
          select: {
            id: true,
            email: true,
            name: true,
            createdAt: true,
            _count: {
              select: {
                createdDrinks: true,
              },
            },
          },
        },
      },
      orderBy: [
        { role: 'desc' },
        { createdAt: 'asc' },
      ],
    });
  }

  async changeUserRole(
    userId: string,
    barId: string,
    newRole: 'VIEWER' | 'STAFF' | 'MANAGER',
  ) {
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

    if (access.role === 'OWNER') {
      throw new ForbiddenException('Cannot change owner role');
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

  async removeUserFromBar(userId: string, barId: string) {
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

    if (access.role === 'OWNER') {
      throw new ForbiddenException('Cannot remove owner from bar');
    }

    await this.prisma.barUserAccess.delete({
      where: {
        barUserId_barId: {
          barUserId: userId,
          barId,
        },
      },
    });

    return { success: true };
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.prisma.barUser.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: {
          gte: new Date(),
        },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const bcrypt = await import('bcrypt');
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.barUser.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    console.log(`✅ Password reset for ${user.email}`);

    return { success: true };
  }

  async activateBar(userId: string, barId: string) {
    // Vérifier que l'utilisateur est OWNER du bar
    const access = await this.prisma.barUserAccess.findUnique({
      where: {
        barUserId_barId: {
          barUserId: userId,
          barId,
        },
      },
    });

    if (!access || access.role !== 'OWNER') {
      throw new ForbiddenException('Only bar owners can activate their bar');
    }

    // Activer le bar
    const bar = await this.prisma.bar.update({
      where: { id: barId },
      data: { active: true },
    });

    console.log(`✅ Bar "${bar.name}" activated by owner ${userId}`);

    return {
      success: true,
      bar: {
        id: bar.id,
        name: bar.name,
        active: bar.active,
      },
    };
  }
}