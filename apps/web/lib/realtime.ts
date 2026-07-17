'use client';

import { io, type Socket } from 'socket.io-client';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';

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

let realtimeSocket: Socket | null = null;

function getRealtimeBaseUrl() {
  const value = process.env.NEXT_PUBLIC_API_BASE_URL;

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

export async function getRealtimeSocket(): Promise<Socket | null> {
  if (realtimeSocket) {
    return realtimeSocket;
  }

  const baseUrl = getRealtimeBaseUrl();

  if (!baseUrl) {
    return null;
  }

  const token = await fetchAuthToken();

  realtimeSocket = io(`${baseUrl}/pulse`, {
    autoConnect: false,
    transports: ['websocket', 'polling'],
    withCredentials: true,
    reconnection: true,
    query: token ? { token } : undefined,
  });

  realtimeSocket.on('connect_error', (err) => {
    if (err.message?.includes('Authentication required') || err.message?.includes('4001')) {
      console.error('[Vylix] WebSocket authentication failed — token may be expired');
    }
  });

  return realtimeSocket;
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
