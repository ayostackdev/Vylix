'use client';

import { getSupabaseBrowserClient } from '@/lib/supabase-client';
import { API_BASE } from '@/lib/api-base';

export type RealtimeRoomType = 'department' | 'topic' | 'conversation' | 'user';

export type RealtimeEventKind =
  | 'upload'
  | 'comment'
  | 'lesson'
  | 'notification'
  | 'message'
  | 'typing'
  | 'read'
  | 'edit'
  | 'delete'
  | 'presence'
  | 'status';

export interface RealtimeEvent<TPayload = Record<string, unknown>> {
  roomType: RealtimeRoomType;
  roomKey: string;
  kind: RealtimeEventKind;
  title: string;
  message?: string;
  actorId?: string;
  topicId?: string;
  conversationId?: string;
  notificationId?: string;
  targetUserId?: string;
  payload?: TPayload;
  createdAt: string;
}

// Handlers registered by consumers have specific payload types (e.g.
// RealtimeEvent); `any` keeps assignment bivariant like socket.io's emitter.
type PulseEventHandler = (data?: any) => void;

const MAX_RECONNECT_DELAY_MS = 15_000;

/**
 * Minimal native-WebSocket client matching the Vylix /pulse wire protocol:
 *
 * - Connect: GET {origin}/pulse?token=<supabase_jwt>  (401/close 4001 on bad token)
 * - Client → server JSON frames: { event: 'pulse:join-room' | 'pulse:leave-room', roomType, roomKey }
 * - Server → client JSON frames: { event: '<name>', ...data }  (e.g. 'pulse:event')
 */
export class VylixSocket {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<PulseEventHandler>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelayMs = 1_000;
  private shouldStayConnected = false;

  /**
   * `resolveUrl` runs on every (re)connect so a fresh Supabase token is
   * fetched instead of reusing a token that may have expired.
   */
  constructor(private readonly resolveUrl: () => string | Promise<string>) {}

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  connect(): void {
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    if (typeof window === 'undefined' || typeof WebSocket === 'undefined') {
      return;
    }

    this.shouldStayConnected = true;
    void this.open();
  }

  disconnect(): void {
    this.shouldStayConnected = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close(1000);
    this.ws = null;
  }

  emit(event: string, payload?: Record<string, unknown>): void {
    if (!this.connected || !this.ws) {
      return;
    }
    try {
      this.ws.send(JSON.stringify({ event, ...(payload ?? {}) }));
    } catch (err) {
      console.error('[Vylix] WebSocket send failed:', err);
    }
  }

  on(event: string, handler: PulseEventHandler): void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler);
  }

  off(event: string, handler?: PulseEventHandler): void {
    const set = this.handlers.get(event);
    if (!set) {
      return;
    }
    if (handler) {
      set.delete(handler);
    } else {
      set.clear();
    }
    if (set.size === 0) {
      this.handlers.delete(event);
    }
  }

  private async open(): Promise<void> {
    let url: string;
    try {
      url = await this.resolveUrl();
    } catch (err) {
      console.error('[Vylix] WebSocket URL resolution failed:', err);
      this.scheduleReconnect();
      return;
    }

    if (!this.shouldStayConnected) {
      return;
    }

    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (err) {
      console.error('[Vylix] WebSocket creation failed:', err);
      this.scheduleReconnect();
      return;
    }

    this.ws = ws;

    ws.onopen = () => {
      this.reconnectDelayMs = 1_000;
      this.dispatch('connect');
    };

    ws.onmessage = (messageEvent) => {
      try {
        const frame = JSON.parse(String(messageEvent.data));
        if (frame && typeof frame.event === 'string') {
          const { event, ...data } = frame;
          if (event === 'pulse:ping') {
            // Server heartbeat probe — answer so the socket is not reaped.
            this.emit('pulse:pong');
            return;
          }
          if (event === 'pulse:pong') {
            return;
          }
          this.dispatch(event, data);
        }
      } catch {
        // Non-JSON frame — ignore.
      }
    };

    ws.onclose = (closeEvent) => {
      this.ws = null;
      if (closeEvent.code === 4001) {
        console.error('[Vylix] WebSocket authentication failed — token may be expired');
      }
      this.dispatch('disconnect', { code: closeEvent.code });
      if (this.shouldStayConnected) {
        this.scheduleReconnect();
      }
    };

    ws.onerror = () => {
      // onclose always follows onerror — reconnect handled there.
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || !this.shouldStayConnected) {
      return;
    }
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.shouldStayConnected) {
        void this.open();
        this.reconnectDelayMs = Math.min(this.reconnectDelayMs * 2, MAX_RECONNECT_DELAY_MS);
      }
    }, this.reconnectDelayMs);
  }

  private dispatch(event: string, data?: Record<string, unknown>): void {
    const set = this.handlers.get(event);
    if (!set) {
      return;
    }
    for (const handler of [...set]) {
      try {
        handler(data);
      } catch (err) {
        console.error(`[Vylix] ${event} handler failed:`, err);
      }
    }
  }
}

let realtimeSocket: VylixSocket | null = null;
const studyRoomSockets = new Map<string, VylixSocket>();

function getRealtimeBaseUrl() {
  const value = API_BASE;

  if (!value) {
    return null;
  }

  try {
    const parsedUrl = new URL(value);

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return null;
    }

    return parsedUrl.origin;
  } catch {
    return null;
  }
}

async function fetchAuthToken(): Promise<string> {
  try {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { session }
    } = await supabase.auth.getSession();
    return session?.access_token ?? '';
  } catch {
    return '';
  }
}

function buildSocketUrl(baseUrl: string, path: string, token: string): string {
  const wsProtocol = baseUrl.startsWith('https:') ? 'wss:' : 'ws:';
  const origin = baseUrl.replace(/^https?:/, wsProtocol);
  return `${origin}${path}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
}

export async function getRealtimeSocket(): Promise<VylixSocket | null> {
  if (realtimeSocket) {
    return realtimeSocket;
  }

  const baseUrl = getRealtimeBaseUrl();

  if (!baseUrl) {
    return null;
  }

  realtimeSocket = new VylixSocket(async () =>
    buildSocketUrl(baseUrl, '/pulse', await fetchAuthToken())
  );
  return realtimeSocket;
}

/**
 * Signaling socket for one audio study room. Callers must call
 * `releaseStudyRoomSocket` when they leave so the room subscription and
 * reconnect timer are torn down.
 */
export function getStudyRoomSocket(conversationId: string): VylixSocket | null {
  const baseUrl = getRealtimeBaseUrl();

  if (!baseUrl) {
    return null;
  }

  let socket = studyRoomSockets.get(conversationId);
  if (!socket) {
    const path = `/study-room/${encodeURIComponent(conversationId)}`;
    socket = new VylixSocket(async () =>
      buildSocketUrl(baseUrl, path, await fetchAuthToken())
    );
    studyRoomSockets.set(conversationId, socket);
  }
  return socket;
}

export function releaseStudyRoomSocket(conversationId: string): void {
  const socket = studyRoomSockets.get(conversationId);
  if (!socket) {
    return;
  }
  socket.disconnect();
  studyRoomSockets.delete(conversationId);
}

export function buildRealtimeEvent<TPayload = Record<string, unknown>>(
  roomType: RealtimeRoomType,
  roomKey: string,
  event: Omit<RealtimeEvent<TPayload>, 'roomType' | 'roomKey' | 'createdAt'>
): RealtimeEvent<TPayload> {
  return {
    roomType,
    roomKey,
    createdAt: new Date().toISOString(),
    ...event
  };
}
