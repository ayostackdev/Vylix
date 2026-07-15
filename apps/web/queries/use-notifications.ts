'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';

export interface Notification {
  id: string;
  kind: string;
  title: string;
  message: string | null;
  payload: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string | null;
}

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => authFetch('/api/collaboration/notifications') as Promise<Notification[]>,
    refetchInterval: 30_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (notifId: string) =>
      authFetch(`/api/collaboration/notifications/${notifId}/read`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['unread-summary'] });
    },
  });
}
