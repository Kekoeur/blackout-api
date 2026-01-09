// apps/client-api/src/bar-management/invitation.service.ts

import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class InvitationService {
  constructor(private prisma: PrismaService) {}

  // Créer un lien d'invitation
  async createInvitation(
    creatorId: string,
    barId: string,
    email: string,
    role: 'VIEWER' | 'STAFF' | 'MANAGER',
  ) {
    // Vérifier que le créateur est OWNER du bar
    const access = await this.prisma.barUserAccess.findUnique({
      where: {
        barUserId_barId: {
          barUserId: creatorId,
          barId,
        },
      },
    });

    if (!access || access.role !== 'OWNER') {
      throw new ForbiddenException('Only owners can create invitations');
    }

    // Vérifier que l'email n'est pas déjà utilisé
    const existingUser = await this.prisma.barUser.findUnique({
      where: { email },
    });

    if (existingUser) {
      // Vérifier s'il a déjà accès au bar
      const existingAccess = await this.prisma.barUserAccess.findUnique({
        where: {
          barUserId_barId: {
            barUserId: existingUser.id,
            barId,
          },
        },
      });

      if (existingAccess) {
        throw new BadRequestException('User already has access to this bar');
      }
    }

    // Générer un token unique
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 jours

    const invitation = await this.prisma.invitationToken.create({
      data: {
        token,
        email,
        barId,
        role,
        createdBy: creatorId,
        expiresAt,
      },
      include: {
        bar: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // TODO: Envoyer l'email
    console.log(`📧 Invitation email would be sent to ${email}`);
    console.log(`🔗 Invitation link: ${process.env.DASHBOARD_URL}/register?token=${token}`);

    return {
      success: true,
      invitationLink: `${process.env.DASHBOARD_URL || 'http://localhost:3001'}/register?token=${token}`,
      expiresAt,
      // En dev, retourner le token
      ...(process.env.NODE_ENV === 'development' && { token }),
    };
  }

  // Vérifier un token d'invitation
  async verifyInvitation(token: string) {
    const invitation = await this.prisma.invitationToken.findUnique({
      where: { token },
      include: {
        bar: {
          select: {
            id: true,
            name: true,
            city: true,
          },
        },
      },
    });

    if (!invitation) {
      throw new BadRequestException('Invalid invitation token');
    }

    if (invitation.usedAt) {
      throw new BadRequestException('Invitation already used');
    }

    if (invitation.expiresAt < new Date()) {
      throw new BadRequestException('Invitation expired');
    }

    return {
      email: invitation.email,
      barId: invitation.barId,
      barName: invitation.bar.name,
      role: invitation.role,
    };
  }

  // Utiliser une invitation lors du register
  async useInvitation(token: string, userId: string) {
    const invitation = await this.prisma.invitationToken.findUnique({
      where: { token },
    });

    if (!invitation || invitation.usedAt || invitation.expiresAt < new Date()) {
      throw new BadRequestException('Invalid invitation');
    }

    // Créer l'accès au bar
    await this.prisma.barUserAccess.create({
      data: {
        barUserId: userId,
        barId: invitation.barId,
        role: invitation.role,
      },
    });

    // Marquer l'invitation comme utilisée
    await this.prisma.invitationToken.update({
      where: { token },
      data: { usedAt: new Date() },
    });

    return { success: true };
  }

  // Créer un utilisateur directement (pour OWNER)
  async createUserDirectly(
    creatorId: string,
    barId: string,
    data: {
      email: string;
      name: string;
      password: string;
      role: 'VIEWER' | 'STAFF' | 'MANAGER';
    },
  ) {
    // Vérifier que le créateur est OWNER
    const access = await this.prisma.barUserAccess.findUnique({
      where: {
        barUserId_barId: {
          barUserId: creatorId,
          barId,
        },
      },
    });

    if (!access || access.role !== 'OWNER') {
      throw new ForbiddenException('Only owners can create users');
    }

    // Vérifier que l'email n'existe pas
    const existing = await this.prisma.barUser.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      throw new BadRequestException('Email already exists');
    }

    const bcrypt = await import('bcrypt');
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Créer l'utilisateur
    const user = await this.prisma.barUser.create({
      data: {
        email: data.email,
        name: data.name,
        password: hashedPassword,
        isSuperAdmin: false,
      },
    });

    // Créer l'accès au bar
    await this.prisma.barUserAccess.create({
      data: {
        barUserId: user.id,
        barId,
        role: data.role,
      },
    });

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }
}