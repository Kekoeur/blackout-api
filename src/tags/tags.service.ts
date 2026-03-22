import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTagDto } from './dto/create-tag.dto';

@Injectable()
export class TagsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.tag.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { drinks: true },
        },
      },
    });
  }

  async create(dto: CreateTagDto) {
    // Vérifier si le tag existe déjà
    const existing = await this.prisma.tag.findUnique({
      where: { name: dto.name },
    });

    if (existing) {
      throw new BadRequestException('Tag already exists');
    }

    return this.prisma.tag.create({
      data: {
        name: dto.name,
        color: dto.color || '#6366f1', // Default indigo
      },
    });
  }

  async update(tagId: string, dto: Partial<CreateTagDto>) {
    const tag = await this.prisma.tag.findUnique({
      where: { id: tagId },
    });

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    return this.prisma.tag.update({
      where: { id: tagId },
      data: dto,
    });
  }

  async delete(tagId: string) {
    const tag = await this.prisma.tag.findUnique({
      where: { id: tagId },
    });

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    // Supprimer d'abord les relations
    await this.prisma.drinkTag.deleteMany({
      where: { tagId },
    });

    // Puis supprimer le tag
    await this.prisma.tag.delete({
      where: { id: tagId },
    });

    return { success: true };
  }

  // ==================== DRINK TAGS ====================

  async addTagsToDrink(drinkId: string, tagIds: string[]) {
    const drink = await this.prisma.drink.findUnique({
      where: { id: drinkId },
    });

    if (!drink) {
      throw new NotFoundException('Drink not found');
    }

    // Créer les relations
    const results = await Promise.all(
      tagIds.map(async (tagId) => {
        try {
          return await this.prisma.drinkTag.create({
            data: { drinkId, tagId },
          });
        } catch {
          // Ignorer les doublons
          return null;
        }
      })
    );

    return results.filter(Boolean);
  }

  async removeTagFromDrink(drinkId: string, tagId: string) {
    await this.prisma.drinkTag.deleteMany({
      where: { drinkId, tagId },
    });

    return { success: true };
  }

  async getDrinkTags(drinkId: string) {
    const drinkTags = await this.prisma.drinkTag.findMany({
      where: { drinkId },
      include: { tag: true },
    });

    return drinkTags.map((dt) => dt.tag);
  }

  async getDrinksByTags(tagIds: string[]) {
    const drinks = await this.prisma.drink.findMany({
      where: {
        tags: {
          some: {
            tagId: { in: tagIds },
          },
        },
      },
      include: {
        tags: {
          include: { tag: true },
        },
      },
    });

    return drinks;
  }
}
