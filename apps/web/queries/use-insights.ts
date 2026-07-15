'use client';

import { useMutation } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';

export interface InsightsRequest {
  title: string;
  department_code: string;
  file_url?: string;
  text?: string;
}

export interface InsightsResponse {
  department_code: string;
  summary: string;
  questions: string[];
  tips: string[];
}

export function useInsights() {
  return useMutation({
    mutationFn: (payload: InsightsRequest) =>
      authFetch('/api/insights/from-url', {
        method: 'POST',
        body: JSON.stringify(payload),
      }) as Promise<InsightsResponse>,
  });
}
