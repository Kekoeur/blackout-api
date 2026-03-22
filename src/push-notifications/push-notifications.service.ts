import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: 'default' | null;
  badge?: number;
  channelId?: string;
}

interface ExpoPushTicket {
  id?: string;
  status: 'ok' | 'error';
  message?: string;
  details?: {
    error?: string;
  };
}

@Injectable()
export class PushNotificationsService {
  private readonly logger = new Logger(PushNotificationsService.name);
  private readonly EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

  constructor(private prisma: PrismaService) {}

  // Envoyer une notification a un utilisateur
  async sendToUser(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, any>,
  ): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { pushToken: true },
    });

    if (!user?.pushToken) {
      this.logger.debug(`No push token for user ${userId}`);
      return false;
    }

    return this.sendPushNotification({
      to: user.pushToken,
      title,
      body,
      data,
      sound: 'default',
    });
  }

  // Envoyer une notification pour un changement de statut de commande
  async sendOrderStatusNotification(
    orderId: string,
    newStatus: string,
    barId: string,
  ): Promise<void> {
    // Verifier la configuration du bar
    const bar = await this.prisma.bar.findUnique({
      where: { id: barId },
      select: {
        name: true,
        pushNotificationsEnabled: true,
        notifyOnAccepted: true,
        notifyOnPaid: true,
        notifyOnDelivered: true,
      },
    });

    if (!bar?.pushNotificationsEnabled) {
      this.logger.debug(`Push notifications disabled for bar ${barId}`);
      return;
    }

    // Verifier si ce statut doit declencher une notification
    const shouldNotify =
      (newStatus === 'ACCEPTED' && bar.notifyOnAccepted) ||
      (newStatus === 'PAID' && bar.notifyOnPaid) ||
      (newStatus === 'DELIVERED' && bar.notifyOnDelivered);

    if (!shouldNotify) {
      this.logger.debug(`Notification not configured for status ${newStatus}`);
      return;
    }

    // Recuperer la commande avec l'utilisateur
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: {
          select: { id: true, pushToken: true },
        },
      },
    });

    if (!order?.user?.pushToken) {
      this.logger.debug(`No push token for order user`);
      return;
    }

    // Construire le message selon le statut
    const messages: Record<string, { title: string; body: string }> = {
      ACCEPTED: {
        title: `${bar.name} - Commande prise en charge`,
        body: 'Votre commande est en cours de preparation!',
      },
      PAID: {
        title: `${bar.name} - Paiement confirme`,
        body: 'Votre commande a ete payee.',
      },
      DELIVERED: {
        title: `${bar.name} - Commande prete!`,
        body: 'Votre commande est prete a etre recuperee!',
      },
    };

    const message = messages[newStatus];
    if (!message) return;

    await this.sendPushNotification({
      to: order.user.pushToken,
      title: message.title,
      body: message.body,
      data: {
        type: 'order_status',
        orderId,
        status: newStatus,
        barId,
      },
      sound: 'default',
    });
  }

  // Methode interne pour envoyer via l'API Expo
  private async sendPushNotification(
    message: ExpoPushMessage,
  ): Promise<boolean> {
    // Verifier que c'est un token Expo valide
    if (!message.to.startsWith('ExponentPushToken[')) {
      this.logger.warn(`Invalid push token format: ${message.to}`);
      return false;
    }

    try {
      const response = await fetch(this.EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      const result = await response.json();
      const ticket: ExpoPushTicket = result.data?.[0] || result;

      if (ticket.status === 'error') {
        this.logger.error(
          `Push notification error: ${ticket.message}`,
          ticket.details,
        );
        return false;
      }

      this.logger.debug(`Push notification sent successfully: ${ticket.id}`);
      return true;
    } catch (error) {
      this.logger.error('Failed to send push notification', error);
      return false;
    }
  }

  // Envoyer a plusieurs utilisateurs
  async sendToMultipleUsers(
    userIds: string[],
    title: string,
    body: string,
    data?: Record<string, any>,
  ): Promise<number> {
    const users = await this.prisma.user.findMany({
      where: {
        id: { in: userIds },
        pushToken: { not: null },
      },
      select: { pushToken: true },
    });

    const validTokens = users
      .map((u) => u.pushToken)
      .filter((t): t is string => !!t && t.startsWith('ExponentPushToken['));

    if (validTokens.length === 0) {
      return 0;
    }

    // Envoyer en batch (max 100 par requete selon Expo)
    const batchSize = 100;
    let sentCount = 0;

    for (let i = 0; i < validTokens.length; i += batchSize) {
      const batch = validTokens.slice(i, i + batchSize);
      const messages = batch.map((token) => ({
        to: token,
        title,
        body,
        data,
        sound: 'default' as const,
      }));

      try {
        const response = await fetch(this.EXPO_PUSH_URL, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(messages),
        });

        const result = await response.json();
        const tickets: ExpoPushTicket[] = result.data || [];
        sentCount += tickets.filter((t) => t.status === 'ok').length;
      } catch (error) {
        this.logger.error('Failed to send batch push notification', error);
      }
    }

    return sentCount;
  }
}
