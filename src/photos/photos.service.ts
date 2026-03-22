import { Injectable, ForbiddenException, BadRequestException, UnauthorizedException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PhotoModerationService } from './services/photo-moderation.service';
import { ModerationStatus } from './enums/moderation.enum';
import { EventsGateway } from '../events/events.gateway';
import * as fs from 'fs';

@Injectable()
export class PhotosService {
  private readonly logger = new Logger(PhotosService.name);

  constructor(
    private prisma: PrismaService,
    private moderationService: PhotoModerationService,
    private eventsGateway: EventsGateway,
  ) {}

  async submitPhoto(
    userId: string,
    barId: string,
    photoUrl: string,
    items: Array<{
      drinkId: string;
      friendId: string | null; // null = moi, 'guest' = invité
    }>,
  ) {
    this.logger.log(`📸 Creating photo submission for user: ${userId}`);

    // Vérifier que le bar existe
    const bar = await this.prisma.bar.findUnique({
      where: { id: barId },
    });

    if (!bar) {
      throw new BadRequestException('Bar not found');
    }

    // 🔍 MODERATION NSFW - Vérifier le contenu de la photo AVANT de créer la soumission
    try {
      this.logger.log(`🔍 Checking photo content for NSFW...`);
      const moderationResult = await this.moderationService.moderatePhoto(photoUrl);

      this.logger.log(`📊 Moderation result: ${moderationResult.status} (confidence: ${moderationResult.confidence}%)`);
      this.logger.log(`📊 Scores: Adult=${moderationResult.scores?.adult?.toFixed(1)}%, Racy=${moderationResult.scores?.racy?.toFixed(1)}%`);

      if (moderationResult.status === ModerationStatus.REJECTED) {
        this.logger.warn(`❌ Photo REJECTED by moderation: ${moderationResult.reasons.join(', ')}`);

        // Supprimer le fichier uploadé
        try {
          if (fs.existsSync(photoUrl)) {
            fs.unlinkSync(photoUrl);
            this.logger.log(`🗑️ Deleted rejected photo file: ${photoUrl}`);
          }
        } catch (deleteError) {
          this.logger.error(`Failed to delete rejected photo: ${deleteError.message}`);
        }

        // Incrémenter le compteur NSFW de l'utilisateur
        await this.prisma.user.update({
          where: { id: userId },
          data: { nsfwFlagCount: { increment: 1 } },
        });
        this.logger.warn(`⚠️ User ${userId} NSFW flag count incremented`);

        throw new BadRequestException({
          message: 'Photo rejected: inappropriate content detected',
          code: 'NSFW_CONTENT_DETECTED',
          reasons: moderationResult.reasons,
          scores: moderationResult.scores,
        });
      }

      if (moderationResult.status === ModerationStatus.NEEDS_REVIEW) {
        this.logger.warn(`⚠️ Photo needs review: ${moderationResult.reasons.join(', ')}`);
        // On continue mais on log le warning - le bar pourra rejeter manuellement si nécessaire
      }
    } catch (error) {
      // Si c'est une BadRequestException de modération, on la relance
      if (error instanceof BadRequestException) {
        throw error;
      }
      // Sinon on log l'erreur mais on continue (modération optionnelle)
      this.logger.warn(`⚠️ Moderation check failed, continuing without: ${error.message}`);
    }

    // Créer la soumission
    const submission = await this.prisma.photoSubmission.create({
      data: {
        userId,
        barId,
        photoUrl,
        status: 'PENDING',
        items: {
          create: items.map(item => ({
            drinkId: item.drinkId,
            friendId: item.friendId === 'guest' ? null : item.friendId,
          })),
        },
      },
      include: {
        items: {
          include: {
            drink: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
              },
            },
            friend: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        bar: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    this.logger.log(`✅ Photo submission created: ${submission.id}`);

    // Notifier le dashboard en temps réel
    this.eventsGateway.notifyNewPhoto(barId, submission);

    return submission;
  }

  async getMySubmissions(userId: string) {
    return this.prisma.photoSubmission.findMany({
      where: { userId },
      include: {
        items: {
          include: {
            drink: true,
            friend: true,
          },
        },
        bar: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async validateSubmission(submissionId: string, apiKey: string) {
    console.log('✅ Validating photo submission:', submissionId);

    const bar = await this.prisma.bar.findUnique({
      where: { apiKey },
    });

    if (!bar) {
      throw new UnauthorizedException('Invalid API key');
    }

    const submission = await this.prisma.photoSubmission.findUnique({
      where: { id: submissionId },
      include: {
        items: {
          include: {
            drink: true,
            friend: true,
          }
        }
      },
    });

    if (!submission) {
      throw new BadRequestException('Submission not found');
    }

    if (submission.barId !== bar.id) {
      throw new UnauthorizedException('Not your submission');
    }

    if (submission.status !== 'PENDING') {
      throw new BadRequestException('Submission already processed');
    }

    console.log('📸 Creating Order with', submission.items.length, 'items');

    // ⭐ CRÉER l'Order SANS items d'abord
    const order = await this.prisma.order.create({
      data: {
        userId: submission.userId,
        barId: submission.barId,
        status: 'DELIVERED',
        photoUrl: submission.photoUrl,
        validatedAt: new Date(),
      },
    });

    console.log('✅ Order created from photo:', order.id);

    // ⭐ CRÉER les OrderItems ET Assignments EN MÊME TEMPS (1:1 mapping)
    const createdItems: string[] = [];
    
    for (const photoItem of submission.items) {
      // Créer l'OrderItem
      const orderItem = await this.prisma.orderItem.create({
        data: {
          orderId: order.id,
          drinkId: photoItem.drinkId,
        },
      });
      
      console.log('✅ OrderItem created:', orderItem.id, 'for drink:', photoItem.drinkId);
      
      // Créer l'Assignment pour CET OrderItem spécifique
      await this.prisma.orderItemAssignment.create({
        data: {
          orderItemId: orderItem.id,
          userId: submission.userId,
          friendId: photoItem.friendId,
          friendName: photoItem.friendId === null 
          ? 'Invité' 
          : (photoItem.friend ? photoItem.friend.name : 'Invité'),
        },
      });
      
      console.log('✅ Assignment created for OrderItem:', orderItem.id, 'friendId:', photoItem.friendId);
      
      createdItems.push(orderItem.drinkId);
    }

    // ⭐ CRÉER les Consumptions (1 par drink unique)
    const uniqueDrinks = [...new Set(createdItems)];
    
    for (const drinkId of uniqueDrinks) {
      await this.prisma.consumption.create({
        data: {
          userId: submission.userId,
          barId: submission.barId,
          drinkId,
          orderId: order.id,
          photoUrl: submission.photoUrl,
          validatedAt: new Date(),
        },
      });
      
      console.log('✅ Consumption created for drink:', drinkId);
    }

    // Mettre à jour la soumission
    await this.prisma.photoSubmission.update({
      where: { id: submissionId },
      data: {
        status: 'VALIDATED',
        validatedAt: new Date(),
      },
    });

    console.log('✅ Photo submission validated');

    return { success: true, orderId: order.id };
  }

  async rejectSubmission(submissionId: string, apiKey: string) {
    console.log('❌ Rejecting photo submission:', submissionId);

    const bar = await this.prisma.bar.findUnique({
      where: { apiKey },
    });

    if (!bar) {
      throw new BadRequestException('Invalid API key');
    }

    const submission = await this.prisma.photoSubmission.findUnique({
      where: { id: submissionId },
    });

    if (!submission || submission.barId !== bar.id) {
      throw new BadRequestException('Submission not found');
    }

    if (submission.status !== 'PENDING') {
      throw new BadRequestException('Submission already processed');
    }

    await this.prisma.photoSubmission.update({
      where: { id: submissionId },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
      },
    });

    console.log('✅ Photo submission rejected');

    return { success: true };
  }

  async getBarPhotos(barId: string, status?: string) {
    return this.prisma.photoSubmission.findMany({
      where: {
        barId,
        ...(status && status !== 'ALL' ? { status: status as any } : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            nsfwFlagCount: true,
          },
        },
        items: {
          include: {
            drink: true,
            friend: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async rejectSubmissionByDashboard(submissionId: string, barId: string, reason?: string, comment?: string) {
    console.log('❌ [Dashboard] Rejecting photo submission:', submissionId);

    const submission = await this.prisma.photoSubmission.findUnique({
      where: { id: submissionId },
    });

    if (!submission) {
      throw new BadRequestException('Submission not found');
    }

    // Vérifier que la photo appartient au bon bar
    if (submission.barId !== barId) {
      throw new ForbiddenException('This photo does not belong to your bar');
    }

    if (submission.status !== 'PENDING') {
      throw new BadRequestException('Submission already processed');
    }

    await this.prisma.photoSubmission.update({
      where: { id: submissionId },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectionReason: reason || null,
        moderatorComment: comment || null,
      },
    });

    // Si rejet pour contenu explicite, incrémenter le compteur de l'utilisateur
    if (reason === 'NSFW_MANUAL') {
      await this.prisma.user.update({
        where: { id: submission.userId },
        data: { nsfwFlagCount: { increment: 1 } },
      });
      this.logger.warn(`⚠️ User ${submission.userId} NSFW flag count incremented (manual flag by bar)`);
    }

    console.log('✅ [Dashboard] Photo submission rejected');

    return { success: true };
  }

  async validateSubmissionByDashboard(submissionId: string, barId: string) {
    console.log('✅ [Dashboard] Validating photo submission:', submissionId);

    const submission = await this.prisma.photoSubmission.findUnique({
      where: { id: submissionId },
      include: {
        items: {
          include: {
            drink: true,
            friend: true,
          },
        },
      },
    });

    if (!submission) {
      throw new BadRequestException('Submission not found');
    }

    // Vérifier que la photo appartient au bon bar
    if (submission.barId !== barId) {
      throw new ForbiddenException('This photo does not belong to your bar');
    }

    if (submission.status !== 'PENDING') {
      throw new BadRequestException('Submission already processed');
    }

    // Créer l'Order (sans items d'abord)
    console.log('📝 Creating Order with', submission.items.length, 'items');

    const order = await this.prisma.order.create({
      data: {
        userId: submission.userId,
        barId: submission.barId,
        status: 'DELIVERED',
        photoUrl: submission.photoUrl,
        validatedAt: new Date(),
      },
    });

    console.log('✅ Order created from photo:', order.id);

    // Créer OrderItems et Assignments (1:1 mapping)
    const createdItems: string[] = [];

    for (const photoItem of submission.items) {
      const orderItem = await this.prisma.orderItem.create({
        data: {
          orderId: order.id,
          drinkId: photoItem.drinkId,
        },
      });

      console.log('✅ OrderItem created:', orderItem.id, 'for drink:', photoItem.drinkId);

      await this.prisma.orderItemAssignment.create({
        data: {
          orderItemId: orderItem.id,
          userId: submission.userId,
          friendId: photoItem.friendId,
          friendName: photoItem.friendId === null 
          ? 'Invité' 
            : (photoItem.friend ? photoItem.friend.name : 'Invité'),
        },
      });

      console.log('✅ Assignment created for OrderItem:', orderItem.id, 'friendId:', photoItem.friendId);

      createdItems.push(photoItem.drinkId);
    }

    // Créer les Consumptions (1 par unique drink)
    const uniqueDrinks = [...new Set(createdItems)];

    for (const drinkId of uniqueDrinks) {
      await this.prisma.consumption.create({
        data: {
          userId: submission.userId,
          barId: submission.barId,
          drinkId,
          orderId: order.id,
          photoUrl: submission.photoUrl,
          validatedAt: new Date(),
        },
      });

      console.log('✅ Consumption created for drink:', drinkId);
    }

    // Mettre à jour le statut de la soumission
    await this.prisma.photoSubmission.update({
      where: { id: submissionId },
      data: {
        status: 'VALIDATED',
        validatedAt: new Date(),
      },
    });

    console.log('✅ Photo submission validated');

    // Notifier le dashboard
    this.eventsGateway.notifyPhotoValidated(barId, { id: submissionId, orderId: order.id });

    return { success: true, orderId: order.id };
  }
}