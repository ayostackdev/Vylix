'use client';

import { useMutation } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';

export interface GpaPredictionRequest {
  study_hours_per_week: number;
  attendance_rate: number;
  assessment_score: number;
}

export interface GpaPredictionResponse {
  predicted_gpa: number;
  note: string;
}

export function useGpaPrediction() {
  return useMutation({
    mutationFn: (payload: GpaPredictionRequest) =>
      authFetch('/api/analytics/gpa-prediction', {
        method: 'POST',
        body: JSON.stringify(payload),
      }) as Promise<GpaPredictionResponse>,
  });
}
