import { io, type Socket } from 'socket.io-client';
import { RT_CHANNEL, type RealtimeEvent } from './events';

/**
 * Transport abstraction for realtime.
 *
 * - If `NEXT_PUBLIC_SOCKET_URL` is set, connect a real Socket.IO client and use
 *   rooms per list. The backend has no socket server today, so this path lights
 *   up automatically the day one is added — no app changes required.
 * - Otherwise, fall back to a `BroadcastChannel`, which gives GENUINE realtime
 *   across tabs/windows of the same browser: drag a card in one tab and the
 *   others update. It's the honest "no server yet" behavior, not a fake.
 *
 * The two share one interface so `socketMiddleware` is transport-agnostic.
 */
export interface RealtimeBus {
  emit(event: RealtimeEvent): void;
  on(handler: (event: RealtimeEvent) => void): void;
  join(room: string): void;
  leave(room: string): void;
  close(): void;
  readonly transport: 'socket' | 'broadcast' | 'none';
}

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL;

class SocketBus implements RealtimeBus {
  readonly transport = 'socket' as const;
  private socket: Socket;
  private handlers = new Set<(e: RealtimeEvent) => void>();

  constructor(url: string) {
    this.socket = io(url, { transports: ['websocket'], autoConnect: true });
    this.socket.on('rt', (event: RealtimeEvent) => this.handlers.forEach((h) => h(event)));
  }
  emit(event: RealtimeEvent) {
    this.socket.emit('rt', event);
  }
  on(handler: (e: RealtimeEvent) => void) {
    this.handlers.add(handler);
  }
  join(room: string) {
    this.socket.emit('join', room);
  }
  leave(room: string) {
    this.socket.emit('leave', room);
  }
  close() {
    this.socket.close();
  }
}

class BroadcastBus implements RealtimeBus {
  readonly transport = 'broadcast' as const;
  private channel: BroadcastChannel;
  private handlers = new Set<(e: RealtimeEvent) => void>();

  constructor() {
    this.channel = new BroadcastChannel(RT_CHANNEL);
    this.channel.onmessage = (ev: MessageEvent<RealtimeEvent>) =>
      this.handlers.forEach((h) => h(ev.data));
  }
  emit(event: RealtimeEvent) {
    this.channel.postMessage(event);
  }
  on(handler: (e: RealtimeEvent) => void) {
    this.handlers.add(handler);
  }
  join() {
    /* rooms are a socket concept; broadcast is global to the browser */
  }
  leave() {}
  close() {
    this.channel.close();
  }
}

class NoopBus implements RealtimeBus {
  readonly transport = 'none' as const;
  emit() {}
  on() {}
  join() {}
  leave() {}
  close() {}
}

/** Create the best available bus for the current environment (client-only). */
export function createBus(): RealtimeBus {
  if (typeof window === 'undefined') return new NoopBus();
  if (SOCKET_URL) {
    try {
      return new SocketBus(SOCKET_URL);
    } catch {
      /* fall through to broadcast */
    }
  }
  if (typeof BroadcastChannel !== 'undefined') return new BroadcastBus();
  return new NoopBus();
}
