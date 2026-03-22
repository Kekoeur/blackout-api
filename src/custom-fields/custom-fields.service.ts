import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomFieldDto, UpdateCustomFieldDto } from './dto/create-custom-field.dto';

@Injectable()
export class CustomFieldsService {
  constructor(private prisma: PrismaService) {}

  async findByBar(barId: string) {
    return this.prisma.customField.findMany({
      where: { barId },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async create(barId: string, dto: CreateCustomFieldDto) {
    // Vérifier si un champ avec ce nom existe déjà
    const existing = await this.prisma.customField.findFirst({
      where: { barId, name: dto.name },
    });

    if (existing) {
      throw new BadRequestException('A field with this name already exists');
    }

    return this.prisma.customField.create({
      data: {
        barId,
        name: dto.name,
        type: dto.type,
        options: dto.options || [],
        required: dto.required ?? false,
        showOnMobile: dto.showOnMobile ?? true,
        displayOrder: dto.displayOrder ?? 0,
      },
    });
  }

  async update(fieldId: string, dto: UpdateCustomFieldDto) {
    const field = await this.prisma.customField.findUnique({
      where: { id: fieldId },
    });

    if (!field) {
      throw new NotFoundException('Custom field not found');
    }

    return this.prisma.customField.update({
      where: { id: fieldId },
      data: dto,
    });
  }

  async delete(fieldId: string) {
    const field = await this.prisma.customField.findUnique({
      where: { id: fieldId },
    });

    if (!field) {
      throw new NotFoundException('Custom field not found');
    }

    await this.prisma.customField.delete({
      where: { id: fieldId },
    });

    return { success: true };
  }

  async reorder(barId: string, fieldIds: string[]) {
    const updates = fieldIds.map((fieldId, index) =>
      this.prisma.customField.update({
        where: { id: fieldId },
        data: { displayOrder: index },
      })
    );

    await Promise.all(updates);
    return { success: true };
  }
}
