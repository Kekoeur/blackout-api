import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:3001',
      'http://localhost:3002',
      'http://192.168.1.50:3001',
      'http://192.168.1.50:3002',
    ],
    credentials: true,
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);

  handleConnection(client: Socket) {
    const barId = client.handshake.query.barId as string;

    if (barId) {
      client.join(`bar:${barId}`);
      this.logger.log(`Client ${client.id} joined room bar:${barId}`);
    }

    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // ==================== ORDER NOTIFICATIONS ====================

  notifyNewOrder(barId: string, order: any) {
    this.server.to(`bar:${barId}`).emit('order:new', order);
    this.logger.log(`New order emitted for bar ${barId}`);
  }

  notifyOrderStatusChange(barId: string, order: any, newStatus: string) {
    this.server.to(`bar:${barId}`).emit('order:status_changed', {
      order,
      newStatus,
      timestamp: new Date().toISOString(),
    });
    this.logger.log(`Order ${order.id} status changed to ${newStatus} for bar ${barId}`);
  }

  notifyOrderAccepted(barId: string, order: any) {
    this.notifyOrderStatusChange(barId, order, 'ACCEPTED');
  }

  notifyOrderPaid(barId: string, order: any) {
    this.notifyOrderStatusChange(barId, order, 'PAID');
  }

  notifyOrderDelivered(barId: string, order: any) {
    this.notifyOrderStatusChange(barId, order, 'DELIVERED');
  }

  notifyOrderCancelled(barId: string, order: any) {
    this.notifyOrderStatusChange(barId, order, 'CANCELLED');
  }

  // ==================== PHOTO NOTIFICATIONS ====================

  notifyNewPhoto(barId: string, photo: any) {
    this.server.to(`bar:${barId}`).emit('photo:new', photo);
    this.logger.log(`New photo emitted for bar ${barId}`);
  }

  notifyPhotoValidated(barId: string, photo: any) {
    this.server.to(`bar:${barId}`).emit('photo:validated', photo);
    this.logger.log(`Photo ${photo.id} validated for bar ${barId}`);
  }

  notifyPhotoRejected(barId: string, photo: any) {
    this.server.to(`bar:${barId}`).emit('photo:rejected', photo);
    this.logger.log(`Photo ${photo.id} rejected for bar ${barId}`);
  }
}
