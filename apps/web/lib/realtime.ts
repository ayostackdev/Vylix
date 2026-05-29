'use client';

import { io, type Socket } from 'socket.io-client';

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

export function getRealtimeSocket() {
  if (realtimeSocket) {
    return realtimeSocket;
  }

  const baseUrl = getRealtimeBaseUrl();

  if (!baseUrl) {
    return null;
  }

  realtimeSocket = io(`${baseUrl}/pulse`, {
    autoConnect: false,
    transports: ['websocket', 'polling'],
    withCredentials: true,
    reconnection: true
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