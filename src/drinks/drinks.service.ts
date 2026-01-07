// apps/client-api/src/drinks/drinks.service.ts

import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DrinksService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId?: string) {
    console.log('🔍 findAll drinks, userId:', userId);

    const drinks = await this.prisma.drink.findMany({
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

  async addDrinkToMenu(barId: string, drinkId: string, price: number) {
    // Vérifier si le drink existe
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

  async removeDrinkFromMenu(barId: string, drinkId: string) {
    return this.prisma.menuDrink.delete({
      where: {
        barId_drinkId: {
          barId,
          drinkId,
        },
      },
    });
  }

  async getAllDrinksForSelection() {
    // Retourner tous les drinks pour la sélection dans le dashboard
    return this.prisma.drink.findMany({
      orderBy: {
        name: 'asc',
      },
    });
  }

  async createDrink(data: {
    name: string;
    type: 'SHOOTER' | 'COCKTAIL';
    alcoholLevel: number;
    ingredients: string[];
    description?: string;
    imageUrl: string;
  }) {
    return this.prisma.drink.create({
      data,
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
}