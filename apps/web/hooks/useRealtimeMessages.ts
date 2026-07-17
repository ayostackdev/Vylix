'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getRealtimeSocket, type RealtimeEvent } from '@/lib/realtime';
import type { Message } from '@/queries/use-collaboration';

export function useRealtimeMessages(conversationId: string | null, userId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!conversationId || !userId) return;

    let cancelled = false;

    (async () => {
      const socket = await getRealtimeSocket();
      if (!socket || cancelled) return;

      const handleEvent = (event: RealtimeEvent) => {
        if (cancelled) return;
        if (event.roomType !== 'conversation' || event.roomKey !== conversationId) return;

        const payload = event.payload as Record<string, unknown> | undefined;

        if (event.kind === 'message' && payload?.fullMessage) {
          const msg = payload.fullMessage as Message;
          queryClient.setQueryData(['messages', conversationId], (old: Message[] | undefined) => {
            if (!old) return [msg];
            if (old.some((m) => m.id === msg.id)) return old;
            return [...old, msg];
          });
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
        }

        if (event.kind === 'edit' && payload?.fullMessage) {
          const msg = payload.fullMessage as Message;
          queryClient.setQueryData(['messages', conversationId], (old: Message[] | undefined) => {
            if (!old) return [msg];
            return old.map((m) => (m.id === msg.id ? msg : m));
          });
        }

        if (event.kind === 'delete' && payload?.messageId) {
          const messageId = payload.messageId as string;
          queryClient.setQueryData(['messages', conversationId], (old: Message[] | undefined) => {
            if (!old) return [];
            return old.filter((m) => m.id !== messageId);
          });
        }
      };

      socket.on('pulse:event', handleEvent);
    })();

    return () => {
      cancelled = true;
      getRealtimeSocket().then((socket) => {
        if (!socket) return;
        socket.off('pulse:event');
      });
    };
  }, [conversationId, userId, queryClient]);
}
