'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface PointsEarnedEvent {
  points: number;
  reason?: string;
}

export function PointsRefreshListener() {
  const qc = useQueryClient();

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<PointsEarnedEvent>).detail;
      const points = detail?.points ?? 0;
      if (points > 0) {
        toast.success(`🎉 +${points.toLocaleString()} points earned!`);
      }
      qc.invalidateQueries({ queryKey: ['gamification'] });
    };
    window.addEventListener('vylix:points', handler);
    return () => window.removeEventListener('vylix:points', handler);
  }, [qc]);

  return null;
}
