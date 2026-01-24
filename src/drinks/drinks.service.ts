// apps/client-api/src/drinks/drinks.service.ts

import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DrinksService {
  constructor(private prisma: PrismaService) {}

  private async checkPermission(
    barUserId: string,
    barId: string,
    minRole: 'VIEWER' | 'STAFF' | 'MANAGER' | 'OWNER',
  ) {
    const access = await this.prisma.barUserAccess.findUnique({
      where: {
        barUserId_barId: {
          barUserId,
          barId,
        },
      },
    });

    if (!access) {
      throw new ForbiddenException('No access to this bar');
    }

    // Hiérarchie des rôles
    const roleHierarchy = {
      VIEWER: 0,
      STAFF: 1,
      MANAGER: 2,
      OWNER: 3,
    };

    const userRoleLevel = roleHierarchy[access.role];
    const minRoleLevel = roleHierarchy[minRole];

    if (userRoleLevel < minRoleLevel) {
      throw new ForbiddenException(
        `This action requires at least ${minRole} role`,
      );
    }

    return access;
  }

  async findAll(userId?: string) {
    console.log('🔍 findAll drinks, userId:', userId);

    const drinks = await this.prisma.drink.findMany({
      include: {
        bar: {
          select: {
            id: true,
            name: true,
            city: true,
            address: true,
          },
        },
        // ⭐ AJOUTER : Note de l'utilisateur
        ratings: userId ? {
          where: { userId },
          select: {
            id: true,
            rating: true,
            comment: true,
            createdAt: true,
          },
        } : false,
        // Vérifier si testé
        ...(userId ? {
          _count: {
            select: {
              orderItems: {
                where: {
                  order: {
                    status: 'VALIDATED',
                  },
                  assignments: {
                    some: {
                      OR: [
                        { userId, friendId: null }, // Assigné à moi-même directement
                        {
                          friend: {
                            linkedUserId: userId, // Assigné à un ami qui est lié à mon compte
                          },
                        },
                      ],
                    },
                  },
                },
              },
            },
          },
        } : {}),
      },
    });

    const result = drinks.map(drink => ({
      ...drink,
      isTested: userId ? (drink._count?.orderItems || 0) > 0 : false,
      myRating: userId && drink.ratings && drink.ratings[0] ? drink.ratings[0] : null, // ⭐ AJOUTER
      ratings: undefined, // Ne pas renvoyer le tableau
    }));

    console.log('📊 Drinks:', result.length, '- Tested:', result.filter(d => d.isTested).length);
    
    return result;
  }

  async findOne(id: string, userId?: string) {
    const drink = await this.prisma.drink.findUnique({
      where: { id },
      include: {
        ratings: {
          include: {
            user: {
              select: { username: true, avatar: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        consumptions: userId ? {
          where: { userId },
        } : false,
        _count: {
          select: { ratings: true, consumptions: true },
        },
      },
    });

    if (!drink) return null;

    return {
      ...drink,
      isTested: userId ? drink.consumptions.length > 0 : false,
      avgRating: await this.calculateAvgRating(id),
    };
  }

  async findByBar(barId: string, userId?: string) {
    console.log('🔍 findByBar:', barId, ', userId:', userId);
    
    const menuDrinks = await this.prisma.menuDrink.findMany({
      where: { barId, available: true },
      include: {
        drink: {
          include: {
            // ⭐ AJOUTER : Note de l'utilisateur
            ratings: userId ? {
              where: { userId },
              select: { 
                id: true,
                rating: true, 
                comment: true,
                createdAt: true,
              },
            } : false,
            ...(userId ? {
              _count: {
                select: {
                  orderItems: {
                    where: {
                      order: {
                        status: 'VALIDATED',
                      },
                      assignments: {
                        some: {
                          OR: [
                            { userId, friendId: null }, // Assigné à moi-même
                            { 
                              friend: {
                                linkedUserId: userId, // Assigné à un ami lié
                              },
                            },
                          ],
                        },
                      },
                    },
                  },
                },
              },
            } : {}),
          },
        },
      },
    });

    const result = menuDrinks.map(md => ({
      ...md.drink,
      price: md.price,
      isTested: userId ? (md.drink._count?.orderItems || 0) > 0 : false,
      myRating: userId && md.drink.ratings && md.drink.ratings[0] ? md.drink.ratings[0] : null, // ⭐ AJOUTER
      ratings: undefined, // Ne pas renvoyer le tableau
    }));

    console.log('📊 Bar drinks:', result.length, '- Tested:', result.filter(d => d.isTested).length);

    return result;
  }

  private async calculateAvgRating(drinkId: string): Promise<number | null> {
    const result = await this.prisma.rating.aggregate({
      where: { drinkId },
      _avg: { rating: true },
    });

    return result._avg.rating;
  }

  async getBarMenu(barId: string) {
    return this.prisma.menuDrink.findMany({
      where: { barId },
      include: {
        drink: true,
      },
      orderBy: {
        drink: {
          name: 'asc',
        },
      },
    });
  }

  async addDrinksToMenuBulk(
    barUserId: string,
    barId: string,
    drinks: Array<{ drinkId: string; price: number }>,
  ) {
    // Vérifier que l'utilisateur a accès au bar
    await this.checkPermission(barUserId, barId, 'MANAGER');

    // Vérifier que les drinks existent
    const drinkIds = drinks.map(d => d.drinkId);
    const existingDrinks = await this.prisma.drink.findMany({
      where: { id: { in: drinkIds } },
      select: { id: true },
    });

    if (existingDrinks.length !== drinkIds.length) {
      throw new BadRequestException('Some drinks do not exist');
    }

    // Vérifier qu'ils ne sont pas déjà dans le menu
    const existingMenuDrinks = await this.prisma.menuDrink.findMany({
      where: {
        barId,
        drinkId: { in: drinkIds },
      },
    });

    if (existingMenuDrinks.length > 0) {
      throw new BadRequestException('Some drinks are already in the menu');
    }

    // Ajouter tous les drinks au menu
    const menuDrinks = await this.prisma.$transaction(
      drinks.map(drink => 
        this.prisma.menuDrink.create({
          data: {
            barId,
            drinkId: drink.drinkId,
            price: drink.price,
            available: true,
          },
        })
      )
    );

    console.log(`✅ Added ${menuDrinks.length} drinks to menu of bar ${barId}`);

    return {
      success: true,
      added: menuDrinks.length,
    };
  }

  async addDrinkToMenu(barUserId: string, barId: string, drinkId: string, price: number) {
    // Vérifier si le drink existe
    await this.checkPermission(barUserId, barId, 'MANAGER');

    const drink = await this.prisma.drink.findUnique({
      where: { id: drinkId },
    });

    if (!drink) {
      throw new BadRequestException('Drink not found');
    }

    // Vérifier si déjà dans le menu
    const existing = await this.prisma.menuDrink.findUnique({
      where: {
        barId_drinkId: {
          barId,
          drinkId,
        },
      },
    });

    if (existing) {
      throw new BadRequestException('Drink already in menu');
    }

    return this.prisma.menuDrink.create({
      data: {
        barId,
        drinkId,
        price,
        available: true,
      },
      include: {
        drink: true,
      },
    });
  }

  async updateMenuDrink(barId: string, drinkId: string, data: {
    price?: number;
    available?: boolean;
  }) {
    return this.prisma.menuDrink.update({
      where: {
        barId_drinkId: {
          barId,
          drinkId,
        },
      },
      data,
      include: {
        drink: true,
      },
    });
  }

  async removeDrinkFromMenu(barUserId: string, barId: string, drinkId: string) {
    await this.checkPermission(barUserId, barId, 'MANAGER');
    
    return this.prisma.menuDrink.delete({
      where: {
        barId_drinkId: {
          barId,
          drinkId,
        },
      },
    });
  }

  async getAllDrinksForSelection(barUserId: string, barId: string) {
    // Retourner tous les drinks pour la sélection dans le dashboard
    const access = await this.prisma.barUserAccess.findUnique({
      where: {
        barUserId_barId: {
          barUserId,
          barId,
        },
      },
    });

    if (!access) {
      throw new ForbiddenException('No access to this bar');
    }
    
    return this.prisma.drink.findMany({
      where: {
        OR: [
          { isPublic: true },
          { barId }
        ],
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async createDrink(barUserId: string, barId: string, data: {
    name: string;
    type: 'SHOOTER' | 'COCKTAIL';
    alcoholLevel?: number;
    ingredients?: string[];
    description?: string;
    imageUrl: string;
    isPublic?: boolean;
  }) {
    // Vérifier si le barUser existe avant de l'utiliser comme createdBy
    const barUserExists = await this.prisma.barUser.findUnique({
      where: { id: barUserId },
      select: { id: true },
    });

    return this.prisma.drink.create({
      data: {
        name: data.name,
        type: data.type,
        alcoholLevel: data.alcoholLevel ?? null,           // null pour la DB
        ingredients: data.ingredients ?? [],               // [] pour la DB
        description: data.description ?? null,
        imageUrl: data.imageUrl,
        createdBy: barUserExists ? barUserId : null,       // null si l'utilisateur n'existe pas
        barId,
        isPublic: data.isPublic || false,
      }
    });
  }

  async deleteDrink(id: string) {
    // Vérifier si le drink est utilisé dans des menus
    const menuCount = await this.prisma.menuDrink.count({
      where: { drinkId: id },
    });

    if (menuCount > 0) {
      throw new BadRequestException(
        'Cannot delete drink: it is currently in use in bar menus'
      );
    }

    return this.prisma.drink.delete({
      where: { id },
    });
  }

  async getAllDrinksForUser(barUserId: string) {
    // Récupérer tous les bars de l'utilisateur
    const userBars = await this.prisma.barUserAccess.findMany({
      where: { barUserId },
      select: { barId: true },
    });

    const barIds = userBars.map(access => access.barId);

    // Retourner les drinks publics + drinks de tous les bars de l'user
    return this.prisma.drink.findMany({
      where: {
        OR: [
          { isPublic: true },
          { barId: { in: barIds } },
        ],
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async updateDrink(
    barUserId: string,
    drinkId: string,
    data: {
      name?: string;
      type?: 'SHOOTER' | 'COCKTAIL';
      alcoholLevel?: number;
      ingredients?: string[];
      description?: string;
      imageUrl?: string;
    },
  ) {
    // Vérifier que le drink existe
    const drink = await this.prisma.drink.findUnique({
      where: { id: drinkId },
    });

    if (!drink) {
      throw new BadRequestException('Drink not found');
    }

    // Vérifier que l'utilisateur a créé ce drink OU a accès au bar
    const hasAccess = drink.createdBy === barUserId || 
      (drink.barId && await this.prisma.barUserAccess.findFirst({
        where: {
          barUserId,
          barId: drink.barId,
          role: { in: ['OWNER', 'MANAGER'] }, // Seuls OWNER et MANAGER peuvent modifier
        },
      }));

    if (!hasAccess) {
      throw new ForbiddenException('You do not have permission to update this drink');
    }

    // Mettre à jour le drink
    return this.prisma.drink.update({
      where: { id: drinkId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.type && { type: data.type }),
        ...(data.alcoholLevel !== undefined && { alcoholLevel: data.alcoholLevel }),
        ...(data.ingredients !== undefined && { ingredients: data.ingredients }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.imageUrl && { imageUrl: data.imageUrl }),
      },
    });
  }
}