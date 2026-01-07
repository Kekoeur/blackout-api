// apps/client-api/src/prisma/prisma.service.ts

import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
    
    // ⭐ MIDDLEWARE : Auto-créer consumptions quand order devient VALIDATED
    this.$use(async (params, next) => {
      // Si c'est un update sur Order
      if (params.model === 'Order' && params.action === 'update') {
        const result = await next(params);
        
        // Si le status est passé à VALIDATED
        if (result.status === 'VALIDATED' && result.validatedAt) {
          console.log('🔄 Middleware: Order validated, checking consumptions...');
          
          // Vérifier si des consumptions existent déjà
          const existingConsumptions = await this.consumption.count({
            where: { orderId: result.id },
          });
          
          // Si aucune consumption, les créer
          if (existingConsumptions === 0) {
            console.log('📝 Middleware: Creating consumptions for order', result.id);
            
            // Récupérer les items de la commande
            const order = await this.order.findUnique({
              where: { id: result.id },
              include: { items: { include: { drink: true } } },
            });
            
            if (order) {
              // Créer les consumptions
              for (const item of order.items) {
                const consumption = await this.consumption.create({
                  data: {
                    userId: order.userId,
                    barId: order.barId,
                    drinkId: item.drinkId,
                    orderId: order.id,
                    photoUrl: null,
                    validatedAt: result.validatedAt,
                  },
                });
                console.log('✅ Middleware: Consumption created:', consumption.id, 'for drink:', item.drink.name);
              }
            }
          } else {
            console.log('✅ Middleware: Consumptions already exist, skipping');
          }
        }
        
        return result;
      }
      
      return next(params);
    });
  }
}