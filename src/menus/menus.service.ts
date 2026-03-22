import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMenuDto, UpdateMenuDto, MenuConditionDto, AddMenuItemDto } from './dto/create-menu.dto';

@Injectable()
export class MenusService {
  constructor(private prisma: PrismaService) {}

  async findByBar(barId: string) {
    return this.prisma.menu.findMany({
      where: { barId },
      include: {
        conditions: true,
        items: {
          include: {
            menuDrink: {
              include: { drink: true },
            },
          },
          orderBy: { displayOrder: 'asc' },
        },
      },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async findOne(menuId: string) {
    const menu = await this.prisma.menu.findUnique({
      where: { id: menuId },
      include: {
        conditions: true,
        items: {
          include: {
            menuDrink: {
              include: { drink: true },
            },
          },
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    if (!menu) {
      throw new NotFoundException('Menu not found');
    }

    return menu;
  }

  async create(barId: string, dto: CreateMenuDto) {
    // Vérifier si un menu avec ce nom existe déjà
    const existing = await this.prisma.menu.findFirst({
      where: { barId, name: dto.name },
    });

    if (existing) {
      throw new BadRequestException('A menu with this name already exists');
    }

    return this.prisma.menu.create({
      data: {
        barId,
        name: dto.name,
        description: dto.description,
        isDefault: dto.isDefault ?? false,
        displayOrder: dto.displayOrder ?? 0,
        conditions: dto.conditions
          ? {
              create: dto.conditions.map((c) => ({
                conditionType: c.conditionType,
                completionPercent: c.completionPercent,
                completionBarId: c.completionBarId,
                daysOfWeek: c.daysOfWeek || [],
                months: c.months || [],
                season: c.season,
              })),
            }
          : undefined,
      },
      include: {
        conditions: true,
      },
    });
  }

  async update(menuId: string, dto: UpdateMenuDto) {
    const menu = await this.prisma.menu.findUnique({
      where: { id: menuId },
    });

    if (!menu) {
      throw new NotFoundException('Menu not found');
    }

    return this.prisma.menu.update({
      where: { id: menuId },
      data: dto,
    });
  }

  async delete(menuId: string) {
    const menu = await this.prisma.menu.findUnique({
      where: { id: menuId },
    });

    if (!menu) {
      throw new NotFoundException('Menu not found');
    }

    // Les conditions et items seront supprimés en cascade
    await this.prisma.menu.delete({
      where: { id: menuId },
    });

    return { success: true };
  }

  // ==================== CONDITIONS ====================

  async addCondition(menuId: string, dto: MenuConditionDto) {
    return this.prisma.menuCondition.create({
      data: {
        menuId,
        conditionType: dto.conditionType,
        completionPercent: dto.completionPercent,
        completionBarId: dto.completionBarId,
        daysOfWeek: dto.daysOfWeek || [],
        months: dto.months || [],
        season: dto.season,
      },
    });
  }

  async removeCondition(conditionId: string) {
    await this.prisma.menuCondition.delete({
      where: { id: conditionId },
    });
    return { success: true };
  }

  // ==================== MENU ITEMS ====================

  async addItem(menuId: string, dto: AddMenuItemDto) {
    return this.prisma.menuMenuItem.create({
      data: {
        menuId,
        menuDrinkId: dto.menuDrinkId,
        displayOrder: dto.displayOrder ?? 0,
      },
    });
  }

  async removeItem(itemId: string) {
    await this.prisma.menuMenuItem.delete({
      where: { id: itemId },
    });
    return { success: true };
  }

  // ==================== AVAILABLE MENUS ====================

  async getAvailableMenus(barId: string, userId?: string) {
    const menus = await this.prisma.menu.findMany({
      where: { barId },
      include: {
        conditions: {
          include: {
            completionBar: true,
          },
        },
        items: {
          include: {
            menuDrink: {
              include: { drink: true },
            },
          },
          orderBy: { displayOrder: 'asc' },
        },
      },
      orderBy: { displayOrder: 'asc' },
    });

    // Calculer le % de complétion de l'utilisateur si fourni
    let userCompletionPercent = 0;
    if (userId) {
      const [testedCount, totalCount] = await Promise.all([
        this.prisma.consumption.count({
          where: { userId, barId },
        }),
        this.prisma.menuDrink.count({
          where: { barId, available: true },
        }),
      ]);
      userCompletionPercent = totalCount > 0 ? Math.round((testedCount / totalCount) * 100) : 0;
    }

    const now = new Date();
    const currentDay = now.getDay();
    const currentMonth = now.getMonth() + 1;
    const currentSeason = this.getCurrentSeason(now);

    return menus.map((menu) => {
      // Vérifier si toutes les conditions sont remplies (AND)
      const isAvailable = menu.conditions.length === 0 || menu.conditions.every((condition) => {
        switch (condition.conditionType) {
          case 'COMPLETION_PERCENT':
            return userCompletionPercent >= (condition.completionPercent || 0);
          case 'DAY_OF_WEEK':
            return condition.daysOfWeek.includes(currentDay);
          case 'MONTH':
            return condition.months.includes(currentMonth);
          case 'SEASON':
            return condition.season === currentSeason;
          default:
            return true;
        }
      });

      return {
        ...menu,
        isAvailable,
        userCompletionPercent,
        unlockRequirements: this.getUnlockRequirements(menu.conditions, {
          userCompletionPercent,
          currentDay,
          currentMonth,
          currentSeason,
        }),
      };
    });
  }

  private getCurrentSeason(date: Date): string {
    const month = date.getMonth() + 1;
    if (month >= 3 && month <= 5) return 'SPRING';
    if (month >= 6 && month <= 8) return 'SUMMER';
    if (month >= 9 && month <= 11) return 'FALL';
    return 'WINTER';
  }

  private getUnlockRequirements(
    conditions: any[],
    context: {
      userCompletionPercent: number;
      currentDay: number;
      currentMonth: number;
      currentSeason: string;
    }
  ): string[] {
    const requirements: string[] = [];

    for (const condition of conditions) {
      switch (condition.conditionType) {
        case 'COMPLETION_PERCENT':
          if (context.userCompletionPercent < (condition.completionPercent || 0)) {
            requirements.push(`${condition.completionPercent}% de complétion requis (actuellement ${context.userCompletionPercent}%)`);
          }
          break;
        case 'DAY_OF_WEEK':
          if (!condition.daysOfWeek.includes(context.currentDay)) {
            const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
            const requiredDays = condition.daysOfWeek.map((d: number) => days[d]).join(', ');
            requirements.push(`Disponible uniquement: ${requiredDays}`);
          }
          break;
        case 'MONTH':
          if (!condition.months.includes(context.currentMonth)) {
            requirements.push(`Disponible uniquement certains mois`);
          }
          break;
        case 'SEASON':
          if (condition.season !== context.currentSeason) {
            const seasons: Record<string, string> = {
              SPRING: 'Printemps',
              SUMMER: 'Été',
              FALL: 'Automne',
              WINTER: 'Hiver',
            };
            requirements.push(`Disponible uniquement en ${seasons[condition.season] || condition.season}`);
          }
          break;
      }
    }

    return requirements;
  }
}
