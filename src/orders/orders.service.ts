import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
    private pushNotifications: PushNotificationsService,
  ) {}

  async create(userId: string, barId: string, drinkIds: string[], assignments?: Record<string, Array<{ friendId: string | null; friendName: string }>>) {
    // Vérifier que tous les drinks sont dispos
    const menuDrinks = await this.prisma.menuDrink.findMany({
      where: {
        barId,
        drinkId: { in: drinkIds },
        available: true,
      },
    });

    if (menuDrinks.length !== new Set(drinkIds).size) {
      throw new BadRequestException('Some drinks not available');
    }

    const order = await this.prisma.order.create({
      data: {
        userId,
        barId,
        status: 'PENDING',
        items: {
          create: drinkIds.map(drinkId => ({ drinkId })),
        },
      },
      include: {
        items: {
          include: {
            drink: true,
          },
        },
        bar: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    if (assignments) {
      for (const item of order.items) {
        const drinkAssignments = assignments[item.drinkId];
        if (drinkAssignments && drinkAssignments.length > 0) {
          for (const assignment of drinkAssignments) {
            await this.prisma.orderItemAssignment.create({
              data: {
                orderItemId: item.id,
                userId,
                friendId: assignment.friendId === 'guest' ? null : assignment.friendId,
                friendName: assignment.friendName,
              },
            });
            console.log('✅ Assignment created for item:', item.id, 'friend:', assignment.friendName);
          }
        }
      }
    }

    console.log('✅ Order created:', order.id);

    // Notifier le dashboard en temps réel
    this.eventsGateway.notifyNewOrder(barId, order);

    return order;
  }

  // ==================== WORKFLOW MULTI-ÉTAPES ====================

  async getActiveOrders(barId: string) {
    return this.prisma.order.findMany({
      where: {
        barId,
        status: {
          in: ['PENDING', 'ACCEPTED', 'PAID'],
        },
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
        items: {
          include: {
            drink: {
              select: {
                id: true,
                name: true,
                type: true,
                imageUrl: true,
              },
            },
            assignments: {
              include: {
                friend: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'asc', // FIFO - les plus anciennes en premier
      },
    });
  }

  async acceptOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { drink: true } },
        user: { select: { id: true, username: true } },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== 'PENDING') {
      throw new BadRequestException(`Cannot accept order with status ${order.status}`);
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      },
      include: {
        items: { include: { drink: true } },
        user: { select: { id: true, username: true } },
        bar: { select: { id: true, name: true } },
      },
    });

    // Notifier le dashboard
    this.eventsGateway.notifyOrderAccepted(order.barId, updatedOrder);

    // Envoyer push notification au client
    this.pushNotifications.sendOrderStatusNotification(orderId, 'ACCEPTED', order.barId);

    console.log('✅ Order accepted:', orderId);
    return updatedOrder;
  }

  async markAsPaid(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { drink: true } },
        user: { select: { id: true, username: true } },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== 'ACCEPTED') {
      throw new BadRequestException(`Cannot mark as paid order with status ${order.status}`);
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'PAID',
        paidAt: new Date(),
      },
      include: {
        items: { include: { drink: true } },
        user: { select: { id: true, username: true } },
        bar: { select: { id: true, name: true } },
      },
    });

    // Notifier le dashboard
    this.eventsGateway.notifyOrderPaid(order.barId, updatedOrder);

    // Envoyer push notification au client
    this.pushNotifications.sendOrderStatusNotification(orderId, 'PAID', order.barId);

    console.log('✅ Order marked as paid:', orderId);
    return updatedOrder;
  }

  async markAsDelivered(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { drink: true } },
        user: { select: { id: true, username: true } },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== 'PAID') {
      throw new BadRequestException(`Cannot mark as delivered order with status ${order.status}`);
    }

    const deliveredAt = new Date();

    // Créer les consommations pour chaque item
    for (const item of order.items) {
      await this.prisma.consumption.create({
        data: {
          userId: order.userId,
          barId: order.barId,
          drinkId: item.drinkId,
          orderId: order.id,
          photoUrl: order.photoUrl,
          validatedAt: deliveredAt,
        },
      });
      console.log('✅ Consumption created for drink:', item.drink.name);
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'DELIVERED',
        deliveredAt,
        validatedAt: deliveredAt, // Pour compatibilité
      },
      include: {
        items: { include: { drink: true } },
        user: { select: { id: true, username: true } },
        bar: { select: { id: true, name: true } },
      },
    });

    // Notifier le dashboard
    this.eventsGateway.notifyOrderDelivered(order.barId, updatedOrder);

    // Envoyer push notification au client
    this.pushNotifications.sendOrderStatusNotification(orderId, 'DELIVERED', order.barId);

    console.log('✅ Order delivered:', orderId);
    return updatedOrder;
  }

  async cancelOrderById(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status === 'DELIVERED' || order.status === 'CANCELLED') {
      throw new BadRequestException(`Cannot cancel order with status ${order.status}`);
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
      },
      include: {
        items: { include: { drink: true } },
        user: { select: { id: true, username: true } },
        bar: { select: { id: true, name: true } },
      },
    });

    // Notifier le dashboard
    this.eventsGateway.notifyOrderCancelled(order.barId, updatedOrder);

    console.log('✅ Order cancelled:', orderId);
    return updatedOrder;
  }

  // ==================== MÉTHODES EXISTANTES ====================

  async findMyOrders(userId: string) {
    console.log('🔍 findMyOrders for user:', userId);

    const orders = await this.prisma.order.findMany({
      where: {
        userId,
        status: { in: ['DELIVERED'] },
      },
      select: {
        id: true,
        userId: true,
        barId: true,
        status: true,
        photoUrl: true,
        createdAt: true,
        validatedAt: true,
        deliveredAt: true,
        items: {
          include: {
            drink: {
              select: {
                id: true,
                name: true,
                type: true,
                imageUrl: true,
                alcoholLevel: true,
              },
            },
            assignments: {
              include: {
                friend: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
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
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Ajouter les ratings
    const ordersWithRatings = await Promise.all(
      orders.map(async (order) => {
        const itemsWithRatings = await Promise.all(
          order.items.map(async (item) => {
            const rating = await this.prisma.rating.findFirst({
              where: {
                userId,
                drinkId: item.drinkId,
              },
              select: {
                id: true,
                rating: true,
                comment: true,
                createdAt: true,
              },
            });

            return {
              ...item,
              rating,
            };
          })
        );

        return {
          ...order,
          items: itemsWithRatings,
        };
      })
    );

    console.log('📊 Found orders:', ordersWithRatings.length);

    return ordersWithRatings;
  }

  async findMyAssignedOrders(userId: string) {
    console.log('🔍 findMyAssignedOrders for user:', userId);

    const orderAssignments = await this.prisma.orderItemAssignment.findMany({
      where: {
        OR: [
          { userId, friendId: null },
          {
            friend: {
              linkedUserId: userId,
            },
          },
        ],
        orderItem: {
          order: {
            status: { in: ['DELIVERED'] },
          },
        },
      },
      include: {
        orderItem: {
          include: {
            order: {
              select: {
                id: true,
                userId: true,
                barId: true,
                status: true,
                photoUrl: true,
                createdAt: true,
                validatedAt: true,
                deliveredAt: true,
                bar: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                user: {
                  select: {
                    id: true,
                    username: true,
                    friendCode: true,
                  },
                },
              },
            },
            drink: {
              select: {
                id: true,
                name: true,
                type: true,
                imageUrl: true,
                alcoholLevel: true,
              },
            },
          },
        },
      },
    });

    // Grouper par order
    const ordersMap = new Map<string, any>();

    for (const assignment of orderAssignments) {
      const order = assignment.orderItem.order;
      const orderItem = assignment.orderItem;

      if (!ordersMap.has(order.id)) {
        ordersMap.set(order.id, {
          id: order.id,
          type: order.photoUrl ? 'photo' : 'qrcode',
          photoUrl: order.photoUrl,
          createdAt: order.createdAt,
          validatedAt: order.validatedAt,
          deliveredAt: order.deliveredAt,
          status: order.status,
          bar: order.bar,
          createdBy: order.user,
          items: new Map(),
        });
      }

      const orderData = ordersMap.get(order.id);

      if (!orderData.items.has(orderItem.drinkId)) {
        orderData.items.set(orderItem.drinkId, {
          id: orderItem.id,
          drinkId: orderItem.drinkId,
          drink: orderItem.drink,
          quantity: 0,
        });
      }

      orderData.items.get(orderItem.drinkId).quantity += 1;
    }

    const orders = Array.from(ordersMap.values()).map(order => ({
      ...order,
      items: Array.from(order.items.values()),
    }));

    // Ajouter les ratings
    const ordersWithRatings = await Promise.all(
      orders.map(async (order) => {
        const itemsWithRatings = await Promise.all(
          order.items.map(async (item) => {
            const rating = await this.prisma.rating.findFirst({
              where: {
                userId,
                drinkId: item.drinkId,
              },
              select: {
                id: true,
                rating: true,
                comment: true,
                createdAt: true,
              },
            });

            return {
              ...item,
              rating,
            };
          })
        );

        return {
          ...order,
          items: itemsWithRatings,
        };
      })
    );

    ordersWithRatings.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    console.log('📊 Found assigned orders:', ordersWithRatings.length);

    return ordersWithRatings;
  }

  async findMyValidatedOrders(userId: string) {
    console.log('🔍 findMyValidatedOrders for user:', userId);

    const orders = await this.prisma.order.findMany({
      where: {
        userId,
        status: { in: ['DELIVERED'] },
      },
      include: {
        items: {
          include: {
            drink: {
              select: {
                id: true,
                name: true,
                type: true,
                imageUrl: true,
                alcoholLevel: true,
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
      orderBy: {
        validatedAt: 'desc',
      },
    });

    console.log('📊 Found validated orders:', orders.length);

    // Retourner les items individuels (pas les orders groupées)
    const items = orders.flatMap(order =>
      order.items.map(item => ({
        id: `${order.id}-${item.id}`,
        orderId: order.id,
        drinkId: item.drinkId,
        drink: item.drink,
        bar: order.bar,
        validatedAt: order.validatedAt,
        deliveredAt: order.deliveredAt,
        createdAt: order.createdAt,
      }))
    );

    console.log('📊 Total items:', items.length);

    return items;
  }

  async findOne(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: { drink: true },
        },
        bar: true,
      },
    });

    if (!order || order.userId !== userId) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async validate(orderId: string, apiKey: string) {
    console.log('🔍 Validate order:', orderId);

    const bar = await this.prisma.bar.findUnique({
      where: { apiKey },
    });

    if (!bar) {
      throw new BadRequestException('Invalid API key');
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { drink: true } } },
    });

    if (!order || order.barId !== bar.id) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== 'PENDING') {
      throw new BadRequestException('Order already processed');
    }

    const validatedAt = new Date();

    console.log('📝 Creating consumptions for', order.items.length, 'items');

    // Créer les consommations pour CHAQUE item
    for (const item of order.items) {
      const consumption = await this.prisma.consumption.create({
        data: {
          userId: order.userId,
          barId: order.barId,
          drinkId: item.drinkId,
          orderId: order.id,
          photoUrl: null,
          validatedAt,
        },
      });
      console.log('✅ Consumption created:', consumption.id, 'for drink:', item.drink.name);
    }

    // Valider la commande (passer directement à DELIVERED pour compatibilité)
    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'DELIVERED',
        validatedAt,
        deliveredAt: validatedAt,
      },
      include: {
        items: {
          include: {
            drink: true,
          },
        },
      },
    });

    // Notifier
    this.eventsGateway.notifyOrderDelivered(bar.id, updatedOrder);

    console.log('✅ Order validated:', updatedOrder.id);

    return updatedOrder;
  }

  async cancel(orderId: string, apiKey: string) {
    const bar = await this.prisma.bar.findUnique({
      where: { apiKey },
    });

    if (!bar) {
      throw new BadRequestException('Invalid API key');
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order || order.barId !== bar.id) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== 'PENDING') {
      throw new BadRequestException('Order already processed');
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'CANCELLED' },
      include: {
        items: { include: { drink: true } },
      },
    });

    // Notifier
    this.eventsGateway.notifyOrderCancelled(bar.id, updatedOrder);

    return { success: true };
  }

  async getBarOrders(barId: string, status?: string) {
    return this.prisma.order.findMany({
      where: {
        barId,
        ...(status && status !== 'ALL' ? { status: status as any } : {}),
      },
      include: {
        user: {
          select: {
            username: true,
          },
        },
        items: {
          include: {
            drink: true,
            assignments: {
              include: {
                friend: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async validateOrder(orderId: string) {
    const existing = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!existing) throw new NotFoundException('Order not found');

    const order = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'DELIVERED',
        validatedAt: new Date(),
        deliveredAt: new Date(),
      },
      include: {
        items: { include: { drink: true } },
        bar: { select: { id: true } },
      },
    });

    this.eventsGateway.notifyOrderDelivered(order.barId, order);

    return order;
  }

  async cancelOrder(orderId: string) {
    const existing = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!existing) throw new NotFoundException('Order not found');

    const order = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
      },
      include: {
        items: { include: { drink: true } },
        bar: { select: { id: true } },
      },
    });

    this.eventsGateway.notifyOrderCancelled(order.barId, order);

    return order;
  }
}
