'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  buildRealtimeEvent,
  getRealtimeSocket,
  type RealtimeEvent,
  type RealtimeEventKind,
  type RealtimeRoomType
} from '@/lib/realtime';

export interface RealtimePulseItem {
  title: string;
  activity: string;
  status: string;
  kind: RealtimeEventKind;
  roomType: RealtimeRoomType;
  roomKey: string;
  createdAt: string;
}

interface UseRealtimePulseOptions {
  roomType: RealtimeRoomType;
  roomKey: string;
  enabled?: boolean;
  userId?: string;
}

function formatStatus(kind: RealtimeEventKind) {
  switch (kind) {
    case 'upload':
      return 'Upload';
    case 'comment':
      return 'Comment';
    case 'lesson':
      return 'Lesson';
    case 'notification':
      return 'Notification';
    case 'message':
      return 'Message';
    case 'typing':
      return 'Typing';
    case 'read':
      return 'Read';
    case 'edit':
      return 'Edited';
    case 'delete':
      return 'Deleted';
    case 'presence':
      return 'Presence';
    case 'status':
      return 'Status';
    default:
      return 'Live';
  }
}

function formatActivity(event: RealtimeEvent) {
  const payload = event.payload as Record<string, unknown> | undefined;
  const fileName = typeof payload?.fileName === 'string' ? payload.fileName : null;
  const topicTitle = typeof payload?.topicTitle === 'string' ? payload.topicTitle : null;
  const message = typeof event.message === 'string' ? event.message : null;

  if (message) {
    return message;
  }

  if (fileName) {
    return `${fileName} is ${formatStatus(event.kind).toLowerCase()}.`;
  }

  if (topicTitle) {
    return `${topicTitle} is now ${formatStatus(event.kind).toLowerCase()}.`;
  }

  if (event.kind === 'presence') {
    return 'Someone just joined this room.';
  }

  return 'New live activity.';
}

function toPulseItem(event: RealtimeEvent): RealtimePulseItem {
  const payload = event.payload as Record<string, unknown> | undefined;
  const title =
    typeof event.title === 'string' && event.title.trim().length > 0
      ? event.title
      : typeof payload?.topicTitle === 'string'
        ? String(payload.topicTitle)
        : event.kind === 'presence'
          ? 'Presence update'
          : 'Live update';

  return {
    title,
    activity: formatActivity(event),
    status: formatStatus(event.kind),
    kind: event.kind,
    roomType: event.roomType,
    roomKey: event.roomKey,
    createdAt: event.createdAt
  };
}

export function useRealtimePulse({ roomType, roomKey, enabled = true, userId }: UseRealtimePulseOptions) {
  const [connected, setConnected] = useState(false);
  const [presenceCount, setPresenceCount] = useState(0);
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const [items, setItems] = useState<RealtimePulseItem[]>([]);

  const room = useMemo(() => ({ roomType, roomKey }), [roomKey, roomType]);

  useEffect(() => {
    if (!enabled) {
      setConnected(false);
      return;
    }

    const socket = getRealtimeSocket();

    if (!socket) {
      return;
    }

    const handleConnect = () => {
      setConnected(true);
      socket.emit('pulse:join-room', { ...room, userId });
    };

    const handleDisconnect = () => {
      setConnected(false);
    };

    const handleEvent = (event: RealtimeEvent) => {
      const nextEvent = buildRealtimeEvent(event.roomType, event.roomKey, event);
      setLastEvent(nextEvent);
      setItems((currentItems) => [toPulseItem(nextEvent), ...currentItems].slice(0, 5));

      if (nextEvent.kind === 'presence') {
        const action = String((nextEvent.payload as Record<string, unknown> | undefined)?.action ?? 'join');
        setPresenceCount((current) => {
          if (action === 'leave') {
            return Math.max(current - 1, 0);
          }

          if (action === 'join') {
            return current + 1;
          }

          return current;
        });
      }
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('pulse:event', handleEvent);
    socket.on('pulse:update', (payload: { topicId?: string; type?: RealtimeEventKind }) => {
      handleEvent({
        roomType,
        roomKey,
        kind: payload.type ?? 'status',
        title: payload.type === 'upload' ? 'New upload' : 'Live update',
        payload,
        createdAt: new Date().toISOString()
      } satisfies RealtimeEvent);
    });

    if (!socket.connected) {
      socket.connect();
    } else {
      handleConnect();
    }

    return () => {
      socket.emit('pulse:leave-room', { ...room, userId });
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('pulse:event', handleEvent);
      socket.off('pulse:update');
    };
  }, [enabled, room, roomKey, roomType, userId]);

  return {
    connected,
    presenceCount,
    lastEvent,
    items
  };
}