import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server } from 'socket.io';
import type { Box } from '@smart-kitchen/contracts';

@WebSocketGateway({
  cors: {
    origin: '*', // בשלב הבדיקות, כדי לוודא שזו לא הבעיה
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket'], // תואם למה שכתבת במובייל
})
export class BoxesGateway {
  @WebSocketServer()
  server!: Server;

  upsert(box: Box) {
    console.log('[WS] emit boxUpserted', box.id, box.quantity);

    this.server.emit('boxUpserted', box);
  }

  delete(payload: { id: string }) {
    this.server.emit('boxDeleted', payload);
  }

  emitIdentifyBox(boxId: string) {
    this.server.emit('identifyBox', { boxId });
  }
}
