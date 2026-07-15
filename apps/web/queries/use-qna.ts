'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';

export interface QnaAuthor {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  contributionScore?: number;
}

export interface QnaAnswer {
  id: string;
  content: string;
  helpCount: number;
  isAccepted: boolean;
  createdAt: string;
  author: QnaAuthor;
}

export interface QnaQuestion {
  id: string;
  title: string;
  content: string;
  helpCount: number;
  viewCount: number;
  isResolved: boolean;
  createdAt: string;
  topicId?: string;
  author: QnaAuthor;
  answers: QnaAnswer[];
}

export interface TopAnswerer {
  userId: string;
  answerCount: number;
  helpfulCount: number;
}

export interface CourseInfo {
  id: string;
  code: string;
  title: string;
  level: number;
  isGeneral: boolean;
  pastQuestionCount: number;
}

export interface TopicInfo {
  id: string;
  title: string;
  courseId: string;
  authorId: string;
  isActive: boolean;
  lastActivity: string;
  author: { id: string; fullName: string; departmentId: string | null };
}

export function useCourses() {
  return useQuery({
    queryKey: ['courses'],
    queryFn: () => authFetch('/api/courses/my') as Promise<CourseInfo[]>,
    staleTime: 60_000,
  });
}

export function useTopics(courseId: string | null) {
  return useQuery({
    queryKey: ['topics', courseId],
    queryFn: () => authFetch(`/api/topics/course/${courseId}`) as Promise<TopicInfo[]>,
    enabled: !!courseId,
    staleTime: 60_000,
  });
}

export function useTopicQuestions(topicId: string | null) {
  return useQuery({
    queryKey: ['qna-questions', topicId],
    queryFn: async () => {
      const json = await authFetch(`/api/qna/topics/${topicId}/questions?limit=50`);
      return (json as { data?: QnaQuestion[] }).data ?? (json as QnaQuestion[]);
    },
    enabled: !!topicId,
    staleTime: 30_000,
  });
}

export function useTrendingQuestions() {
  return useQuery({
    queryKey: ['qna-trending'],
    queryFn: async () => {
      const json = await authFetch('/api/qna/trending?limit=5');
      return (json as { data?: QnaQuestion[] }).data ?? (json as QnaQuestion[]);
    },
    staleTime: 60_000,
  });
}

export function useSearchQuestions(query: string) {
  return useQuery({
    queryKey: ['qna-search', query],
    queryFn: async () => {
      const json = await authFetch(`/api/qna/search?q=${encodeURIComponent(query)}&limit=20`);
      return (json as { data?: QnaQuestion[] }).data ?? (json as QnaQuestion[]);
    },
    enabled: query.trim().length >= 2,
    staleTime: 30_000,
  });
}

export function useTopAnswerers(topicId: string | null) {
  return useQuery({
    queryKey: ['qna-top-answerers', topicId],
    queryFn: async () => {
      const json = await authFetch(`/api/qna/topics/${topicId}/top-answerers?limit=5`);
      return (json as { data?: TopAnswerer[] }).data ?? (json as TopAnswerer[]);
    },
    enabled: !!topicId,
    staleTime: 120_000,
  });
}

export function useCreateQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ topicId, title, content }: { topicId: string; title: string; content: string }) => {
      const json = await authFetch(`/api/qna/topics/${topicId}/questions`, {
        method: 'POST',
        body: JSON.stringify({ title, content }),
      });
      return (json as { data?: unknown }).data ?? json;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['qna-questions', variables.topicId] });
      qc.invalidateQueries({ queryKey: ['qna-trending'] });
    },
  });
}

export function useCreateAnswer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ questionId, content }: { questionId: string; content: string }) => {
      const json = await authFetch(`/api/qna/questions/${questionId}/answers`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      });
      return (json as { data?: unknown }).data ?? json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['qna-questions'] });
    },
  });
}

export function useMarkHelpful() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (answerId: string) => {
      const json = await authFetch(`/api/qna/answers/${answerId}/helpful`, {
        method: 'POST',
      });
      return (json as { data?: unknown }).data ?? json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['qna-questions'] });
    },
  });
}

export function useAcceptAnswer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ questionId, answerId }: { questionId: string; answerId: string }) => {
      const json = await authFetch(`/api/qna/questions/${questionId}/answers/${answerId}/accept`, {
        method: 'POST',
      });
      return (json as { data?: unknown }).data ?? json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['qna-questions'] });
    },
  });
}
