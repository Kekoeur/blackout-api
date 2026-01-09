// apps/client-api/src/bar-management/guards/super-admin.guard.ts

import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const barUserId = request.barUser?.id;

    if (!barUserId) {
      throw new ForbiddenException('Not authenticated');
    }

    const barUser = await this.prisma.barUser.findUnique({
      where: { id: barUserId },
      select: { isSuperAdmin: true },
    });

    if (!barUser?.isSuperAdmin) {
      throw new ForbiddenException('Super admin access required');
    }

    return true;
  }
}