// apps/client-api/src/events/events.gateway.ts

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3001', 'http://192.168.1.50:3001'],
    credentials: true,
  },
})
export class EventsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`✅ Client connected: ${client.id}`);
  }

  // Émettre une nouvelle commande
  notifyNewOrder(barId: string, order: any) {
    this.server.emit(`bar:${barId}:new_order`, order);
    console.log(`📢 New order emitted for bar ${barId}`);
  }

  // Émettre une nouvelle photo
  notifyNewPhoto(barId: string, photo: any) {
    this.server.emit(`bar:${barId}:new_photo`, photo);
    console.log(`📢 New photo emitted for bar ${barId}`);
  }
}