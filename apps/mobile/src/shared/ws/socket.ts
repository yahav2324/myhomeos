import { io, type Socket } from 'socket.io-client';
import { getWsBase } from '../config/endpoints';

export type BoxUpsertedPayload = {
  id: string;
  code: string;
  name: string;
  unit: 'g' | 'ml';
  quantity: number;
  percent: number;
  state: 'OK' | 'LOW' | 'EMPTY';
  fullQuantity?: number;
  deviceId: string;
  createdAt: string;
  updatedAt: string;
  lastReadingAt?: string;
};

type BoxDeletedPayload = { id: string };

type ServerToClientEvents = {
  boxUpserted: (payload: BoxUpsertedPayload) => void;
  // ✅ להוסיף
  boxDeleted: (payload: BoxDeletedPayload) => void;
};

type ClientToServerEvents = Record<string, never>;

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export function getSocket() {
  if (socket) return socket;

  const url = getWsBase();
  console.log('[WS] creating socket', url);

  socket = io(url, {
    transports: ['websocket'], // הכי יציב
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    timeout: 8000,
  });

  socket.on('connect', () => console.log('[WS] connected', socket?.id));
  socket.on('disconnect', (reason) => console.log('[WS] disconnected', reason));
  socket.on('connect_error', (err) => console.log('[WS] connect_error', err?.message));
  socket.onAny((event, ...args) => {
    console.log('[WS onAny]', event, args);
  });
  return socket;
}

export function disconnectSocket() {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
}
