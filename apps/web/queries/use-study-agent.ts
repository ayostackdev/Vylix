'use client';

import { useMutation } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { getQaCached, putQaCached, studyAgentCacheKey } from '@/lib/qa-cache';

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

const DEFAULT_PROMPT = 'Analyze my weaknesses and create a personalized study plan for this course';

export function useStudyAgent() {
  return useMutation({
    mutationFn: async (payload: StudyAgentRequest): Promise<StudyAgentResponse> => {
      const course_code = payload.courseCode;
      const prompt = payload.prompt ?? DEFAULT_PROMPT;
      const task_tier = payload.taskTier ?? 'standard';

      const cacheKey = studyAgentCacheKey(course_code, prompt, task_tier);
      const cached = await getQaCached<StudyAgentResponse>(cacheKey);
      if (cached) return cached;

      const result = (await authFetch('/api/study-agent/run', {
        method: 'POST',
        body: JSON.stringify({ course_code, prompt, task_tier }),
      })) as Promise<StudyAgentResponse>;

      await putQaCached(cacheKey, result);
      return result;
    },
  });
}
