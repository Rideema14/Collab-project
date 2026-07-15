import type { Socket } from 'socket.io-client';
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
  private socket: Socket | null = null;
  private handlers = new Set<(e: RealtimeEvent) => void>();
  /** Emits/joins issued before the client finishes loading are buffered, then flushed. */
  private pending: Array<[string, unknown]> = [];

  constructor(url: string) {
    // socket.io-client is ~45KB; load it ONLY when a socket URL is configured, so
    // the default (BroadcastChannel) path keeps it out of the initial bundle.
    void import('socket.io-client')
      .then(({ io }) => {
        const socket = io(url, { transports: ['websocket'], autoConnect: true });
        socket.on('rt', (event: RealtimeEvent) => this.handlers.forEach((h) => h(event)));
        this.socket = socket;
        for (const [channel, payload] of this.pending) socket.emit(channel, payload);
        this.pending = [];
      })
      .catch(() => {
        /* leave socket null; emits are dropped, same as NoopBus */
      });
  }
  private send(channel: string, payload: unknown) {
    if (this.socket) this.socket.emit(channel, payload);
    else this.pending.push([channel, payload]);
  }
  emit(event: RealtimeEvent) {
    this.send('rt', event);
  }
  on(handler: (e: RealtimeEvent) => void) {
    this.handlers.add(handler);
  }
  join(room: string) {
    this.send('join', room);
  }
  leave(room: string) {
    this.send('leave', room);
  }
  close() {
    this.socket?.close();
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
