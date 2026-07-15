'use client';

import { useMutation } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';

export interface StudyAgentRequest {
  courseCode: string;
  prompt?: string;
  taskTier?: 'standard' | 'complex';
}

export interface StudyAgentResponse {
  plan: string;
  course_code: string;
  tier: string;
}

export function useStudyAgent() {
  return useMutation({
    mutationFn: (payload: StudyAgentRequest) =>
      authFetch('/api/study-agent/run', {
        method: 'POST',
        body: JSON.stringify({
          course_code: payload.courseCode,
          prompt: payload.prompt ?? 'Analyze my weaknesses and create a personalized study plan for this course',
          task_tier: payload.taskTier ?? 'standard',
        }),
      }) as Promise<StudyAgentResponse>,
  });
}
