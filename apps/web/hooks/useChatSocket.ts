'use client';

import { useEffect, useRef, useState } from 'react';
import { getRealtimeSocket, type RealtimeEvent } from '@/lib/realtime';

interface UseChatSocketOptions {
  conversationId: string | null;
  userId: string;
  enabled?: boolean;
  otherUserId?: string | null;
}

export interface TypingUser {
  userId: string;
  isTyping: boolean;
}

export function useChatSocket({ conversationId, userId, enabled = true, otherUserId }: UseChatSocketOptions) {
  const [connected, setConnected] = useState(false);
  const [otherOnline, setOtherOnline] = useState(false);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const typingTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    if (!enabled || !conversationId) {
      setConnected(false);
      setOtherOnline(false);
      return;
    }

    setOtherOnline(false);

    let cancelled = false;

    (async () => {
      const socket = await getRealtimeSocket();
      if (!socket || cancelled) return;

      const handleConnect = () => {
        if (cancelled) return;
        setConnected(true);
        socket.emit('pulse:join-room', {
          roomType: 'conversation',
          roomKey: conversationId,
          userId,
        });
      };

      const handleDisconnect = () => {
        if (cancelled) return;
        setConnected(false);
      };

      const handleEvent = (event: RealtimeEvent) => {
        if (cancelled) return;
        if (event.roomType !== 'conversation' || event.roomKey !== conversationId) return;

        if (event.kind === 'presence' && otherUserId && event.actorId === otherUserId) {
          setOtherOnline(event.title === 'User joined');
        }

        if (event.kind === 'typing' && event.actorId !== userId) {
          const payload = event.payload as { isTyping?: boolean; userId?: string } | undefined;
          const typingUserId = payload?.userId ?? event.actorId;
          const isTyping = payload?.isTyping ?? true;

          if (!typingUserId) return;

          setTypingUsers((prev) => {
            if (isTyping) {
              if (!prev.some((t) => t.userId === typingUserId)) {
                return [...prev, { userId: typingUserId, isTyping: true }];
              }
            } else {
              return prev.filter((t) => t.userId !== typingUserId);
            }
            return prev;
          });

          const existing = typingTimeouts.current.get(typingUserId);
          if (existing) clearTimeout(existing);
          if (isTyping) {
            typingTimeouts.current.set(
              typingUserId,
              setTimeout(() => {
                setTypingUsers((prev) => prev.filter((t) => t.userId !== typingUserId));
                typingTimeouts.current.delete(typingUserId);
              }, 4000)
            );
          } else {
            typingTimeouts.current.delete(typingUserId);
          }
        }
      };

      socket.on('connect', handleConnect);
      socket.on('disconnect', handleDisconnect);
      socket.on('pulse:event', handleEvent);

      if (!socket.connected) {
        socket.connect();
      } else {
        handleConnect();
      }
    })();

    const timeouts = typingTimeouts.current;

    return () => {
      cancelled = true;
      getRealtimeSocket().then((socket) => {
        if (!socket) return;
        socket.emit('pulse:leave-room', {
          roomType: 'conversation',
          roomKey: conversationId,
          userId,
        });
        socket.off('connect');
        socket.off('disconnect');
        socket.off('pulse:event');
        timeouts.forEach((t) => clearTimeout(t));
        timeouts.clear();
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, userId, enabled]);

  return { connected, otherOnline, typingUsers };
}
